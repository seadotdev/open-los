import { eq, and, like, or } from "drizzle-orm";
import type { Database } from "../schema/db.js";
import { entities, screeningResults, referenceEntities } from "../schema/tables.js";
import type { AuditService } from "./audit.js";
import { NotFoundError, ValidationError } from "./errors.js";

// ─── Types ─────────────────────────────────────────────────────────────────────

export type ScreeningSource =
  | "dunl_spiq"
  | "companies_house"
  | "gleif_lei"
  | "opencorporates"
  | "internal";

export type ScreeningStatus =
  | "pending"
  | "matched"
  | "partial"
  | "unmatched"
  | "confirmed"
  | "rejected"
  | "error";

export type MatchMethod =
  | "exact_id"
  | "name_fuzzy"
  | "qmd_hybrid"
  | "lei_match";

export interface MatchCandidate {
  external_id: string;
  name: string;
  confidence: number;
  identifiers: Record<string, string>;
  metadata: Record<string, unknown>;
}

export interface RiskSignals {
  sanctions_hit: boolean;
  pep_hit: boolean;
  adverse_media: boolean;
  jurisdiction_risk?: string;
}

export interface ScreenEntityInput {
  entity_id: string;
  sources?: ScreeningSource[];
}

export interface ReviewScreeningInput {
  status: "confirmed" | "rejected";
  selected_candidate_id?: string;
  notes?: string;
}

export interface ImportReferenceDataInput {
  source: ScreeningSource;
  records: Array<{
    external_id: string;
    name: string;
    legal_name?: string;
    jurisdiction?: string;
    entity_type?: string;
    status?: string;
    identifiers?: Record<string, string>;
    metadata?: Record<string, unknown>;
  }>;
}

export interface ResolveInput {
  name: string;
  jurisdiction?: string;
  registration_number?: string;
  lei?: string;
  source?: ScreeningSource;
  limit?: number;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

const VALID_SOURCES: ScreeningSource[] = [
  "dunl_spiq",
  "companies_house",
  "gleif_lei",
  "opencorporates",
  "internal",
];

const VALID_REVIEW_STATUSES = ["confirmed", "rejected"];

function toApiScreening(row: typeof screeningResults.$inferSelect) {
  const { tenant_id, ...rest } = row;
  return rest;
}

function toApiReference(row: typeof referenceEntities.$inferSelect) {
  const { tenant_id, ...rest } = row;
  return rest;
}

/**
 * Normalize a company name for fuzzy comparison.
 * Lowercases, strips common suffixes (Ltd, Limited, Inc, Corp, Plc, LLC, etc.),
 * collapses whitespace, and removes punctuation.
 */
function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(
      /\b(ltd|limited|inc|incorporated|corp|corporation|plc|llc|llp|gmbh|ag|sa|sas|sarl|bv|nv|pty|co|company)\b/gi,
      ""
    )
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Compute Jaccard similarity between two sets of tokens.
 */
function jaccardSimilarity(a: string[], b: string[]): number {
  const setA = new Set(a);
  const setB = new Set(b);
  const intersection = new Set([...setA].filter((x) => setB.has(x)));
  const union = new Set([...setA, ...setB]);
  return union.size === 0 ? 0 : intersection.size / union.size;
}

/**
 * Simple Levenshtein edit distance.
 */
function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    Array(n + 1).fill(0)
  );
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

/**
 * Compute a composite match confidence score between a query and a reference entity.
 * Uses a weighted blend of:
 *   - Exact identifier matches (LEI, registration number) → 1.0
 *   - Levenshtein-based name similarity
 *   - Jaccard token overlap
 *   - Jurisdiction match bonus
 */
function computeMatchConfidence(
  query: {
    name: string;
    jurisdiction?: string;
    registration_number?: string;
    lei?: string;
  },
  ref: {
    name: string;
    jurisdiction?: string | null;
    identifiers?: Record<string, string> | null;
  }
): number {
  // Exact LEI match → near-certain
  if (
    query.lei &&
    ref.identifiers?.lei &&
    query.lei.toUpperCase() === ref.identifiers.lei.toUpperCase()
  ) {
    return 1.0;
  }

  // Exact registration number match
  if (
    query.registration_number &&
    ref.identifiers?.companies_house === query.registration_number
  ) {
    return 0.95;
  }

  // Name-based scoring
  const qNorm = normalizeName(query.name);
  const rNorm = normalizeName(ref.name);

  if (qNorm === rNorm) {
    // Exact normalized name match
    return query.jurisdiction && ref.jurisdiction && query.jurisdiction === ref.jurisdiction
      ? 0.95
      : 0.90;
  }

  // Levenshtein similarity (normalized)
  const maxLen = Math.max(qNorm.length, rNorm.length);
  const editDist = levenshtein(qNorm, rNorm);
  const levenSim = maxLen === 0 ? 1 : 1 - editDist / maxLen;

  // Jaccard token similarity
  const qTokens = qNorm.split(" ").filter(Boolean);
  const rTokens = rNorm.split(" ").filter(Boolean);
  const jaccard = jaccardSimilarity(qTokens, rTokens);

  // Weighted combination
  let score = 0.5 * levenSim + 0.4 * jaccard;

  // Jurisdiction bonus
  if (
    query.jurisdiction &&
    ref.jurisdiction &&
    query.jurisdiction.toUpperCase() === ref.jurisdiction?.toUpperCase()
  ) {
    score += 0.1;
  }

  return Math.min(1.0, Math.round(score * 1000) / 1000);
}

// ─── Service ───────────────────────────────────────────────────────────────────

export class EntityResolutionService {
  constructor(
    private db: Database,
    private audit: AuditService,
    private getNow: () => string
  ) {}

  // ─── Screen an entity against reference data ────────────────────────────────

  async screen(
    input: ScreenEntityInput,
    actor: string,
    tenantId = "default"
  ) {
    // Validate entity exists
    const entityRows = await this.db
      .select()
      .from(entities)
      .where(
        and(eq(entities.id, input.entity_id), eq(entities.tenant_id, tenantId))
      );
    if (entityRows.length === 0) {
      throw new NotFoundError(`Entity ${input.entity_id} not found`);
    }
    const entity = entityRows[0];

    const sources = input.sources ?? ["dunl_spiq"];
    for (const s of sources) {
      if (!VALID_SOURCES.includes(s)) {
        throw new ValidationError(
          `Invalid source: ${s}. Must be one of: ${VALID_SOURCES.join(", ")}`
        );
      }
    }

    const results = [];

    for (const source of sources) {
      // Search reference entities for this source
      const candidates = await this.findCandidates(
        {
          name: entity.name,
          jurisdiction: entity.jurisdiction ?? undefined,
          registration_number: entity.registration_number ?? undefined,
          lei: entity.lei ?? undefined,
        },
        source,
        tenantId,
        10
      );

      const now = this.getNow();
      const id = crypto.randomUUID();

      let status: ScreeningStatus;
      let topMatch: MatchCandidate | undefined;
      let matchMethod: MatchMethod | undefined;

      if (candidates.length === 0) {
        status = "unmatched";
      } else if (candidates[0].confidence >= 0.9) {
        status = "matched";
        topMatch = candidates[0];
        matchMethod = topMatch.identifiers.lei ? "lei_match" : "name_fuzzy";
      } else if (candidates[0].confidence >= 0.6) {
        status = "partial";
        topMatch = candidates[0];
        matchMethod = "name_fuzzy";
      } else {
        status = "unmatched";
      }

      const screening = {
        id,
        tenant_id: tenantId,
        entity_id: input.entity_id,
        source,
        status,
        external_id: topMatch?.external_id ?? null,
        external_name: topMatch?.name ?? null,
        match_confidence: topMatch?.confidence ?? null,
        match_method: matchMethod ?? null,
        candidates: candidates.length > 0 ? candidates : null,
        matched_identifiers: topMatch?.identifiers ?? null,
        risk_signals: null as RiskSignals | null,
        initiated_by: actor,
        reviewed_by: null,
        reviewed_at: null,
        review_notes: null,
        created_at: now,
        updated_at: now,
      };

      await this.db.insert(screeningResults).values(screening);
      results.push(toApiScreening(screening));
    }

    // Audit if entity is linked to a deal
    const { deals } = await import("../schema/tables.js");
    const dealRows = await this.db
      .select()
      .from(deals)
      .where(eq(deals.primary_entity_id, input.entity_id));
    if (dealRows.length > 0) {
      await this.audit.record({
        deal_id: dealRows[0].id,
        type: "ENTITY_SCREENED",
        actor,
        timestamp: this.getNow(),
        object_type: "entity",
        object_id: input.entity_id,
        metadata: {
          sources,
          results: results.map((r) => ({
            source: r.source,
            status: r.status,
            confidence: r.match_confidence,
          })),
        },
      });
    }

    return results;
  }

  // ─── Review a screening result ──────────────────────────────────────────────

  async review(
    screeningId: string,
    input: ReviewScreeningInput,
    actor: string,
    tenantId = "default"
  ) {
    if (!VALID_REVIEW_STATUSES.includes(input.status)) {
      throw new ValidationError(
        `Status must be 'confirmed' or 'rejected'`
      );
    }

    const rows = await this.db
      .select()
      .from(screeningResults)
      .where(
        and(
          eq(screeningResults.id, screeningId),
          eq(screeningResults.tenant_id, tenantId)
        )
      );
    if (rows.length === 0) {
      throw new NotFoundError(`Screening result ${screeningId} not found`);
    }
    const existing = rows[0];

    const now = this.getNow();
    const updates: Record<string, unknown> = {
      status: input.status,
      reviewed_by: actor,
      reviewed_at: now,
      updated_at: now,
    };

    if (input.notes) {
      updates.review_notes = input.notes;
    }

    // If confirming with a specific candidate, update the match
    if (input.status === "confirmed" && input.selected_candidate_id) {
      const candidatesList = (existing.candidates as MatchCandidate[] | null) ?? [];
      const selected = candidatesList.find(
        (c) => c.external_id === input.selected_candidate_id
      );
      if (selected) {
        updates.external_id = selected.external_id;
        updates.external_name = selected.name;
        updates.match_confidence = selected.confidence;
        updates.matched_identifiers = selected.identifiers;
      }
    }

    // If confirmed, also update the entity's identifiers
    if (input.status === "confirmed" && existing.external_id) {
      const entityRows = await this.db
        .select()
        .from(entities)
        .where(eq(entities.id, existing.entity_id));

      if (entityRows.length > 0) {
        const entity = entityRows[0];
        const existingIdentifiers = (entity.identifiers as Array<{ scheme: string; value: string; authority?: string; confidence?: number }>) ?? [];
        const matchedIds = (updates.matched_identifiers ?? existing.matched_identifiers) as Record<string, string> | null;

        if (matchedIds) {
          const newIdentifiers = [...existingIdentifiers];
          for (const [scheme, value] of Object.entries(matchedIds)) {
            if (!newIdentifiers.some((id) => id.scheme === scheme && id.value === value)) {
              newIdentifiers.push({
                scheme,
                value,
                authority: existing.source,
                confidence: existing.match_confidence ?? undefined,
              });
            }
          }
          await this.db
            .update(entities)
            .set({ identifiers: newIdentifiers, updated_at: now })
            .where(eq(entities.id, existing.entity_id));
        }
      }
    }

    await this.db
      .update(screeningResults)
      .set(updates)
      .where(eq(screeningResults.id, screeningId));

    // Re-fetch
    const updated = await this.db
      .select()
      .from(screeningResults)
      .where(eq(screeningResults.id, screeningId));
    return toApiScreening(updated[0]);
  }

  // ─── Get screening results for an entity ─────────────────────────────────────

  async getByEntity(
    entityId: string,
    tenantId = "default",
    filters?: { source?: string; status?: string }
  ) {
    let rows;
    if (filters?.source && filters?.status) {
      rows = await this.db
        .select()
        .from(screeningResults)
        .where(
          and(
            eq(screeningResults.entity_id, entityId),
            eq(screeningResults.tenant_id, tenantId),
            eq(screeningResults.source, filters.source),
            eq(screeningResults.status, filters.status)
          )
        );
    } else if (filters?.source) {
      rows = await this.db
        .select()
        .from(screeningResults)
        .where(
          and(
            eq(screeningResults.entity_id, entityId),
            eq(screeningResults.tenant_id, tenantId),
            eq(screeningResults.source, filters.source)
          )
        );
    } else if (filters?.status) {
      rows = await this.db
        .select()
        .from(screeningResults)
        .where(
          and(
            eq(screeningResults.entity_id, entityId),
            eq(screeningResults.tenant_id, tenantId),
            eq(screeningResults.status, filters.status)
          )
        );
    } else {
      rows = await this.db
        .select()
        .from(screeningResults)
        .where(
          and(
            eq(screeningResults.entity_id, entityId),
            eq(screeningResults.tenant_id, tenantId)
          )
        );
    }
    return rows.map(toApiScreening);
  }

  // ─── Get a single screening result ────────────────────────────────────────────

  async getById(screeningId: string, tenantId = "default") {
    const rows = await this.db
      .select()
      .from(screeningResults)
      .where(
        and(
          eq(screeningResults.id, screeningId),
          eq(screeningResults.tenant_id, tenantId)
        )
      );
    if (rows.length === 0) {
      throw new NotFoundError(`Screening result ${screeningId} not found`);
    }
    return toApiScreening(rows[0]);
  }

  // ─── Resolve: find matches without creating a screening record ───────────────

  async resolve(input: ResolveInput, tenantId = "default") {
    const source = input.source ?? "dunl_spiq";
    if (!VALID_SOURCES.includes(source)) {
      throw new ValidationError(
        `Invalid source: ${source}. Must be one of: ${VALID_SOURCES.join(", ")}`
      );
    }

    if (!input.name || input.name.trim() === "") {
      throw new ValidationError("name is required");
    }

    const limit = input.limit ?? 5;
    const candidates = await this.findCandidates(
      {
        name: input.name,
        jurisdiction: input.jurisdiction,
        registration_number: input.registration_number,
        lei: input.lei,
      },
      source,
      tenantId,
      limit
    );

    return { candidates, source };
  }

  // ─── Import reference data ──────────────────────────────────────────────────

  async importReferenceData(
    input: ImportReferenceDataInput,
    tenantId = "default"
  ) {
    if (!VALID_SOURCES.includes(input.source)) {
      throw new ValidationError(
        `Invalid source: ${input.source}. Must be one of: ${VALID_SOURCES.join(", ")}`
      );
    }

    if (!input.records || input.records.length === 0) {
      throw new ValidationError("records array is required and must not be empty");
    }

    const now = this.getNow();
    let imported = 0;
    let updated = 0;

    for (const record of input.records) {
      if (!record.external_id || !record.name) {
        continue; // Skip invalid records
      }

      // Check if already exists
      const existing = await this.db
        .select()
        .from(referenceEntities)
        .where(
          and(
            eq(referenceEntities.source, input.source),
            eq(referenceEntities.external_id, record.external_id),
            eq(referenceEntities.tenant_id, tenantId)
          )
        );

      if (existing.length > 0) {
        // Update existing
        await this.db
          .update(referenceEntities)
          .set({
            name: record.name,
            legal_name: record.legal_name ?? null,
            jurisdiction: record.jurisdiction ?? null,
            entity_type: record.entity_type ?? null,
            status: record.status ?? null,
            identifiers: record.identifiers ?? null,
            metadata: record.metadata ?? null,
            updated_at: now,
          })
          .where(eq(referenceEntities.id, existing[0].id));
        updated++;
      } else {
        // Insert new
        await this.db.insert(referenceEntities).values({
          id: crypto.randomUUID(),
          tenant_id: tenantId,
          source: input.source,
          external_id: record.external_id,
          name: record.name,
          legal_name: record.legal_name ?? null,
          jurisdiction: record.jurisdiction ?? null,
          entity_type: record.entity_type ?? null,
          status: record.status ?? null,
          identifiers: record.identifiers ?? null,
          metadata: record.metadata ?? null,
          indexed_at: null,
          created_at: now,
          updated_at: now,
        });
        imported++;
      }
    }

    return { imported, updated, total: imported + updated, source: input.source };
  }

  // ─── Get reference data stats ────────────────────────────────────────────────

  async getReferenceStats(tenantId = "default") {
    const allRefs = await this.db
      .select()
      .from(referenceEntities)
      .where(eq(referenceEntities.tenant_id, tenantId));

    const bySource: Record<string, number> = {};
    for (const ref of allRefs) {
      bySource[ref.source] = (bySource[ref.source] ?? 0) + 1;
    }

    return {
      total: allRefs.length,
      by_source: bySource,
    };
  }

  // ─── Search reference entities ───────────────────────────────────────────────

  async searchReference(
    query: string,
    source?: ScreeningSource,
    tenantId = "default",
    limit = 20
  ) {
    // Use LIKE-based search as a baseline
    // QMD integration would replace this with hybrid search (BM25 + vector + rerank)
    const pattern = `%${query}%`;
    let rows;

    if (source) {
      rows = await this.db
        .select()
        .from(referenceEntities)
        .where(
          and(
            eq(referenceEntities.tenant_id, tenantId),
            eq(referenceEntities.source, source),
            or(
              like(referenceEntities.name, pattern),
              like(referenceEntities.external_id, pattern)
            )
          )
        );
    } else {
      rows = await this.db
        .select()
        .from(referenceEntities)
        .where(
          and(
            eq(referenceEntities.tenant_id, tenantId),
            or(
              like(referenceEntities.name, pattern),
              like(referenceEntities.external_id, pattern)
            )
          )
        );
    }

    return rows.slice(0, limit).map(toApiReference);
  }

  // ─── Train on internal data ──────────────────────────────────────────────────
  // Imports existing entities from the lender's data as reference entities
  // so they can be used for internal deduplication and matching.

  async trainOnInternalData(tenantId = "default") {
    const allEntities = await this.db
      .select()
      .from(entities)
      .where(eq(entities.tenant_id, tenantId));

    const now = this.getNow();
    let imported = 0;

    for (const entity of allEntities) {
      // Check if already exists as internal reference
      const existing = await this.db
        .select()
        .from(referenceEntities)
        .where(
          and(
            eq(referenceEntities.source, "internal"),
            eq(referenceEntities.external_id, entity.id),
            eq(referenceEntities.tenant_id, tenantId)
          )
        );

      const identifiers: Record<string, string> = {};
      if (entity.lei) identifiers.lei = entity.lei;
      if (entity.registration_number)
        identifiers.registration_number = entity.registration_number;
      if (entity.identifiers) {
        const extIds = entity.identifiers as Array<{
          scheme: string;
          value: string;
        }>;
        for (const id of extIds) {
          identifiers[id.scheme] = id.value;
        }
      }

      if (existing.length === 0) {
        await this.db.insert(referenceEntities).values({
          id: crypto.randomUUID(),
          tenant_id: tenantId,
          source: "internal",
          external_id: entity.id,
          name: entity.name,
          legal_name: entity.legal_name ?? null,
          jurisdiction: entity.jurisdiction ?? null,
          entity_type: entity.type,
          status: "active",
          identifiers: Object.keys(identifiers).length > 0 ? identifiers : null,
          metadata: null,
          indexed_at: null,
          created_at: now,
          updated_at: now,
        });
        imported++;
      } else {
        await this.db
          .update(referenceEntities)
          .set({
            name: entity.name,
            legal_name: entity.legal_name ?? null,
            jurisdiction: entity.jurisdiction ?? null,
            identifiers: Object.keys(identifiers).length > 0 ? identifiers : null,
            updated_at: now,
          })
          .where(eq(referenceEntities.id, existing[0].id));
      }
    }

    return { imported, total_entities: allEntities.length, source: "internal" };
  }

  // ─── Private: Find candidate matches in reference data ───────────────────────

  private async findCandidates(
    query: {
      name: string;
      jurisdiction?: string;
      registration_number?: string;
      lei?: string;
    },
    source: ScreeningSource,
    tenantId: string,
    limit: number
  ): Promise<MatchCandidate[]> {
    // Step 1: Try exact identifier match first (LEI, registration number)
    if (query.lei) {
      const leiRows = await this.db
        .select()
        .from(referenceEntities)
        .where(
          and(
            eq(referenceEntities.source, source),
            eq(referenceEntities.tenant_id, tenantId)
          )
        );

      for (const row of leiRows) {
        const ids = (row.identifiers as Record<string, string>) ?? {};
        if (ids.lei && ids.lei.toUpperCase() === query.lei.toUpperCase()) {
          return [
            {
              external_id: row.external_id,
              name: row.name,
              confidence: 1.0,
              identifiers: ids,
              metadata: (row.metadata as Record<string, unknown>) ?? {},
            },
          ];
        }
      }
    }

    // Step 2: Name-based fuzzy matching
    // Get all reference entities for this source and score them
    // In production, QMD would handle this with BM25 + vector + reranking
    const allRefs = await this.db
      .select()
      .from(referenceEntities)
      .where(
        and(
          eq(referenceEntities.source, source),
          eq(referenceEntities.tenant_id, tenantId)
        )
      );

    const scored: MatchCandidate[] = [];
    for (const ref of allRefs) {
      const confidence = computeMatchConfidence(query, {
        name: ref.name,
        jurisdiction: ref.jurisdiction,
        identifiers: ref.identifiers as Record<string, string> | null,
      });

      if (confidence > 0.3) {
        scored.push({
          external_id: ref.external_id,
          name: ref.name,
          confidence,
          identifiers: (ref.identifiers as Record<string, string>) ?? {},
          metadata: (ref.metadata as Record<string, unknown>) ?? {},
        });
      }
    }

    // Sort by confidence descending
    scored.sort((a, b) => b.confidence - a.confidence);
    return scored.slice(0, limit);
  }
}
