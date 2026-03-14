/**
 * Entity Business Categorisation — Independent Tag Cloud
 *
 * Multi-dimensional classification system for entities that is independent
 * of external bureau categorisations (SIC, NAICS, GICS, etc.).
 *
 * Each dimension represents a facet of the business that the lender cares about.
 * Tags within each dimension form a "tag cloud" that can be applied to any entity.
 *
 * This is designed to be extended — lenders can add their own dimensions
 * and tags via the API or by importing from a spreadsheet.
 */

// ─── Built-in Dimensions ───────────────────────────────────────────────────────

export interface CategoryDimension {
  id: string;
  label: string;
  description: string;
  tags: CategoryTag[];
}

export interface CategoryTag {
  id: string;
  label: string;
  description?: string;
}

export interface EntityTag {
  dimension: string;   // dimension id
  tag: string;         // tag id
  confidence?: number; // 0-1, how confident the classification is
  source?: string;     // who/what applied this tag: "manual" | "ai" | "bureau"
}

/**
 * Default dimensions for business categorisation.
 * These are independent of bureau-provided codes (SIC, NAICS, GICS).
 *
 * To add dimensions from a spreadsheet, use POST /v1/category-dimensions
 * or extend this list.
 */
export const DEFAULT_DIMENSIONS: CategoryDimension[] = [
  {
    id: "sector",
    label: "Business Sector",
    description: "Primary industry sector (lender's own classification)",
    tags: [
      { id: "technology", label: "Technology" },
      { id: "financial_services", label: "Financial Services" },
      { id: "healthcare", label: "Healthcare & Life Sciences" },
      { id: "manufacturing", label: "Manufacturing" },
      { id: "retail", label: "Retail & Consumer" },
      { id: "real_estate", label: "Real Estate & Property" },
      { id: "energy", label: "Energy & Utilities" },
      { id: "media", label: "Media & Entertainment" },
      { id: "agriculture", label: "Agriculture & Food" },
      { id: "transport", label: "Transport & Logistics" },
      { id: "construction", label: "Construction & Infrastructure" },
      { id: "professional_services", label: "Professional Services" },
      { id: "education", label: "Education" },
      { id: "hospitality", label: "Hospitality & Leisure" },
      { id: "telecoms", label: "Telecommunications" },
      { id: "defence", label: "Defence & Aerospace" },
      { id: "mining", label: "Mining & Resources" },
      { id: "other", label: "Other" },
    ],
  },
  {
    id: "business_model",
    label: "Business Model",
    description: "How the company generates revenue",
    tags: [
      { id: "b2b", label: "B2B" },
      { id: "b2c", label: "B2C" },
      { id: "b2b2c", label: "B2B2C" },
      { id: "marketplace", label: "Marketplace" },
      { id: "saas", label: "SaaS" },
      { id: "subscription", label: "Subscription" },
      { id: "licensing", label: "Licensing" },
      { id: "franchise", label: "Franchise" },
      { id: "commission", label: "Commission-based" },
      { id: "freemium", label: "Freemium" },
      { id: "transaction_fee", label: "Transaction Fee" },
      { id: "asset_heavy", label: "Asset-heavy" },
      { id: "asset_light", label: "Asset-light" },
    ],
  },
  {
    id: "stage",
    label: "Company Stage",
    description: "Lifecycle stage of the business",
    tags: [
      { id: "pre_revenue", label: "Pre-revenue" },
      { id: "startup", label: "Startup (< 2 years)" },
      { id: "early_stage", label: "Early Stage (2-5 years)" },
      { id: "growth", label: "Growth" },
      { id: "mature", label: "Mature / Established" },
      { id: "turnaround", label: "Turnaround / Restructuring" },
      { id: "declining", label: "Declining" },
    ],
  },
  {
    id: "size",
    label: "Company Size",
    description: "Scale of the business",
    tags: [
      { id: "micro", label: "Micro (< 10 employees)" },
      { id: "small", label: "Small (10-49 employees)" },
      { id: "medium", label: "Medium (50-249 employees)" },
      { id: "large", label: "Large (250-999 employees)" },
      { id: "enterprise", label: "Enterprise (1000+ employees)" },
    ],
  },
  {
    id: "geography",
    label: "Geographic Reach",
    description: "Where the business operates",
    tags: [
      { id: "local", label: "Local / Single City" },
      { id: "regional", label: "Regional" },
      { id: "national", label: "National" },
      { id: "multinational", label: "Multinational" },
      { id: "global", label: "Global" },
    ],
  },
  {
    id: "risk_profile",
    label: "Risk Profile",
    description: "Lender's internal risk classification",
    tags: [
      { id: "low_risk", label: "Low Risk" },
      { id: "moderate_risk", label: "Moderate Risk" },
      { id: "elevated_risk", label: "Elevated Risk" },
      { id: "high_risk", label: "High Risk" },
      { id: "prohibited", label: "Prohibited / Restricted" },
    ],
  },
  {
    id: "esg",
    label: "ESG Classification",
    description: "Environmental, Social, Governance characteristics",
    tags: [
      { id: "green", label: "Green / Sustainable" },
      { id: "social_impact", label: "Social Impact" },
      { id: "strong_governance", label: "Strong Governance" },
      { id: "esg_neutral", label: "ESG Neutral" },
      { id: "esg_concern", label: "ESG Concern" },
      { id: "controversial", label: "Controversial Sector" },
    ],
  },
  {
    id: "regulation",
    label: "Regulatory Status",
    description: "Regulatory environment the entity operates in",
    tags: [
      { id: "regulated", label: "Regulated (e.g., FCA, SEC)" },
      { id: "lightly_regulated", label: "Lightly Regulated" },
      { id: "unregulated", label: "Unregulated" },
      { id: "government", label: "Government / Public Sector" },
      { id: "charity", label: "Charity / Non-profit" },
    ],
  },
  {
    id: "ownership",
    label: "Ownership Type",
    description: "Corporate ownership structure",
    tags: [
      { id: "public_listed", label: "Publicly Listed" },
      { id: "private", label: "Private" },
      { id: "pe_backed", label: "PE-backed" },
      { id: "vc_backed", label: "VC-backed" },
      { id: "family_owned", label: "Family-owned" },
      { id: "employee_owned", label: "Employee-owned" },
      { id: "state_owned", label: "State-owned" },
      { id: "cooperative", label: "Cooperative" },
      { id: "spv", label: "SPV / Special Purpose Vehicle" },
    ],
  },
  {
    id: "borrower_type",
    label: "Borrower Type",
    description: "Lending-specific classification",
    tags: [
      { id: "corporate", label: "Corporate" },
      { id: "sme", label: "SME" },
      { id: "project_finance", label: "Project Finance" },
      { id: "trade_finance", label: "Trade Finance" },
      { id: "acquisition_finance", label: "Acquisition Finance" },
      { id: "leveraged", label: "Leveraged / Sponsor-backed" },
      { id: "real_estate_finance", label: "Real Estate Finance" },
      { id: "asset_backed", label: "Asset-backed" },
      { id: "working_capital", label: "Working Capital" },
    ],
  },
];

/**
 * Validate that a set of entity tags reference valid dimensions and tags.
 * Returns an array of error messages (empty = valid).
 */
export function validateEntityTags(
  tags: EntityTag[],
  dimensions: CategoryDimension[]
): string[] {
  const errors: string[] = [];
  const dimMap = new Map(dimensions.map((d) => [d.id, d]));

  for (const tag of tags) {
    const dim = dimMap.get(tag.dimension);
    if (!dim) {
      errors.push(`Unknown dimension: ${tag.dimension}`);
      continue;
    }
    const validTag = dim.tags.find((t) => t.id === tag.tag);
    if (!validTag) {
      errors.push(
        `Unknown tag '${tag.tag}' in dimension '${tag.dimension}'`
      );
    }
  }

  return errors;
}
