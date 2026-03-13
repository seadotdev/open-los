# PRD: Graph Neural Network & ML Platform for Borrower Intelligence

> **Status:** Draft
> **Last Updated:** 2026-03-13
> **Authors:** Architecture Review

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Problem Statement](#2-problem-statement)
3. [Design Philosophy: Palantir-Inspired Ontology](#3-design-philosophy-palantir-inspired-ontology)
4. [System Architecture](#4-system-architecture)
5. [Graph Data Model](#5-graph-data-model)
6. [GNN Layer: Borrower Intelligence](#6-gnn-layer-borrower-intelligence)
7. [Small Language Model Layer: Document Understanding](#7-small-language-model-layer-document-understanding)
8. [Hybrid GNN-SLM Pipeline](#8-hybrid-gnn-slm-pipeline)
9. [Training Infrastructure](#9-training-infrastructure)
10. [API Design](#10-api-design)
11. [Privacy, Security & Compliance](#11-privacy-security--compliance)
12. [Implementation Roadmap](#12-implementation-roadmap)
13. [Success Metrics](#13-success-metrics)
14. [Appendix: Technology References](#14-appendix-technology-references)

---

## 1. Executive Summary

### Vision

Build a **graph-native ML substrate** within Open LOS that treats borrower relationships, financial flows, and document content as a unified knowledge graph — then trains small, self-hosted models against it. The system draws from Palantir Foundry's ontology-first approach (entities, links, actions as first-class primitives) but implements it as an open, embeddable layer rather than a monolithic platform.

### Why Now

Open LOS already has the raw ingredients:
- **Entity graph** — companies, people, relationships with ownership percentages
- **Financial spreads** — P&L, balance sheet line items, computed ratios per entity per period
- **Bank transactions** — categorised inflows/outflows per deal
- **Covenants & tests** — structured pass/fail data over time
- **Audit trail** — every mutation attributed to actor + timestamp
- **28-table schema** — rich relational structure begging to become a knowledge graph

What's missing is the **intelligence layer** that learns from this data rather than just storing it.

### Key Insight

> Palantir's power comes not from any single ML model but from the **ontology** — a typed, linked, versioned graph that makes every model's input/output legible to every other model. We can build this same substrate at 1/1000th the cost by leveraging Open LOS's existing schema as the ontology backbone, adding GNN message-passing for relational reasoning, and fine-tuning small language models (1B-3B params) for document extraction — all self-hosted, all auditable.

---

## 2. Problem Statement

### Current State

| Capability | Status | Gap |
|-----------|--------|-----|
| Entity relationships | Stored as rows in `relationships` table | No graph traversal, no inferred connections |
| Bank statements | Ingested as `bank_transactions` | No categorisation intelligence, no pattern detection |
| Financial spreads | Deterministic ratio computation | No trend prediction, no cross-entity comparison |
| Covenant monitoring | Rule-based pass/fail | No early warning, no probability of breach |
| Document processing | Manual upload + metadata | No automated extraction from bank statements/P&Ls |
| Fraud detection | None | No relationship-based anomaly detection |

### Target State

A lending analyst (human or AI agent) asks: *"Should we be worried about this borrower?"* The system:

1. **Traverses the entity graph** — finds connected companies, guarantors, directors, shared addresses
2. **Runs GNN inference** — computes a risk embedding that encodes structural position, financial health, and behavioural patterns across the graph neighbourhood
3. **Extracts from documents** — an SLM has already parsed uploaded bank statements into structured transactions, flagging anomalies
4. **Synthesises** — returns a risk score, contributing factors, comparable borrowers, and a natural-language explanation

All of this runs on the lender's own infrastructure. No data leaves the building.

---

## 3. Design Philosophy: Palantir-Inspired Ontology

### 3.1 Ontology as the Unifying Layer

Palantir Foundry's core insight: **the ontology is not a database — it's an operational layer that connects digital assets to their real-world counterparts**. Their ontology has three layers:

| Layer | Palantir Concept | Open LOS Equivalent |
|-------|-----------------|---------------------|
| **Semantic** | Object types, properties, link types | `entities`, `relationships`, `deals`, `spreads`, `bank_transactions` tables — already defined |
| **Kinetic** | Actions, functions, workflows | Stage transitions, covenant tests, approval gates — already implemented |
| **Dynamic** | Security, derived properties, live computation | Tenant isolation, computed ratios, liquidity analysis — partially implemented |

**Our approach:** Rather than building a separate ontology service, we **promote the existing schema** to ontology status by adding:
- **Graph indices** for efficient traversal (entity → relationships → connected entities)
- **Embedding columns** for GNN-computed vector representations
- **Typed link semantics** beyond the current `owns | guarantees | directs`
- **Temporal versioning** so the graph has a time dimension (spreads already have periods; extend this pattern)

### 3.2 Key Ontology Principles (adapted from Palantir)

1. **Entities are long-lived and meaningful** — Don't create an entity type for every CSV column. An entity must represent something a lending analyst would recognise: a company, a person, a facility, a bank account.

2. **Relationships are first-class, not foreign keys** — In the current schema, `relationships` has `from_entity_id`, `to_entity_id`, `type`, `ownership_pct`. This is already correct. We extend with: `effective_from`, `effective_until`, `confidence`, `source` (human-entered vs. ML-inferred).

3. **Avoid entity overload** — Don't embed 200 features into a single entity. Core identity fields on the entity; financial time-series in spreads; behavioural signals in a new `entity_signals` table.

4. **Links have weight and direction** — Ownership is directed (A owns B). Guarantee is directed (A guarantees B's loan). Transaction flow is directed (money flows from A to B). These directions matter for GNN message-passing.

5. **Every ML output is an entity or property, never a side-channel** — When the GNN computes a risk score, it's written as a property on the entity. When the SLM extracts a transaction, it becomes a `bank_transaction` row. Downstream consumers don't need to know ML was involved.

---

## 4. System Architecture

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                           Open LOS Core (existing)                          │
│  ┌─────────┐ ┌───────────┐ ┌──────────┐ ┌───────────┐ ┌────────────────┐   │
│  │ Entities │ │  Spreads  │ │ Bank Txn │ │ Covenants │ │ Audit Events   │   │
│  └────┬─────┘ └─────┬─────┘ └────┬─────┘ └─────┬─────┘ └───────┬────────┘   │
│       │             │            │              │               │            │
│  ┌────▼─────────────▼────────────▼──────────────▼───────────────▼────────┐   │
│  │                    Ontology Sync Layer (new)                          │   │
│  │  - Watches table changes via audit events                            │   │
│  │  - Maintains graph index (adjacency lists)                           │   │
│  │  - Computes temporal snapshots                                       │   │
│  │  - Emits graph-change events for downstream consumers                │   │
│  └──────────────────────────┬───────────────────────────────────────────┘   │
│                             │                                               │
├─────────────────────────────┼───────────────────────────────────────────────┤
│                     ML Substrate (new)                                      │
│                             │                                               │
│  ┌──────────────────────────▼───────────────────────────────────────────┐   │
│  │                     Graph Store                                      │   │
│  │  - In-memory adjacency for inference (NetworkX / rustworkx)          │   │
│  │  - Node features: entity properties + spread ratios + txn stats      │   │
│  │  - Edge features: relationship type + ownership_pct + direction       │   │
│  │  - Temporal slicing: graph-at-time-T for training                    │   │
│  └────────────┬────────────────────────────────┬────────────────────────┘   │
│               │                                │                            │
│  ┌────────────▼──────────────┐  ┌──────────────▼─────────────────────┐     │
│  │   GNN Engine              │  │   SLM Engine                       │     │
│  │                           │  │                                    │     │
│  │  Models:                  │  │  Models:                           │     │
│  │  - GraphSAGE (inductive)  │  │  - Phi-3.5-mini (3.8B) or         │     │
│  │  - GAT (attention-based)  │  │    Llama-3.2 (1B/3B) for          │     │
│  │  - GCN (baseline)         │  │    document extraction             │     │
│  │                           │  │  - FinBERT (110M) for              │     │
│  │  Tasks:                   │  │    sentiment/classification        │     │
│  │  - Node classification    │  │                                    │     │
│  │    (default risk)         │  │  Tasks:                            │     │
│  │  - Link prediction        │  │  - Bank statement parsing          │     │
│  │    (hidden relationships) │  │  - P&L / BS extraction             │     │
│  │  - Anomaly detection      │  │  - Covenant doc interpretation     │     │
│  │    (fraud patterns)       │  │  - Transaction categorisation      │     │
│  │  - Graph classification   │  │  - Narrative summarisation         │     │
│  │    (deal risk scoring)    │  │                                    │     │
│  └────────────┬──────────────┘  └──────────────┬─────────────────────┘     │
│               │                                │                            │
│  ┌────────────▼────────────────────────────────▼─────────────────────┐     │
│  │              Prediction Store                                     │     │
│  │  - Versioned model outputs (entity_id, model, version, output)    │     │
│  │  - Embeddings for similarity search                               │     │
│  │  - Explanation traces for audit                                   │     │
│  │  - Written back to core tables (scores, extracted data)           │     │
│  └───────────────────────────────────────────────────────────────────┘     │
│                                                                             │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Key Architectural Decisions

| Decision | Rationale |
|----------|-----------|
| **Python ML layer, TypeScript core** | GNN/SLM ecosystem is Python-native (PyTorch Geometric, HuggingFace). Core remains TypeScript. Communication via REST API + shared SQLite/LibSQL. |
| **Inference in-process, training offline** | Inference runs as a sidecar or embedded service. Training is a batch job (notebook or script). No GPU required for inference on small models. |
| **Graph store is a cache, not source of truth** | SQLite tables remain the source of truth. The graph store is rebuilt from tables on startup and kept in sync via audit events. Crash = rebuild, not data loss. |
| **Models are artifacts, not services** | Following Palantir's model integration pattern: a model is a versioned artifact (ONNX/SafeTensors file) registered in a model registry. Multiple models can be deployed simultaneously. |
| **SLMs over LLMs** | 1B-3B parameter models can run on CPU. No API dependency. No data exfiltration risk. Fine-tuned on lending-specific data, they outperform general-purpose LLMs on structured extraction tasks. |

---

## 5. Graph Data Model

### 5.1 Node Types (mapped from existing schema)

| Node Type | Source Table | Key Features (for GNN) |
|-----------|-------------|----------------------|
| `Company` | `entities` (type=company) | jurisdiction, registration_number, sector |
| `Person` | `entities` (type=person) | role, directorship count |
| `Deal` | `deals` | stage, requested_amount, purpose, age_days |
| `Facility` | `facilities` | type, amount, rate, term, status |
| `LoanAccount` | `loan_accounts` | state, principal_outstanding, days_in_arrears |
| `BankAccount` | `deposit_accounts` | type, balance, status |

### 5.2 Edge Types (mapped from existing schema)

| Edge Type | Source | Direction | Weight |
|-----------|--------|-----------|--------|
| `OWNS` | `relationships` (type=owns) | company → company | ownership_pct |
| `GUARANTEES` | `relationships` (type=guarantees) | entity → entity | - |
| `DIRECTS` | `relationships` (type=directs) | person → company | - |
| `BORROWS` | `deals` + `entities` | company → deal | requested_amount |
| `SECURED_BY` | `facilities` | deal → facility | amount |
| `TRANSACTS` | `bank_transactions` | deal → bank_account | net_flow |
| `COVENANTED` | `covenants` | deal → covenant | threshold |

### 5.3 Temporal Features (derived)

For each node, we compute time-series features aggregated from related tables:

**Company node features (per period):**
```
{
  // From spreads table
  revenue: number,
  ebitda: number,
  dscr: number,
  leverage_ratio: number,
  current_ratio: number,

  // From bank_transactions (aggregated)
  monthly_inflow: number,
  monthly_outflow: number,
  transaction_count: number,
  inflow_volatility: number,    // stddev of monthly inflows
  concentration_index: number,  // HHI of income sources

  // From covenant_tests
  covenant_pass_rate: number,   // % of tests passed in period
  worst_covenant_headroom: number,

  // Derived
  cash_runway_months: number,
  revenue_trend_3m: number,     // slope of 3-month revenue
}
```

### 5.4 New Tables Required

```sql
-- Entity-level ML signals (computed by GNN/SLM pipeline)
CREATE TABLE entity_signals (
  id TEXT PRIMARY KEY,
  entity_id TEXT NOT NULL REFERENCES entities(id),
  signal_type TEXT NOT NULL,
  -- "risk_score" | "fraud_probability" | "default_probability"
  -- "cluster_id" | "embedding" | "anomaly_score"
  value REAL,
  vector BLOB,           -- for embedding storage (float32 array)
  model_id TEXT NOT NULL, -- which model produced this
  model_version TEXT NOT NULL,
  confidence REAL,
  explanation TEXT,       -- human-readable explanation
  computed_at TEXT NOT NULL,
  valid_until TEXT,       -- signals expire; must be recomputed
  created_at TEXT NOT NULL
);

-- Model registry (Palantir-style model artifacts)
CREATE TABLE ml_models (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,            -- "borrower-risk-gnn-v2"
  type TEXT NOT NULL,            -- "gnn" | "slm" | "classifier" | "extractor"
  architecture TEXT,             -- "GraphSAGE" | "GAT" | "phi-3.5-mini"
  version TEXT NOT NULL,
  artifact_path TEXT,            -- path to model weights
  artifact_checksum TEXT,
  training_config TEXT,          -- JSON: hyperparameters, data splits
  training_metrics TEXT,         -- JSON: loss, accuracy, AUC, etc.
  status TEXT NOT NULL DEFAULT 'staging',
  -- "staging" | "production" | "deprecated" | "archived"
  promoted_at TEXT,
  promoted_by TEXT,
  created_at TEXT NOT NULL
);

-- Extraction results (SLM outputs — bank statement parsing, etc.)
CREATE TABLE ml_extractions (
  id TEXT PRIMARY KEY,
  document_id TEXT REFERENCES documents(id),
  deal_id TEXT REFERENCES deals(id),
  model_id TEXT NOT NULL REFERENCES ml_models(id),
  extraction_type TEXT NOT NULL,
  -- "bank_statement" | "profit_and_loss" | "balance_sheet" | "covenant_doc"
  raw_output TEXT,        -- JSON: raw model output
  structured_output TEXT, -- JSON: normalised, validated extraction
  confidence REAL,
  review_status TEXT NOT NULL DEFAULT 'pending',
  -- "pending" | "accepted" | "rejected" | "corrected"
  reviewed_by TEXT,
  reviewed_at TEXT,
  corrections TEXT,       -- JSON: human corrections (training signal)
  created_at TEXT NOT NULL
);

-- Training datasets (versioned snapshots for reproducibility)
CREATE TABLE ml_datasets (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL,        -- "graph_snapshot" | "extraction_pairs" | "classification"
  snapshot_at TEXT NOT NULL,  -- point-in-time the data represents
  record_count INTEGER,
  split_config TEXT,         -- JSON: train/val/test split definition
  artifact_path TEXT,        -- path to serialised dataset
  created_at TEXT NOT NULL
);
```

---

## 6. GNN Layer: Borrower Intelligence

### 6.1 Architecture Selection

| Architecture | Use Case | Why |
|-------------|----------|-----|
| **GraphSAGE** (primary) | Risk scoring, default prediction | Inductive — generalises to unseen borrowers. Samples neighbours rather than requiring full graph, so scales to large portfolios. |
| **GAT** (secondary) | Fraud detection, anomaly detection | Attention mechanism learns which relationships matter most. Interpretable attention weights serve as explanations. |
| **GCN** (baseline) | Benchmarking | Simple, well-understood. Use as a baseline to validate that more complex architectures add value. |

### 6.2 Task Definitions

#### Task 1: Borrower Default Risk (Node Classification)

**Input:** Entity graph with financial features
**Output:** Per-entity probability of default within 6/12/24 months
**Labels:** Historical default events (loan accounts entering ACTIVE_IN_ARREARS or WRITTEN_OFF state)
**Architecture:** 3-layer GraphSAGE with mean aggregation

```
Training signal:
- Positive: entities whose associated loan accounts entered arrears/write-off
- Negative: entities whose loans were repaid on time
- Time-split: train on data before cutoff T, test on events after T
```

**Why GNN over tabular ML:** A borrower's risk depends not just on their own financials but on the health of their guarantors, the concentration of their directors' other ventures, and the cash flow patterns of related entities. GNN captures this 2-3 hop neighbourhood influence naturally.

#### Task 2: Hidden Relationship Discovery (Link Prediction)

**Input:** Entity graph
**Output:** Predicted links between entities not currently connected
**Use case:** Discovering undisclosed related-party transactions, shared beneficial owners, shell company networks

```
Training signal:
- Hold out 10% of known relationships
- Train GNN to predict held-out edges
- At inference, score all non-existent edges; high scores = suspected hidden relationships
```

#### Task 3: Transaction Anomaly Detection (Graph-Level)

**Input:** Subgraph of entity + bank transactions + connected entities
**Output:** Anomaly score per transaction cluster
**Architecture:** GAT with attention over transaction→entity edges

```
Features per transaction node:
- amount, category, day_of_week, day_of_month
- deviation_from_mean (for this entity's typical transactions)
- counterparty_risk_score (from Task 1)
```

#### Task 4: Portfolio Segmentation (Graph Clustering)

**Input:** Full portfolio graph
**Output:** Cluster assignments for entities
**Use case:** Identifying portfolio concentrations, correlated risks, contagion paths

### 6.3 GNN Training Pipeline

```
1. Graph Snapshot
   - Query tables at time T
   - Build heterogeneous graph (multiple node/edge types)
   - Compute node features from spreads, transactions, covenants
   - Store as PyG HeteroData object

2. Feature Engineering
   - Numerical: standardise per-feature (z-score within dataset)
   - Categorical: one-hot encode (jurisdiction, stage, entity_type)
   - Temporal: rolling aggregates (3m, 6m, 12m windows)
   - Missing: zero-fill with indicator feature

3. Train/Val/Test Split
   - TEMPORAL split (not random): train < val < test in time
   - Prevents data leakage from future information

4. Training
   - PyTorch Geometric
   - GraphSAGE: 3 layers, hidden_dim=128, mean aggregation
   - Loss: binary cross-entropy (default prediction)
   - Optimiser: Adam, lr=1e-3, weight_decay=1e-5
   - Early stopping on validation AUC-ROC

5. Export
   - Save model as SafeTensors artifact
   - Register in ml_models table
   - Log training metrics

6. Inference
   - Load model + current graph
   - Run forward pass
   - Write predictions to entity_signals
   - All predictions include model_id and version for audit
```

---

## 7. Small Language Model Layer: Document Understanding

### 7.1 Model Selection

| Model | Size | Use Case | Deployment |
|-------|------|----------|------------|
| **Phi-3.5-mini** | 3.8B | Bank statement extraction, P&L parsing | CPU (quantised INT8) or single GPU |
| **Llama-3.2-1B** | 1B | Transaction categorisation, simple extraction | CPU only, <4GB RAM |
| **FinBERT** | 110M | Sentiment classification on financial text | CPU, <1GB RAM |

### 7.2 Why SLMs, Not LLM APIs

| Factor | SLM (self-hosted) | LLM API |
|--------|-------------------|---------|
| **Data sovereignty** | Bank statements never leave infrastructure | Sent to third-party servers |
| **Cost** | One-time compute for fine-tuning; near-zero marginal cost per inference | $0.01-0.10+ per document |
| **Latency** | <500ms per page on CPU (quantised) | 2-10s including network |
| **Customisation** | Fine-tune on your exact document formats | Prompt engineering only |
| **Audit** | Deterministic (same model version = same output) | Model updates without notice |
| **Availability** | Runs offline, no API dependency | Requires internet |

### 7.3 Bank Statement Extraction Pipeline

This is the highest-value SLM use case for lending:

```
┌──────────────┐     ┌─────────────────┐     ┌───────────────────┐
│  PDF Upload  │────▶│  OCR / Parser   │────▶│  SLM Extraction   │
│  (document)  │     │  (pdfplumber /  │     │  (Phi-3.5-mini)   │
│              │     │   Tesseract)    │     │                   │
└──────────────┘     └─────────────────┘     └────────┬──────────┘
                                                      │
                          ┌───────────────────────────▼──────────┐
                          │  Structured Output                    │
                          │  {                                    │
                          │    account_holder: "Acme Ltd",        │
                          │    account_number: "****4532",        │
                          │    bank: "HSBC",                      │
                          │    period: "2025-01 to 2025-03",      │
                          │    opening_balance: 45230000,         │
                          │    closing_balance: 38710000,         │
                          │    transactions: [                    │
                          │      { date, description, amount,     │
                          │        category, counterparty }       │
                          │    ],                                 │
                          │    monthly_summary: {                 │
                          │      total_credits, total_debits,     │
                          │      average_balance                  │
                          │    }                                  │
                          │  }                                    │
                          └──────────────────┬───────────────────┘
                                             │
                    ┌────────────────────────▼───────────────────┐
                    │  Validation & Human Review                  │
                    │  - Cross-check totals against statement      │
                    │  - Flag low-confidence extractions           │
                    │  - Human corrections become training data    │
                    └────────────────────────┬───────────────────┘
                                             │
                    ┌────────────────────────▼───────────────────┐
                    │  Write to Core Tables                       │
                    │  - bank_transactions (individual rows)      │
                    │  - ml_extractions (audit trail)             │
                    │  - entity_signals (summary metrics)         │
                    └───────────────────────────────────────────┘
```

### 7.4 Fine-Tuning Strategy

**Phase 1: Prompt-based extraction (no training)**
- Use Phi-3.5-mini with structured output prompts
- JSON mode / grammar-constrained decoding
- Validate against known statement formats
- Collect human corrections

**Phase 2: Supervised fine-tuning**
- LoRA (Low-Rank Adaptation) on Phi-3.5-mini
- Training data: human-corrected extractions from Phase 1
- Minimum 500 corrected examples before fine-tuning
- Evaluate on held-out statements from different banks

**Phase 3: Continuous learning**
- Each human correction is a training example
- Retrain monthly (or when correction rate exceeds 10%)
- A/B test new model versions against production
- Promote via ml_models registry

---

## 8. Hybrid GNN-SLM Pipeline

### 8.1 The Integration Pattern

The GNN and SLM are not separate systems — they form a **feedback loop**:

```
Documents ──SLM──▶ Structured Data ──▶ Graph Features ──GNN──▶ Predictions
     ▲                                                              │
     │                                                              │
     └──────────────── Priority Queue ◀────────────────────────────┘
         (GNN flags risky entities → prioritise their doc review)
```

1. **SLM extracts** structured data from uploaded documents (bank statements, financials)
2. **Extracted data flows into the graph** as node features (transaction patterns, financial ratios)
3. **GNN computes** risk scores, anomaly flags, cluster assignments
4. **GNN outputs prioritise** which documents need human review (high-risk entities first)
5. **Human corrections** improve SLM extraction quality over time

### 8.2 Inference Orchestration

When a new document is uploaded for a deal:

```python
# Pseudocode for the hybrid pipeline
async def process_document(document_id: str, deal_id: str):
    # Step 1: SLM extraction
    doc = await fetch_document(document_id)
    extraction = await slm_extract(doc, model="bank-statement-extractor-v2")

    # Step 2: Validate and store extraction
    validated = validate_extraction(extraction)
    await store_extraction(document_id, validated)

    # Step 3: If accepted, update graph features
    if validated.confidence > CONFIDENCE_THRESHOLD:
        await ingest_transactions(deal_id, validated.transactions)
        await update_graph_features(deal_id)

    # Step 4: Re-run GNN inference on affected subgraph
    entity_id = await get_primary_entity(deal_id)
    subgraph = await get_k_hop_subgraph(entity_id, k=2)
    predictions = await gnn_inference(subgraph, model="borrower-risk-v3")

    # Step 5: Write predictions
    await store_signals(entity_id, predictions)

    # Step 6: Check for alerts
    if predictions.default_probability > ALERT_THRESHOLD:
        await create_alert(deal_id, "liquidity_warning", predictions)
```

---

## 9. Training Infrastructure

### 9.1 Compute Requirements

| Component | Training | Inference |
|-----------|----------|-----------|
| **GNN (GraphSAGE)** | CPU: 4 cores, 16GB RAM (portfolios <10k entities). GPU: any CUDA device for larger. Training time: minutes to low hours. | CPU only. <100ms per entity on 2-hop subgraph. |
| **SLM (Phi-3.5-mini, quantised)** | GPU recommended for fine-tuning (LoRA: single A10/L4, ~2hrs for 1000 examples). | CPU: INT8 quantised, ~400ms per page. GPU: ~50ms per page. |
| **FinBERT** | CPU fine-tuning is feasible (~30min for 10k examples). | CPU: ~10ms per classification. |

### 9.2 Data Pipeline

```
┌──────────────────┐     ┌────────────────────┐     ┌──────────────┐
│  Open LOS SQLite │────▶│  Snapshot Service   │────▶│  ml_datasets │
│  (source of truth)│     │  (Python, periodic) │     │  (versioned) │
└──────────────────┘     └────────────────────┘     └──────┬───────┘
                                                           │
                         ┌─────────────────────────────────▼───────┐
                         │  Training Runner                        │
                         │  - Loads dataset by ID                  │
                         │  - Trains model                         │
                         │  - Evaluates on held-out set            │
                         │  - Registers model artifact             │
                         │  - Optionally promotes to production    │
                         └─────────────────────────────────────────┘
```

### 9.3 MLOps — Lightweight, Not Enterprise

We deliberately avoid heavy MLOps tooling (MLflow, Kubeflow, etc.). Instead:

| Concern | Solution |
|---------|----------|
| **Experiment tracking** | `ml_models` table with training_config and training_metrics JSON columns |
| **Model versioning** | Semantic versioning in `ml_models.version`. Artifacts stored as files with checksums. |
| **Model promotion** | `status` field: staging → production → deprecated. Only one model per type can be `production`. |
| **Data versioning** | `ml_datasets` table with snapshot timestamps. Datasets are immutable once created. |
| **Monitoring** | Compare prediction distributions across model versions. Alert on drift via existing `alerts` table. |
| **Rollback** | Change `ml_models.status` back to the previous version. Recompute signals. |

---

## 10. API Design

### 10.1 New Endpoints

All endpoints follow existing Open LOS patterns (REST, JSON, X-Actor header, audit trail).

```
# Entity Intelligence
GET  /v1/entities/{id}/signals            # All ML signals for an entity
GET  /v1/entities/{id}/risk-profile       # Aggregated risk view
GET  /v1/entities/{id}/similar            # Entities with similar embeddings
GET  /v1/entities/{id}/graph              # k-hop subgraph (JSON graph format)

# Document Extraction
POST /v1/documents/{id}/extract           # Trigger SLM extraction
GET  /v1/documents/{id}/extraction        # Get extraction result
PUT  /v1/documents/{id}/extraction/review # Accept/reject/correct extraction

# Model Management
GET  /v1/ml/models                        # List registered models
GET  /v1/ml/models/{id}                   # Model details + metrics
POST /v1/ml/models/{id}/promote           # Promote to production

# Inference
POST /v1/ml/infer/risk                    # Run risk inference on entity
POST /v1/ml/infer/anomaly                 # Run anomaly detection on subgraph
POST /v1/ml/infer/extract                 # Run extraction on document

# Training (admin)
POST /v1/ml/datasets                      # Create training dataset snapshot
POST /v1/ml/train                         # Trigger training run
GET  /v1/ml/train/{id}                    # Training run status + metrics

# Graph Queries
GET  /v1/graph/entities/{id}/neighbours   # Direct neighbours
GET  /v1/graph/entities/{id}/paths/{target_id}  # Shortest paths
GET  /v1/graph/clusters                   # Current portfolio clusters
```

### 10.2 Integration with Existing Endpoints

Existing endpoints gain ML-enriched responses:

```jsonc
// GET /v1/deals/{id} — enhanced response
{
  "id": "deal_abc",
  "borrower_name": "Acme Ltd",
  "stage": "underwriting",
  // ... existing fields ...

  // NEW: ML signals (when available)
  "ml_signals": {
    "risk_score": 0.72,
    "risk_model": "borrower-risk-gnn-v3",
    "risk_computed_at": "2026-03-13T10:00:00Z",
    "anomaly_flags": ["unusual_outflow_pattern", "director_overlap_with_flagged_entity"],
    "extraction_status": {
      "bank_statements": { "extracted": 3, "pending_review": 1 },
      "financials": { "extracted": 2, "pending_review": 0 }
    }
  }
}
```

---

## 11. Privacy, Security & Compliance

### 11.1 Data Sovereignty

- **All models run on-premise / in tenant's cloud**. No data sent to external APIs.
- Model weights are stored alongside the application. No cloud model registry dependency.
- Training data never leaves the deployment boundary.

### 11.2 Explainability (Regulatory Requirement)

Every ML prediction must be explainable:

| Technique | Model | Output |
|-----------|-------|--------|
| **GNN attention weights** | GAT | "This risk score is 40% influenced by guarantor's financial deterioration" |
| **SHAP on GNN features** | GraphSAGE | Feature importance ranking per prediction |
| **Extraction confidence** | SLM | Per-field confidence scores |
| **Model card** | All | `ml_models` table stores architecture, training data description, known limitations |

### 11.3 Human-in-the-Loop

- **No autonomous decisions.** ML outputs are signals, not actions. A human (or AI agent with appropriate permissions) must still approve stage transitions, loan disbursements, etc.
- **Extraction review.** SLM outputs go through `pending → accepted/rejected/corrected` workflow. Nothing enters core tables without review (initially; threshold can be lowered as accuracy improves).
- **Model promotion requires human approval.** New model versions start in `staging`. Promotion to `production` is an audited action.

### 11.4 Audit Integration

All ML operations produce audit events:

```jsonc
{
  "type": "ml.inference",
  "actor": "system:gnn-risk-v3",
  "object_type": "entity_signal",
  "object_id": "sig_xyz",
  "changes": {
    "risk_score": { "old": 0.45, "new": 0.72 }
  },
  "metadata": {
    "model_id": "model_abc",
    "model_version": "3.0.1",
    "input_features_hash": "sha256:...",
    "inference_time_ms": 47
  }
}
```

---

## 12. Implementation Roadmap

### Phase 0: Foundation (Weeks 1-3)

**Goal:** Graph store and ontology sync layer.

- [ ] Add `entity_signals`, `ml_models`, `ml_extractions`, `ml_datasets` tables to schema
- [ ] Extend `relationships` table with `effective_from`, `effective_until`, `confidence`, `source` columns
- [ ] Build graph construction service: read from SQLite → build in-memory graph (Python, NetworkX)
- [ ] Implement graph sync: watch audit events → update graph incrementally
- [ ] API: `GET /v1/entities/{id}/graph` (return subgraph as JSON)
- [ ] API: `GET /v1/graph/entities/{id}/neighbours`

### Phase 1: SLM Extraction (Weeks 4-7)

**Goal:** Bank statement parsing with human review.

- [ ] Integrate Phi-3.5-mini (quantised) or Llama-3.2-1B via llama.cpp / vLLM
- [ ] Build extraction prompt templates for bank statements
- [ ] Implement extraction pipeline: PDF → text → SLM → structured JSON
- [ ] API: `POST /v1/documents/{id}/extract`
- [ ] Build review workflow: `PUT /v1/documents/{id}/extraction/review`
- [ ] Store corrections for future fine-tuning
- [ ] Integration: accepted extractions auto-create `bank_transactions`

### Phase 2: GNN Risk Scoring (Weeks 8-12)

**Goal:** Borrower default prediction via GNN.

- [ ] Build graph feature engineering pipeline (spreads + transactions → node features)
- [ ] Implement GraphSAGE training pipeline (PyTorch Geometric)
- [ ] Create temporal train/val/test dataset splitter
- [ ] Train initial model on historical data (if available) or synthetic data
- [ ] Implement inference service: entity_id → risk_score
- [ ] API: `POST /v1/ml/infer/risk`, `GET /v1/entities/{id}/risk-profile`
- [ ] Write predictions to `entity_signals` with full audit trail
- [ ] Add `ml_signals` to deal response

### Phase 3: Anomaly Detection & Link Prediction (Weeks 13-16)

**Goal:** Fraud detection and hidden relationship discovery.

- [ ] Train GAT model for transaction anomaly scoring
- [ ] Implement link prediction pipeline for hidden relationships
- [ ] API: `POST /v1/ml/infer/anomaly`
- [ ] Alert integration: high anomaly scores → `alerts` table
- [ ] Build entity similarity search using GNN embeddings

### Phase 4: Hybrid Pipeline & Continuous Learning (Weeks 17-20)

**Goal:** SLM+GNN feedback loop, SLM fine-tuning, model management.

- [ ] Implement hybrid pipeline (document upload → extraction → graph update → re-inference)
- [ ] Fine-tune SLM on accumulated human corrections (LoRA)
- [ ] Build model promotion workflow with A/B comparison
- [ ] Add drift monitoring (prediction distribution shift detection)
- [ ] API: model management endpoints
- [ ] Portfolio-level clustering and concentration analysis

---

## 13. Success Metrics

### Extraction Quality (SLM)

| Metric | Phase 1 Target | Phase 4 Target |
|--------|---------------|---------------|
| Transaction extraction accuracy | >85% field-level | >95% field-level |
| Human correction rate | <30% of extractions | <5% of extractions |
| Processing time per page (CPU) | <1s | <500ms |
| Bank format coverage | Top 5 UK/US banks | Top 20 banks + generic |

### Risk Prediction (GNN)

| Metric | Phase 2 Target | Phase 4 Target |
|--------|---------------|---------------|
| AUC-ROC (default prediction) | >0.75 | >0.85 |
| Precision @ 10% recall | >0.60 | >0.80 |
| Inference latency (per entity) | <200ms | <100ms |
| Explanation quality (human rating) | Understandable | Actionable |

### Anomaly Detection

| Metric | Phase 3 Target |
|--------|---------------|
| Flagged anomaly precision | >50% (true positives among flagged) |
| Hidden relationship recall | Manual validation of top-100 predictions |

### Operational

| Metric | Target |
|--------|--------|
| Model inference uptime | 99.5% |
| Graph sync latency (audit event → graph update) | <1s |
| Zero data sent to external APIs | 100% (hard requirement) |

---

## 14. Appendix: Technology References

### GNN for Financial Fraud Detection
- [GNN for Financial Fraud Detection: A Review (arXiv, 2024)](https://arxiv.org/abs/2411.05815)
- [Graph Learning-Empowered Financial Fraud Detection (Intelligent Computing, 2025)](https://spj.science.org/doi/10.34133/icomputing.0146)
- [NVIDIA AI Blueprint: Fraud Detection with GNNs](https://developer.nvidia.com/blog/supercharging-fraud-detection-in-financial-services-with-graph-neural-networks/)
- [RL-GNN Fusion for Real-Time Fraud Detection (Scientific Reports, 2025)](https://www.nature.com/articles/s41598-025-25200-3)
- [Semi-Supervised GNN for Online Credit Loan Risk (ACM TIST)](https://dl.acm.org/doi/10.1145/3623401)
- [Hybrid GNN for Credit Risk Analysis (arXiv, 2024)](https://arxiv.org/pdf/2410.04283)
- [AI-Powered Fraud Detection: GNN & Compliance (SSRN, 2025)](https://papers.ssrn.com/sol3/Delivery.cfm/5170054.pdf?abstractid=5170054)

### Palantir Ontology & Topology Design
- [Palantir Ontology Overview](https://www.palantir.com/docs/foundry/ontology/overview)
- [Palantir Foundry Ontology](https://www.palantir.com/explore/platforms/foundry/ontology/)
- [Ontology & Catalog Design in Palantir Foundry (Medium)](https://medium.com/@sachtekchanda90/ontology-catalog-design-in-palantir-foundry-part-1-21904cebd7d3)
- [Understanding Palantir's Ontology: Semantic, Kinetic, and Dynamic Layers (Medium)](https://pythonebasta.medium.com/understanding-palantirs-ontology-semantic-kinetic-and-dynamic-layers-explained-c1c25b39ea3c)
- [Palantir AIP Overview](https://www.palantir.com/docs/foundry/aip/overview)
- [Models in the Palantir Ontology](https://www.palantir.com/docs/foundry/ontology/models)

### GNN-LLM Hybrid Architectures
- [GL-Fusion: Rethinking GNN + LLM Combination (OpenReview)](https://openreview.net/forum?id=exnoX9Iaik)
- [Hybrid-LLM-GNN (Digital Discovery, 2025)](https://pubs.rsc.org/en/content/articlelanding/2025/dd/d4dd00199k)
- [Injecting Structured Knowledge into LLMs via GNNs (ACL 2025)](https://aclanthology.org/2025.xllm-1.3.pdf)
- [Graph Neural Networks with LLMs: Hybrid AI (FalkorDB)](https://www.falkordb.com/blog/graph-neural-networks-llm-integration/)

### Frameworks & Tools
- [PyTorch Geometric (PyG)](https://pyg.org/) — GNN framework
- [Deep Graph Library (DGL)](https://www.dgl.ai/) — alternative GNN framework
- [llama.cpp](https://github.com/ggerganov/llama.cpp) — CPU inference for SLMs
- [vLLM](https://github.com/vllm-project/vllm) — GPU inference server
- [FinBERT](https://huggingface.co/ProsusAI/finbert) — financial sentiment model
- [NetworkX](https://networkx.org/) / [rustworkx](https://github.com/Qiskit/rustworkx) — graph libraries
