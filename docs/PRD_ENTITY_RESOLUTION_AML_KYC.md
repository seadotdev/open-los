# PRD: Entity Resolution for AML/KYC

**Priority:** HIGH
**Status:** Implemented (Phase 1)
**Author:** Open LOS
**Date:** 2026-03-14

---

## 1. Problem Statement

Lenders need to verify the identity of companies and persons during onboarding
(KYC — Know Your Customer) and continuously screen them for anti-money
laundering (AML) risks. Today, entity identification relies on manual processes
and fragmented identifier lookups across multiple registries.

Open LOS needs a built-in entity resolution system that can match any company
or person against open standard data sources, providing a deterministic,
auditable compliance workflow.

## 2. Solution Overview

### 2.1 Entity Resolution Engine

A hybrid matching system that resolves internal entities against external
reference data sources:

- **Exact identifier matching** — LEI, registration number, S&P Capital IQ ID
- **Fuzzy name matching** — Levenshtein distance + Jaccard token similarity
- **QMD hybrid search** (planned) — BM25 full-text + vector semantic + LLM reranking
  via [@tobilu/qmd](https://github.com/tobi/qmd) for production-grade matching

### 2.2 Open Standard Data Sources

| Source | Identifier | Coverage | Status |
|--------|-----------|----------|--------|
| **S&P Capital IQ via DUNL.org** | `spiq_id` | 25M+ companies globally | **Primary** |
| GLEIF LEI Registry | `lei` | 2.7M+ legal entities | Supported |
| UK Companies House | `companies_house` | 5M+ UK companies | Supported |
| OpenCorporates | `opencorporates` | 200M+ companies | Supported |
| Internal (lender data) | entity `id` | Tenant-specific | Supported |

**Why DUNL.org / S&P Capital IQ as the primary dataset:**

- 25M+ companies with unique, stable identifiers under Creative Commons license
- Cross-references to LEI, making it a universal linker
- Available via [dunl.org/c/company](https://dunl.org/c/company) in machine-readable
  formats (JSON-LD, RDF, Parquet)
- S&P Capital IQ ID is becoming the standard company identifier across financial
  data infrastructure

### 2.3 QMD Integration (Search Engine)

[QMD](https://github.com/tobi/qmd) provides the search backbone:

- **BM25 full-text search** for fast keyword matching
- **Vector semantic search** for handling name variations and abbreviations
- **LLM-powered reranking** for highest-quality results
- **Local-first** — all computation on-device, no external API calls
- **MCP server** integration for use with AI agents

**Architecture:**
```
Reference Data (DUNL Parquet) → QMD Collection → Indexed for Search
                                                      ↓
Entity Created/Updated → POST /v1/entities/:id/screen
                                                      ↓
                                              QMD Hybrid Search
                                                      ↓
                                          Screening Results + Candidates
                                                      ↓
                                    Human Review (confirm / reject)
                                                      ↓
                                  Entity identifiers enriched + Audit trail
```

### 2.4 Business Categorisation (Tag Cloud)

Independent of bureau-provided codes (SIC, NAICS, GICS), each entity can be
tagged across 10 dimensions:

| Dimension | Example Tags |
|-----------|-------------|
| **Business Sector** | Technology, Financial Services, Healthcare, ... |
| **Business Model** | B2B, SaaS, Marketplace, Asset-heavy, ... |
| **Company Stage** | Startup, Growth, Mature, Turnaround, ... |
| **Company Size** | Micro, Small, Medium, Large, Enterprise |
| **Geographic Reach** | Local, Regional, National, Multinational, Global |
| **Risk Profile** | Low Risk, Moderate, Elevated, High Risk, Prohibited |
| **ESG Classification** | Green, Social Impact, ESG Concern, ... |
| **Regulatory Status** | Regulated, Lightly Regulated, Government, ... |
| **Ownership Type** | Public, Private, PE-backed, Family-owned, SPV, ... |
| **Borrower Type** | Corporate, SME, Project Finance, Leveraged, ... |

Custom dimensions can be added via the API. Tags can be applied by:
- Human users (manual)
- AI agents (automated classification)
- Bureau data (imported)

### 2.5 Training on Internal Data

The system can learn from the lender's own entity database:

- `POST /v1/reference-data/train` snapshots all current entities as internal
  reference data
- Enables duplicate detection across the lender's portfolio
- Internal entities get the same matching treatment as external sources
- Supports deduplication workflows: "Is this borrower the same as one we
  already have?"

## 3. API Endpoints

### Entity Resolution

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/v1/resolve` | Stateless entity lookup (no record created) |
| `POST` | `/v1/entities/:id/screen` | Screen entity against sources (creates record) |
| `GET` | `/v1/entities/:id/screening` | Get screening results for entity |
| `GET` | `/v1/screening/:id` | Get single screening result |
| `POST` | `/v1/screening/:id/review` | Confirm or reject a match |

### Reference Data Management

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/v1/reference-data/import` | Import reference entities |
| `GET` | `/v1/reference-data/search?q=` | Search reference entities |
| `GET` | `/v1/reference-data/stats` | Get reference data statistics |
| `POST` | `/v1/reference-data/train` | Import internal entities as reference |

### Business Categorisation

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/v1/category-dimensions` | List all category dimensions and tags |
| `POST` | `/v1/entities/:id/tags` | Apply business tags to an entity |

## 4. Data Model

### New Tables

- **`screening_results`** — Records of entity screening checks with match
  candidates, confidence scores, review status, and audit trail
- **`reference_entities`** — Cached external entity records for offline/fast
  matching (from DUNL, Companies House, GLEIF, etc.)

### Extended Fields

- **`entities.tags`** — JSON array of business categorisation tags
  `[{dimension, tag, confidence?, source?}]`

## 5. Screening Workflow

```
1. Entity created (POST /v1/entities)
2. Screen initiated (POST /v1/entities/:id/screen)
   → System searches reference data for matches
   → Returns status: matched | partial | unmatched
3. If matched/partial → Human reviews candidates
4. Review submitted (POST /v1/screening/:id/review)
   → status: confirmed | rejected
5. If confirmed → Entity identifiers enriched automatically
   → Audit event recorded (ENTITY_SCREENED)
```

## 6. Conformance Tests

17 conformance tests covering:
- Reference data import and upsert
- Entity resolution by name and LEI
- Entity screening (matched, unmatched)
- Screening result retrieval
- Human review (confirm, reject)
- Reference data search
- Internal data training
- Validation (missing name, invalid source, empty records)
- Audit trail integration

## 7. Phase 2 Roadmap

- [ ] **Parquet ingestion** — Download and parse S&P Capital IQ Parquet from
  DUNL.org directly via CLI/API
- [ ] **QMD production integration** — Replace LIKE-based search with QMD's
  hybrid BM25 + vector + LLM reranking pipeline
- [ ] **Sanctions/PEP screening** — Integrate OFAC SDN list, UN Sanctions,
  EU Consolidated List
- [ ] **Adverse media screening** — News-based risk signal detection
- [ ] **Ongoing monitoring** — Periodic re-screening on a schedule
- [ ] **Bulk screening** — Screen all entities in a deal's borrower group
- [ ] **Spreadsheet dimension import** — Import custom category dimensions
  from CSV/Google Sheets
- [ ] **MCP tool** — Expose entity resolution as an MCP tool for AI agents

## 8. Dependencies

| Package | Purpose |
|---------|---------|
| `@tobilu/qmd` | Hybrid search engine (BM25 + vector + LLM reranking) |
| `parquet-wasm` or `duckdb-wasm` | Parquet file parsing for DUNL.org data |

## 9. References

- [DUNL.org — S&P Capital IQ Company Data](https://dunl.org/c/company)
- [S&P Global Press Release](https://press.spglobal.com/2025-09-11-S-P-Global-ushers-new-era-of-open-data-access-Introduces-S-P-Capital-IQ-Identifiers-on-DUNL-org)
- [QMD — Local-first Search Engine](https://github.com/tobi/qmd)
- [GLEIF — Global Legal Entity Identifier Foundation](https://www.gleif.org)
