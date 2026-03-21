import { and, eq } from "drizzle-orm";
import type { Database } from "../schema/db.js";
import { entities } from "../schema/tables.js";
import { ValidationError } from "./errors.js";

export interface EntityResolutionQuery {
  name?: string;
  registration_number?: string;
  lei?: string;
  jurisdiction?: string;
  limit?: number;
}

export interface EntityResolutionCandidate {
  entity_id: string;
  type: "company" | "person";
  name: string;
  legal_name?: string | null;
  registration_number?: string | null;
  lei?: string | null;
  jurisdiction?: string | null;
  score: number;
  match_reasons: string[];
  source: "local_entities";
}

export interface EntityResolutionBackend {
  resolve(
    query: Required<Pick<EntityResolutionQuery, "limit">> & Omit<EntityResolutionQuery, "limit">,
    tenantId: string
  ): Promise<EntityResolutionCandidate[]>;
}

function normalize(value?: string | null): string | null {
  const normalized = value?.trim().toLowerCase();
  return normalized ? normalized : null;
}

function tokenize(value?: string | null): string[] {
  return normalize(value)?.split(/[^a-z0-9]+/).filter(Boolean) ?? [];
}

function scoreNameMatch(queryName: string | undefined, entityName: string, legalName?: string | null) {
  const normalizedQuery = normalize(queryName);
  if (!normalizedQuery) {
    return { score: 0, reasons: [] as string[] };
  }

  const candidates = [entityName, legalName].filter((value): value is string => Boolean(value));
  const reasons: string[] = [];
  let bestScore = 0;

  for (const candidate of candidates) {
    const normalizedCandidate = normalize(candidate);
    if (!normalizedCandidate) continue;

    if (normalizedCandidate === normalizedQuery) {
      bestScore = Math.max(bestScore, 0.92);
      reasons.push("exact_name");
      continue;
    }

    if (normalizedCandidate.includes(normalizedQuery) || normalizedQuery.includes(normalizedCandidate)) {
      bestScore = Math.max(bestScore, 0.72);
      reasons.push("partial_name");
      continue;
    }

    const queryTokens = new Set(tokenize(normalizedQuery));
    const overlap = tokenize(normalizedCandidate).filter((token) => queryTokens.has(token)).length;
    if (overlap > 0) {
      bestScore = Math.max(bestScore, Math.min(0.65, 0.35 + overlap * 0.15));
      reasons.push("token_overlap");
    }
  }

  return { score: bestScore, reasons: [...new Set(reasons)] };
}

export class LocalEntityResolutionBackend implements EntityResolutionBackend {
  constructor(private db: Database) {}

  async resolve(
    query: Required<Pick<EntityResolutionQuery, "limit">> & Omit<EntityResolutionQuery, "limit">,
    tenantId: string
  ): Promise<EntityResolutionCandidate[]> {
    const rows = await this.db
      .select()
      .from(entities)
      .where(and(eq(entities.tenant_id, tenantId)));

    const normalizedLei = normalize(query.lei);
    const normalizedReg = normalize(query.registration_number);
    const normalizedJurisdiction = normalize(query.jurisdiction);

    const candidates: EntityResolutionCandidate[] = [];

    for (const entity of rows) {
      const matchReasons: string[] = [];
      let score = 0;

      if (normalizedLei && normalize(entity.lei) === normalizedLei) {
        score = Math.max(score, 1);
        matchReasons.push("exact_lei");
      }

      if (normalizedReg && normalize(entity.registration_number) === normalizedReg) {
        score = Math.max(score, 0.98);
        matchReasons.push("exact_registration_number");
      }

      const nameMatch = scoreNameMatch(query.name, entity.name, entity.legal_name);
      score = Math.max(score, nameMatch.score);
      matchReasons.push(...nameMatch.reasons);

      if (normalizedJurisdiction && normalize(entity.jurisdiction) === normalizedJurisdiction) {
        score = Math.min(score + 0.02, 1);
        matchReasons.push("exact_jurisdiction");
      }

      if (score <= 0) {
        continue;
      }

      candidates.push({
        entity_id: entity.id,
        type: entity.type as "company" | "person",
        name: entity.name,
        legal_name: entity.legal_name,
        registration_number: entity.registration_number,
        lei: entity.lei,
        jurisdiction: entity.jurisdiction,
        score: Number(score.toFixed(3)),
        match_reasons: [...new Set(matchReasons)],
        source: "local_entities" as const,
      });
    }

    return candidates
      .sort((left, right) => right.score - left.score || left.name.localeCompare(right.name))
      .slice(0, query.limit);
  }
}

export class EntityResolutionService {
  private backend: EntityResolutionBackend;

  constructor(db: Database, backend?: EntityResolutionBackend) {
    this.backend = backend ?? new LocalEntityResolutionBackend(db);
  }

  async resolve(query: EntityResolutionQuery, tenantId = "default") {
    const normalizedQuery = {
      name: query.name?.trim() || undefined,
      registration_number: query.registration_number?.trim() || undefined,
      lei: query.lei?.trim() || undefined,
      jurisdiction: query.jurisdiction?.trim() || undefined,
      limit: Math.max(1, Math.min(query.limit ?? 5, 20)),
    };

    if (!normalizedQuery.name && !normalizedQuery.registration_number && !normalizedQuery.lei) {
      throw new ValidationError("at least one of name, registration_number, or lei is required");
    }

    const candidates = await this.backend.resolve(normalizedQuery, tenantId);
    return { candidates };
  }
}
