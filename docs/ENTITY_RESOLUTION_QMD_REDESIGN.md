# Entity Resolution Redesign: QMD-Native Search Backend

**Supersedes:** PR #76 (Entity Resolution & AML/KYC Screening)
**Status:** Implementation Plan
**Date:** 2026-03-14

---

## Context

PR #76 introduced an entity resolution and AML/KYC screening system with a
hand-rolled matching engine (Levenshtein + Jaccard + full-table scans). This
redesign replaces the custom matching backend with [QMD](https://github.com/tobi/qmd),
a local-first hybrid search engine, while preserving the screening workflow,
audit trail, and review state machine from the original PR.

## What to Keep from PR #76

The following components are well-designed and should be carried forward
unchanged (or with minor adjustments):

- **Screening workflow state machine:** `screen → match → human review → enrich`
- **`screening_results` table** with status, candidates, confidence, review fields
- **Review endpoint** (`POST /v1/screening/:id/review`) with confirm/reject flow
- **Entity identifier enrichment** on confirmed match
- **Audit trail integration** (`ENTITY_SCREENED` events linked to deals)
- **Conformance tests** for the workflow (adapt to new search backend)

## What to Remove

Delete entirely from PR #76:

- `normalizeName()`, `levenshtein()`, `jaccardSimilarity()`, `computeMatchConfidence()`
- `findCandidates()` — the full-table-scan matching loop
- `searchReference()` — the `LIKE '%query%'` search
- `trainOnInternalData()` — replaced by QMD collection indexing
- `reference_entities` SQL table — reference data lives in QMD's index

## What to Change

### 1. Reference Data → QMD Collections

Instead of storing reference entities in a SQL table, render them as markdown
documents and index them in QMD collections. Each data source becomes a
named collection.

**Directory structure:**
```
data/reference/
├── dunl_spiq/          ← QMD collection "dunl_spiq"
│   ├── SPIQ-123456.md
│   ├── SPIQ-789012.md
│   └── ...
├── companies_house/    ← QMD collection "companies_house"
│   ├── 08012345.md
│   └── ...
├── gleif_lei/          ← QMD collection "gleif_lei"
│   └── ...
└── internal/           ← QMD collection "internal"
    └── ...
```

**Document format** (one file per reference entity):
```markdown
# Acme Corporation Ltd

| Field | Value |
|-------|-------|
| External ID | SPIQ-123456 |
| Legal Name | Acme Corporation Limited |
| Jurisdiction | GB |
| Entity Type | company |
| Status | active |

## Identifiers

- LEI: 5493001KJTIIGC8Y1R12
- Companies House: 08012345
- DUNS: 123456789

## Metadata

- SIC: 6211 (Security Brokers, Dealers, and Flotation Companies)
- NAICS: 523110 (Investment Banking and Securities Dealing)
- GICS: 40203010 (Investment Banking & Brokerage)
- Sector: Financial Services
- Employee Count: 251-1K
- Revenue Range: $50M-$100M
```

This gives QMD:
- **BM25** over all fields (name, identifiers, codes, metadata)
- **Vector embeddings** that understand "Acme Corp" ≈ "Acme Corporation Ltd"
- **LLM reranking** for the hardest cases (parent vs subsidiary, abbreviations)

### 2. Import Pipeline

**For DUNL.org / S&P Capital IQ (Parquet):**
```
DUNL Parquet file
    → parse with duckdb-wasm or parquet-wasm
    → render each record to markdown file
    → store.addCollection("dunl_spiq", { path: "./data/reference/dunl_spiq" })
    → store.update()
    → store.embed()
```

**For other sources (JSON/API):**
```
API response / JSON file
    → render each record to markdown file
    → store.update({ collections: ["companies_house"] })
    → store.embed()
```

**For internal data (portfolio dedup):**
```
SELECT * FROM entities WHERE tenant_id = ?
    → render each entity to markdown file in data/reference/internal/
    → store.update({ collections: ["internal"] })
    → store.embed()
```

The `POST /v1/reference-data/import` endpoint stays but writes markdown files
and triggers QMD indexing instead of SQL inserts.

### 3. Entity Resolution Service — Search Backend

Replace `findCandidates()` with QMD search. The service should try three
strategies in order:

```typescript
import { createStore } from '@tobilu/qmd';

class EntityResolutionService {
  private store: QMDStore;

  async findCandidates(
    query: { name: string; jurisdiction?: string; lei?: string; registration_number?: string },
    source: ScreeningSource,
    limit: number
  ): Promise<MatchCandidate[]> {

    // Strategy 1: Exact identifier lookup (fast, deterministic)
    if (query.lei || query.registration_number) {
      const idQuery = query.lei ?? query.registration_number;
      const exact = await this.store.searchLex(idQuery, {
        collection: source,
        limit: 1,
      });
      if (exact.length > 0 && exact[0].score > 0.9) {
        return [this.toCandidate(exact[0], 1.0, "exact_id")];
      }
    }

    // Strategy 2: QMD hybrid search (BM25 + vector + reranking)
    const intent = query.jurisdiction
      ? `Find the company "${query.name}" registered in ${query.jurisdiction}`
      : `Find the company "${query.name}"`;

    const results = await this.store.search({
      query: query.name,
      intent,
      collection: source,
      limit,
      minScore: 0.3,
    });

    return results.map(r => this.toCandidate(r, r.score, "qmd_hybrid"));
  }

  private toCandidate(result: SearchResult, confidence: number, method: MatchMethod): MatchCandidate {
    // Parse the markdown document back to structured fields
    const parsed = parseReferenceDocument(result.content);
    return {
      external_id: parsed.external_id,
      name: parsed.name,
      confidence,
      method,
      identifiers: parsed.identifiers,
      metadata: parsed.metadata,
    };
  }
}
```

### 4. QMD Store Lifecycle

Initialize the QMD store at application startup alongside the database:

```typescript
// packages/core/src/services/qmd-store.ts

import { createStore, type QMDStore } from '@tobilu/qmd';
import path from 'path';

export async function createQMDStore(dataDir: string): Promise<QMDStore> {
  const store = await createStore({
    dbPath: path.join(dataDir, 'qmd-index.sqlite'),
    config: {
      collections: {
        dunl_spiq: { path: path.join(dataDir, 'reference/dunl_spiq'), pattern: '**/*.md' },
        companies_house: { path: path.join(dataDir, 'reference/companies_house'), pattern: '**/*.md' },
        gleif_lei: { path: path.join(dataDir, 'reference/gleif_lei'), pattern: '**/*.md' },
        opencorporates: { path: path.join(dataDir, 'reference/opencorporates'), pattern: '**/*.md' },
        internal: { path: path.join(dataDir, 'reference/internal'), pattern: '**/*.md' },
      },
    },
  });

  return store;
}
```

Wire into `AppContext` in `server.ts`:

```typescript
const qmdStore = await createQMDStore(dataDir);
const entityResolutionService = new EntityResolutionService(db, audit, getNow, qmdStore);
```

### 5. MCP Server Integration

QMD's built-in MCP server exposes `query`, `get`, `multi_get`, and `status`
tools. This means AI agents can search reference data directly without going
through the REST API.

Configure in the project's MCP settings:
```json
{
  "mcpServers": {
    "entity-reference": {
      "command": "qmd",
      "args": ["mcp", "--http", "--port", "8182"]
    }
  }
}
```

This gives agents access to all reference data collections for:
- Pre-screening entity lookups during onboarding
- Portfolio deduplication checks
- Ad-hoc company research

No custom MCP tool implementation needed — QMD provides this out of the box.

### 6. Industry Standard Codes (Alongside Tag Cloud)

The tag cloud from PR #76 (sector, business model, risk profile, etc.) is
valuable as a **lender-specific overlay**. Keep it, but also support standard
industry classification codes as first-class structured data.

**Add to the `entities` table:**
```sql
ALTER TABLE entities ADD COLUMN industry_codes TEXT;
-- JSON: { sic?: string, naics?: string, gics?: string }
```

**Why both?**
- Standard codes (SIC/NAICS/GICS) are required for regulatory reporting,
  portfolio concentration analysis, and peer benchmarking
- Custom tags (risk profile, borrower type, ESG) capture lender-specific
  knowledge that codes don't express
- Reference data from DUNL.org and Companies House already includes SIC/GICS
  codes — extract and store them on match confirmation

**Reference for valid codes:**
- GICS: 171 sub-industries (8-digit codes per S&P/MSCI standard)
- SIC: ~1,006 codes (4-digit per SEC/BLS)
- NAICS: ~1,013 codes (6-digit per US Census Bureau 2022)

These are published standards — no need to embed lookup tables. Validate
format (digit count) on input; display labels can be resolved at the UI layer.

### 7. Thin Lookup Table for Exact-Match Identifiers

While QMD handles all fuzzy/semantic search, keep a thin SQL table for
sub-millisecond exact identifier lookups (LEI, registration number):

```sql
CREATE TABLE IF NOT EXISTS reference_identifiers (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL DEFAULT 'default',
  source TEXT NOT NULL,          -- "dunl_spiq", "companies_house", etc.
  identifier_type TEXT NOT NULL, -- "lei", "registration_number", "spiq_id"
  identifier_value TEXT NOT NULL,
  external_id TEXT NOT NULL,     -- links to the QMD document
  name TEXT NOT NULL,            -- denormalized for display
  UNIQUE(source, identifier_type, identifier_value, tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_ref_id_lookup
  ON reference_identifiers(identifier_type, identifier_value);
```

This table is populated during import (alongside QMD indexing) and queried
before falling back to QMD hybrid search.

## API Changes from PR #76

### Keep As-Is
| Method | Path | Notes |
|--------|------|-------|
| `POST` | `/v1/entities/:id/screen` | No change |
| `GET` | `/v1/entities/:id/screening` | No change |
| `GET` | `/v1/screening/:id` | No change |
| `POST` | `/v1/screening/:id/review` | No change |
| `POST` | `/v1/entities/:id/tags` | No change (but route through EntityService) |
| `GET` | `/v1/category-dimensions` | No change |

### Modify
| Method | Path | Change |
|--------|------|--------|
| `POST` | `/v1/resolve` | Backend switches to QMD; add `mode` param: `"keyword"`, `"semantic"`, `"hybrid"` (default) |
| `POST` | `/v1/reference-data/import` | Writes markdown + triggers QMD indexing instead of SQL inserts |
| `GET` | `/v1/reference-data/search` | Proxies QMD search; add `mode`, `minScore`, `explain` params |
| `GET` | `/v1/reference-data/stats` | Query QMD `status` + identifier table counts |
| `POST` | `/v1/reference-data/train` | Renders internal entities to markdown + QMD index |

### Remove
| Method | Path | Reason |
|--------|------|--------|
| — | `reference_entities` table | Replaced by QMD collections |

## Implementation Steps

### Phase 1: Core QMD Integration (this PR's scope)

1. **Add `@tobilu/qmd` dependency** to `packages/core/package.json`
2. **Create `qmd-store.ts`** — store initialization, collection setup, lifecycle
3. **Create `reference-document.ts`** — render/parse reference entity ↔ markdown
4. **Rewrite `entity-resolution.ts`:**
   - Remove all hand-rolled matching functions
   - `findCandidates()` → QMD `store.search()` / `store.searchLex()`
   - `importReferenceData()` → write markdown files + `store.update()` + `store.embed()`
   - `trainOnInternalData()` → render entities to markdown + QMD index
   - `searchReference()` → `store.search()` with mode parameter
5. **Add `reference_identifiers` table** for exact-match fast path
6. **Add `industry_codes` column** to `entities` table
7. **Update `screening.ts` routes:**
   - Fix tag endpoint to go through EntityService
   - Add `mode` parameter to resolve/search endpoints
   - Remove raw drizzle-orm dynamic imports
8. **Update conformance tests** to exercise QMD-backed search
9. **Update OpenAPI spec** with new parameters

### Phase 2: Data Ingestion (follow-up PR)

1. **DUNL.org Parquet ingestion** — download, parse, render to markdown, index
2. **Companies House bulk import** — streaming JSON → markdown → QMD
3. **GLEIF LEI bulk import** — CSV/JSON → markdown → QMD
4. **Scheduled re-indexing** — cron job to refresh reference data

### Phase 3: Screening Enhancements (follow-up PR)

1. **Sanctions/PEP screening** — OFAC SDN, UN Sanctions as QMD collections
2. **Adverse media** — news articles as QMD documents, search for entity mentions
3. **Ongoing monitoring** — periodic re-screening on schedule
4. **Bulk screening** — screen all entities in a deal's borrower group

## Dependencies

| Package | Purpose | Version |
|---------|---------|---------|
| `@tobilu/qmd` | Hybrid search engine (BM25 + vector + LLM reranking) | latest |
| `duckdb-wasm` | Parquet file parsing for DUNL.org data (Phase 2) | latest |

## Architecture Diagram

```
DUNL.org Parquet ──┐
Companies House ───┤── render to ──► QMD Collections ──► QMD Index (SQLite)
GLEIF LEI ─────────┤   markdown       (per source)       BM25 + Vec + Rerank
OpenCorporates ────┤                                            │
Internal entities ─┘                                            │
                                           ┌────────────────────┼──────────────────┐
                                           │                    │                  │
                                     store.search()       MCP server         CLI (qmd query)
                                           │              (built-in)
                                           │
    reference_identifiers ──► exact ID fast path
                                           │
                                 EntityResolutionService
                                 ┌─────────┴──────────┐
                                 │  screen()           │
                                 │  1. exact ID check  │
                                 │  2. QMD hybrid      │
                                 │  3. confidence map   │
                                 └─────────┬──────────┘
                                           │
                                 screening_results table
                                 (workflow state machine)
                                           │
                                 Human review (confirm/reject)
                                           │
                                 Entity enrichment + audit trail
```

## References

- [QMD — Local-first Search Engine](https://github.com/tobi/qmd)
- [DUNL.org — S&P Capital IQ Company Data](https://dunl.org/c/company)
- [GLEIF — Global LEI Foundation](https://www.gleif.org)
- [GICS — Global Industry Classification Standard](https://www.msci.com/our-solutions/indexes/gics)
- PR #76: Original entity resolution implementation
