/**
 * Outcome-oriented interface types
 *
 * These types define what customers interact with.
 * They deliberately hide the complexity of the backing system.
 */

// ============================================
// Deal Submission
// ============================================

export interface DealRequest {
  /** Borrower's legal name */
  borrowerName: string

  /** Requested loan amount */
  requestedAmount: number

  /** Purpose of the loan */
  purpose: 'expansion' | 'working_capital' | 'acquisition' | 'refinance' | 'equipment' | 'real_estate' | 'other'

  /** Jurisdiction (state/country) */
  jurisdiction: string

  /** Optional: Additional borrower context */
  borrowerInfo?: BorrowerInfo

  /** Optional: Urgency indicator */
  priority?: 'standard' | 'expedited'

  /** Optional: Reference to external system */
  externalRef?: string
}

export interface BorrowerInfo {
  industry?: string
  yearsInBusiness?: number
  annualRevenue?: number
  employeeCount?: number
  existingRelationship?: boolean
  notes?: string
}

export interface DealSubmissionResult {
  dealId: string
  status: 'started'
  nextSteps: string[]
  estimatedTimeline?: string
}

// ============================================
// Document Handling
// ============================================

export interface DocumentUpload {
  filename: string
  mimeType: string
  content: Buffer | string  // Base64 or raw
  category?: string         // Hint to the agent
  notes?: string
}

export interface DocumentProcessingResult {
  documentId: string
  classification: DocumentClassification
  extracted: ExtractedData
  impact: string  // Human-readable impact on deal
}

export interface DocumentClassification {
  type: string           // 'financial_statement' | 'bank_statement' | 'corporate_doc' | etc
  subtype?: string       // 'balance_sheet' | 'income_statement' | etc
  period?: string        // '2024-Q4' | 'FY2023' | etc
  confidence: number     // 0-1
}

export interface ExtractedData {
  [key: string]: unknown  // Depends on document type
}

// ============================================
// Status & Progress
// ============================================

export interface DealStatusRequest {
  dealId: string
  includeHistory?: boolean
  includeDocuments?: boolean
}

export interface DealStatus {
  dealId: string
  stage: DealStage
  progress: number  // 0-100
  summary: string   // Human-readable status
  blockers: Blocker[]
  nextSteps: string[]
  risks: Risk[]
  recommendation?: Recommendation
  timeline?: Timeline
  documents?: DocumentSummary[]
  history?: HistoryEntry[]
}

export type DealStage = 'intake' | 'document_collection' | 'analysis' | 'structuring' | 'approval' | 'closing' | 'monitoring' | 'completed' | 'declined'

export interface Blocker {
  id: string
  type: 'missing_document' | 'missing_information' | 'pending_decision' | 'external_dependency'
  description: string
  resolution: string  // What would unblock this
  assignedTo?: 'customer' | 'agent' | 'lender'
}

export interface Risk {
  id: string
  level: 'low' | 'medium' | 'high' | 'critical'
  category: string
  description: string
  mitigations?: string[]
}

export interface Recommendation {
  id: string
  type: 'facility_structure' | 'covenant_package' | 'pricing' | 'decline' | 'request_more_info'
  summary: string
  rationale: string
  details: Record<string, unknown>
  confidence: number
  alternatives?: Recommendation[]
}

export interface Timeline {
  started: string
  currentStage: string
  expectedCompletion?: string
  milestones: Milestone[]
}

export interface Milestone {
  name: string
  status: 'completed' | 'current' | 'pending'
  completedAt?: string
  expectedAt?: string
}

export interface DocumentSummary {
  id: string
  filename: string
  classification: string
  uploadedAt: string
  status: 'processed' | 'processing' | 'failed'
}

export interface HistoryEntry {
  timestamp: string
  event: string
  details?: string
  actor: 'agent' | 'customer' | 'lender'
}

// ============================================
// Action Items & Decisions
// ============================================

export interface ActionItem {
  id: string
  dealId: string
  type: ActionType
  priority: 'low' | 'medium' | 'high' | 'urgent'
  title: string
  description: string
  context: ActionContext
  options: ActionOption[]
  dueBy?: string
  createdAt: string
}

export type ActionType =
  | 'approve_facility'
  | 'approve_covenant'
  | 'approve_pricing'
  | 'request_information'
  | 'review_risk'
  | 'final_approval'
  | 'exception_approval'

export interface ActionContext {
  summary: string
  recommendation?: Recommendation
  risks?: Risk[]
  supportingData?: Record<string, unknown>
}

export interface ActionOption {
  id: string
  label: string
  type: 'approve' | 'reject' | 'modify' | 'defer'
  requiresInput?: boolean
  inputSchema?: Record<string, unknown>
}

export interface Decision {
  optionId: string
  rationale?: string
  modifications?: Record<string, unknown>
}

export interface DecisionResult {
  actionId: string
  decision: string
  result: string
  nextSteps: string[]
  dealStatus: DealStatus
}

// ============================================
// Explanations & Audit
// ============================================

export interface ExplanationRequest {
  dealId: string
  topic: 'recommendation' | 'risk_assessment' | 'document_analysis' | 'covenant_structure' | 'pricing' | 'timeline' | 'specific'
  specificQuestion?: string
}

export interface Explanation {
  topic: string
  explanation: string
  supportingData: Record<string, unknown>
  methodology?: string
  assumptions?: string[]
  auditReferences: AuditReference[]
}

export interface AuditReference {
  eventId: string
  timestamp: string
  event: string
  relevance: string
}

// ============================================
// Monitoring & Alerts
// ============================================

export interface AlertSubscription {
  dealIds?: string[]        // Specific deals, or all if omitted
  alertTypes?: AlertType[]  // Specific types, or all if omitted
  channel: 'webhook' | 'email'
  destination: string       // URL or email address
}

export type AlertType =
  | 'covenant_warning'
  | 'covenant_breach'
  | 'liquidity_warning'
  | 'payment_missed'
  | 'document_expiring'
  | 'action_required'
  | 'status_change'

export interface Alert {
  id: string
  dealId: string
  type: AlertType
  severity: 'info' | 'warning' | 'critical'
  title: string
  description: string
  recommendedAction?: string
  data?: Record<string, unknown>
  createdAt: string
}

// ============================================
// Portfolio View
// ============================================

export interface PortfolioRequest {
  filters?: {
    stages?: DealStage[]
    riskLevels?: string[]
    dateRange?: { from: string; to: string }
  }
  groupBy?: 'stage' | 'risk' | 'industry'
}

export interface PortfolioSummary {
  totalDeals: number
  totalExposure: number
  byStage: Record<string, { count: number; exposure: number }>
  byRisk: Record<string, { count: number; exposure: number }>
  alerts: {
    critical: number
    warning: number
    info: number
  }
  recentActivity: HistoryEntry[]
  attentionRequired: ActionItem[]
}
