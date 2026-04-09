/**
 * Open LOS — Minimal UI Configuration
 *
 * Fill in this config to spin up a custom dashboard.
 * Think of it as completing the sentence:
 *
 *   "I need to take documents from [INDUSTRY] and decision criteria are
 *    [CRITERIA], and I would want to review them when [TRIGGERS] happen;
 *    otherwise, pass through."
 *
 * Every field below maps to that sentence. Change the config, refresh
 * the page, and the dashboard reshapes itself.
 */

const LOS_CONFIG = {

  // ── Branding ────────────────────────────────────────────────────────
  name: "Trade Finance Ops",          // Appears in the header
  logo: null,                          // URL to logo image, or null for default dot
  currency: "KWD",                     // ISO currency code for display
  locale: "en-US",                     // Number / date formatting locale

  // ── API Connection ──────────────────────────────────────────────────
  api: {
    baseUrl: "http://localhost:3000",   // Open LOS API root
    tenantId: "default",                // X-Tenant-Id header value
    actor: "ops-dashboard",             // X-Actor header for audit trail
    pollIntervalMs: 15000,              // How often to refresh data (0 = manual only)
  },

  // ── Industry & Document Types ───────────────────────────────────────
  // "I need to take documents from [X] industry…"
  industry: "Trade Finance",
  documentTypes: [
    { id: "lc_application",      label: "LC Application",         required: true },
    { id: "proforma_invoice",    label: "Pro-Forma Invoice",      required: true },
    { id: "kyc_package",         label: "KYC Package",            required: true },
    { id: "insurance_cert",      label: "Insurance Certificate",  required: false },
    { id: "bill_of_lading",      label: "Bill of Lading",         required: false },
    { id: "credit_report",       label: "Credit Report",          required: false },
  ],

  // ── Pipeline Stages ─────────────────────────────────────────────────
  // The left-to-right flow of work. Each stage maps to a board column.
  stages: [
    { id: "document_collection", label: "Collection",      color: "#6366f1" },
    { id: "analysis",            label: "Analysis",        color: "#3b82f6" },
    { id: "validation",          label: "AI Validation",   color: "#8b5cf6" },
    { id: "review",              label: "Review",          color: "#f59e0b" },
    { id: "processed",           label: "Processed",       color: "#10b981" },
  ],

  // ── Journey Types ───────────────────────────────────────────────────
  // What kinds of cases flow through this system?
  journeyTypes: [
    { id: "ilc_issuance",    label: "ILC Issuance" },
    { id: "ilc_negotiation", label: "ILC Negotiation" },
    { id: "olg_bulk",        label: "OLG Bulk" },
  ],

  // ── Decision Criteria ───────────────────────────────────────────────
  // "…and decision criteria are [Y]…"
  // These define what the system checks and scores against.
  decisionCriteria: [
    {
      id: "credit_score",
      label: "Credit Score",
      description: "Automated credit scoring — tier and percentage",
      thresholds: { autoApprove: 85, autoDecline: 30 },
    },
    {
      id: "sanctions_screening",
      label: "Sanctions & EDD",
      description: "Counterparty screening against sanctions and EDD lists",
      thresholds: { autoApprove: null, autoDecline: null }, // always human
    },
    {
      id: "document_completeness",
      label: "Document Completeness",
      description: "All required documents present and machine-readable",
      thresholds: { autoApprove: 100, autoDecline: null },
    },
    {
      id: "facility_utilisation",
      label: "Facility Utilisation",
      description: "Post-issuance facility usage vs soft/hard limits",
      thresholds: { autoApprove: 85, autoDecline: 100 },
    },
  ],

  // ── Review Triggers ─────────────────────────────────────────────────
  // "…I would want to review them when [Z] happens…"
  // When ANY of these fire, the case lands in the Review queue.
  reviewTriggers: [
    {
      id: "edd_flag",
      label: "EDD Flag",
      description: "Counterparty flagged on enhanced due diligence list",
      severity: "high",
    },
    {
      id: "discrepancy",
      label: "Document Discrepancy",
      description: "AI detected a mismatch between documents",
      severity: "medium",
    },
    {
      id: "facility_soft_limit",
      label: "Facility Soft Limit",
      description: "Utilisation exceeds soft limit threshold",
      severity: "medium",
    },
    {
      id: "low_confidence",
      label: "Low AI Confidence",
      description: "Validation confidence below auto-approve threshold",
      severity: "medium",
    },
    {
      id: "coverage_gap",
      label: "Coverage Gap",
      description: "Insurance or collateral coverage gap detected",
      severity: "low",
    },
  ],

  // ── Pass-Through Rules ──────────────────────────────────────────────
  // "…otherwise, pass through."
  // Cases matching ALL of these proceed automatically (STP).
  passThrough: {
    enabled: true,
    rules: [
      "All required documents present and extracted",
      "Credit score at or above auto-approve threshold",
      "No sanctions or EDD flags",
      "No document discrepancies",
      "Facility utilisation within soft limit",
    ],
    // What happens when a case passes through?
    autoAction: "approve",   // "approve" | "stage_advance" | "notify_only"
  },

  // ── Display Preferences ─────────────────────────────────────────────
  display: {
    theme: "dark",                  // "dark" | "light"
    showAiRecommendations: true,    // Show agent recommendations on decisions
    showAuditTimeline: true,        // Show activity timeline per case
    compactCards: false,             // Smaller card layout
    defaultView: "dashboard",       // "dashboard" | "decisions" | "activity"
  },
};

// ── Export for use in app.js ────────────────────────────────────────────
// In a module environment, export. Otherwise, it's a global.
if (typeof module !== "undefined" && module.exports) {
  module.exports = LOS_CONFIG;
}
