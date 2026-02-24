/**
 * Loan Origination Agent
 *
 * The core orchestrator that transforms open-los from software into a service.
 *
 * Mental model:
 * - Customer says "originate this loan"
 * - Agent figures out what needs to happen
 * - Agent uses open-los as its tools/memory
 * - Agent surfaces decisions to humans
 * - Agent explains what it did and why
 */

import type {
  DealRequest,
  DealSubmissionResult,
  DocumentUpload,
  DocumentProcessingResult,
  DealStatus,
  ActionItem,
  Decision,
  DecisionResult,
  ExplanationRequest,
  Explanation,
  PortfolioSummary,
  Alert,
  AlertSubscription,
} from './interface/types'

// Types for the backing system (open-los)
interface OpenLOSServices {
  deals: DealService
  stages: StageService
  documents: DocumentService
  entities: EntityService
  spreads: SpreadService
  covenants: CovenantService
  facilities: FacilityService
  loans: LoanService
  monitoring: MonitoringService
  audit: AuditService
  approvals: ApprovalsService
}

interface LLMClient {
  complete(prompt: string, options?: LLMOptions): Promise<string>
  structured<T>(prompt: string, schema: object): Promise<T>
}

interface LLMOptions {
  temperature?: number
  maxTokens?: number
}

interface AgentConfig {
  los: OpenLOSServices
  llm: LLMClient
  tenantId?: string
}

interface AgentContext {
  tenantId: string
  actor: string
  dealId?: string
}

/**
 * The main agent class that customers interact with
 */
export class LoanOriginationAgent {
  private los: OpenLOSServices
  private llm: LLMClient
  private defaultTenantId: string

  constructor(config: AgentConfig) {
    this.los = config.los
    this.llm = config.llm
    this.defaultTenantId = config.tenantId ?? 'default'
  }

  // ============================================
  // Primary Interface: Outcome-Oriented Methods
  // ============================================

  /**
   * Submit a new deal for origination
   *
   * This is the entry point. Customer says "originate this loan"
   * and the agent takes it from there.
   */
  async submitDeal(
    request: DealRequest,
    context?: Partial<AgentContext>
  ): Promise<DealSubmissionResult> {
    const ctx = this.buildContext(context)

    // 1. Create the deal in the backing system
    const deal = await this.los.deals.create({
      borrower_name: request.borrowerName,
      requested_amount: request.requestedAmount,
      purpose: request.purpose,
      jurisdiction: request.jurisdiction,
      tenant_id: ctx.tenantId,
      // Store additional context as custom fields
      custom_fields: {
        borrower_info: request.borrowerInfo,
        priority: request.priority,
        external_ref: request.externalRef,
      },
    })

    // 2. Agent reasons about what's needed
    const plan = await this.planOrigination(request, deal.id)

    // 3. Create the borrower entity if we have enough info
    if (request.borrowerInfo) {
      await this.los.entities.create({
        deal_id: deal.id,
        type: 'company',
        name: request.borrowerName,
        // Additional info from borrower context
        metadata: request.borrowerInfo,
      })
    }

    // 4. Return outcome-oriented response
    return {
      dealId: deal.id,
      status: 'started',
      nextSteps: plan.immediateNeeds,
      estimatedTimeline: plan.estimatedTimeline,
    }
  }

  /**
   * Upload a document to a deal
   *
   * Agent automatically classifies it, extracts relevant data,
   * and determines how it impacts the deal.
   */
  async uploadDocument(
    dealId: string,
    document: DocumentUpload,
    context?: Partial<AgentContext>
  ): Promise<DocumentProcessingResult> {
    const ctx = this.buildContext({ ...context, dealId })

    // 1. Store the document
    const doc = await this.los.documents.create({
      deal_id: dealId,
      filename: document.filename,
      mime_type: document.mimeType,
      content: document.content,
      source: 'customer_upload',
    })

    // 2. Agent classifies the document
    const classification = await this.classifyDocument(document)

    // 3. Agent extracts relevant data based on classification
    const extracted = await this.extractDocumentData(document, classification)

    // 4. Process based on document type
    await this.processDocument(dealId, doc.id, classification, extracted)

    // 5. Determine impact on deal
    const impact = await this.assessDocumentImpact(dealId, classification, extracted)

    // 6. Check if we can advance the deal
    await this.checkAndAdvanceDeal(dealId, ctx)

    return {
      documentId: doc.id,
      classification,
      extracted,
      impact,
    }
  }

  /**
   * Get the current status of a deal
   *
   * Returns a human-readable summary, not raw data.
   */
  async getStatus(dealId: string, context?: Partial<AgentContext>): Promise<DealStatus> {
    const ctx = this.buildContext({ ...context, dealId })

    // Get raw state from backing system
    const deal = await this.los.deals.get(dealId)
    const documents = await this.los.documents.listByDeal(dealId)
    const audit = await this.los.audit.listByDeal(dealId)

    // Agent synthesizes into status
    const stage = this.mapStageToCustomerView(deal.stage)
    const progress = await this.calculateProgress(deal, documents)
    const blockers = await this.identifyBlockers(deal, documents)
    const risks = await this.assessRisks(dealId)
    const recommendation = await this.getRecommendation(dealId)

    // Generate human-readable summary
    const summary = await this.generateStatusSummary(deal, progress, blockers)

    return {
      dealId,
      stage,
      progress,
      summary,
      blockers,
      nextSteps: blockers.map((b) => b.resolution),
      risks,
      recommendation,
      documents: documents.map((d) => ({
        id: d.id,
        filename: d.filename,
        classification: d.classification ?? 'unclassified',
        uploadedAt: d.created_at,
        status: d.processed ? 'processed' : 'processing',
      })),
    }
  }

  /**
   * Get items that need human attention
   */
  async getActionItems(context?: Partial<AgentContext>): Promise<ActionItem[]> {
    const ctx = this.buildContext(context)

    // Get pending approvals from backing system
    const approvals = await this.los.deals.getPendingApprovals(ctx.tenantId)

    // Transform into action items
    return Promise.all(
      approvals.map(async (approval) => {
        const deal = await this.los.deals.get(approval.deal_id)
        const context = await this.buildActionContext(approval, deal)

        return {
          id: approval.id,
          dealId: approval.deal_id,
          type: this.mapApprovalType(approval.type),
          priority: this.assessPriority(approval, deal),
          title: this.generateActionTitle(approval),
          description: this.generateActionDescription(approval, deal),
          context,
          options: this.getActionOptions(approval.type),
          dueBy: approval.due_date,
          createdAt: approval.created_at,
        }
      })
    )
  }

  /**
   * Make a decision on an action item
   */
  async makeDecision(
    actionId: string,
    decision: Decision,
    context?: Partial<AgentContext>
  ): Promise<DecisionResult> {
    const ctx = this.buildContext(context)

    // Get the approval
    const approval = await this.los.approvals.get(actionId)
    const deal = await this.los.deals.get(approval.deal_id)

    // Record the decision
    await this.los.approvals.decide(actionId, {
      decision: decision.optionId,
      rationale: decision.rationale,
      actor: ctx.actor,
    })

    // Apply modifications if any
    if (decision.modifications) {
      await this.applyModifications(approval, decision.modifications)
    }

    // Agent continues the workflow
    const nextSteps = await this.continueWorkflow(deal.id, approval.type, decision)

    // Get updated status
    const dealStatus = await this.getStatus(deal.id, context)

    return {
      actionId,
      decision: decision.optionId,
      result: `Decision recorded: ${decision.optionId}`,
      nextSteps,
      dealStatus,
    }
  }

  /**
   * Explain a decision or analysis
   */
  async explain(
    request: ExplanationRequest,
    context?: Partial<AgentContext>
  ): Promise<Explanation> {
    const ctx = this.buildContext({ ...context, dealId: request.dealId })

    // Get relevant data from backing system
    const deal = await this.los.deals.get(request.dealId)
    const audit = await this.los.audit.listByDeal(request.dealId)

    // Agent generates explanation based on topic
    const explanation = await this.generateExplanation(request, deal, audit)

    return explanation
  }

  /**
   * Get portfolio summary
   */
  async getPortfolioSummary(context?: Partial<AgentContext>): Promise<PortfolioSummary> {
    const ctx = this.buildContext(context)

    const deals = await this.los.deals.list({ tenant_id: ctx.tenantId })
    const alerts = await this.los.monitoring.getAlerts(ctx.tenantId)
    const actionItems = await this.getActionItems(context)

    // Agent synthesizes portfolio view
    return this.buildPortfolioSummary(deals, alerts, actionItems)
  }

  // ============================================
  // Internal: Agent Reasoning
  // ============================================

  private async planOrigination(
    request: DealRequest,
    dealId: string
  ): Promise<{ immediateNeeds: string[]; estimatedTimeline: string }> {
    // Agent reasons about what's needed based on deal characteristics
    const prompt = `
      Given a loan origination request:
      - Borrower: ${request.borrowerName}
      - Amount: $${request.requestedAmount.toLocaleString()}
      - Purpose: ${request.purpose}
      - Jurisdiction: ${request.jurisdiction}
      - Industry: ${request.borrowerInfo?.industry ?? 'unknown'}
      - Years in business: ${request.borrowerInfo?.yearsInBusiness ?? 'unknown'}

      What documents and information are needed to originate this loan?
      What is a reasonable timeline?

      Respond with JSON: { "immediateNeeds": [...], "estimatedTimeline": "..." }
    `

    const response = await this.llm.structured<{
      immediateNeeds: string[]
      estimatedTimeline: string
    }>(prompt, {
      type: 'object',
      properties: {
        immediateNeeds: { type: 'array', items: { type: 'string' } },
        estimatedTimeline: { type: 'string' },
      },
    })

    return response
  }

  private async classifyDocument(
    document: DocumentUpload
  ): Promise<DocumentProcessingResult['classification']> {
    const prompt = `
      Classify this document:
      - Filename: ${document.filename}
      - MIME type: ${document.mimeType}
      - Category hint: ${document.category ?? 'none'}

      What type of document is this? Common types:
      - financial_statement (balance_sheet, income_statement, cash_flow)
      - bank_statement
      - tax_return
      - corporate_doc (articles, bylaws, org_chart)
      - legal_doc (contract, agreement)
      - collateral_doc (appraisal, title)

      Respond with JSON: { "type": "...", "subtype": "...", "period": "...", "confidence": 0.0-1.0 }
    `

    return this.llm.structured(prompt, {
      type: 'object',
      properties: {
        type: { type: 'string' },
        subtype: { type: 'string' },
        period: { type: 'string' },
        confidence: { type: 'number' },
      },
    })
  }

  private async extractDocumentData(
    document: DocumentUpload,
    classification: DocumentProcessingResult['classification']
  ): Promise<Record<string, unknown>> {
    // Extraction logic based on document type
    // This would integrate with document parsing services
    return {}
  }

  private async processDocument(
    dealId: string,
    documentId: string,
    classification: DocumentProcessingResult['classification'],
    extracted: Record<string, unknown>
  ): Promise<void> {
    // Route to appropriate processing based on type
    switch (classification.type) {
      case 'financial_statement':
        // Create spread from extracted financials
        if (extracted.lineItems) {
          await this.los.spreads.create({
            deal_id: dealId,
            period: classification.period ?? 'unknown',
            line_items: extracted.lineItems as any,
          })
        }
        break

      case 'bank_statement':
        // Ingest transactions for monitoring
        if (extracted.transactions) {
          await this.los.monitoring.ingestTransactions({
            deal_id: dealId,
            transactions: extracted.transactions as any,
          })
        }
        break

      // ... other document types
    }
  }

  private async assessDocumentImpact(
    dealId: string,
    classification: DocumentProcessingResult['classification'],
    extracted: Record<string, unknown>
  ): Promise<string> {
    // Agent assesses how this document changes the deal
    const deal = await this.los.deals.get(dealId)

    const prompt = `
      A ${classification.type} document was uploaded to a deal.
      Deal stage: ${deal.stage}
      Document period: ${classification.period}

      How does this impact the deal? Respond in one sentence.
    `

    return this.llm.complete(prompt)
  }

  private async checkAndAdvanceDeal(dealId: string, ctx: AgentContext): Promise<void> {
    // Check if guards are satisfied for next stage
    const deal = await this.los.deals.get(dealId)
    const canAdvance = await this.los.stages.checkGuards(dealId, this.getNextStage(deal.stage))

    if (canAdvance.satisfied) {
      // Agent can advance automatically for some transitions
      const autoAdvanceStages = ['broker', 'origination']
      if (autoAdvanceStages.includes(deal.stage)) {
        await this.los.stages.transition(dealId, this.getNextStage(deal.stage), {
          actor: 'agent',
          rationale: 'All requirements satisfied',
        })
      }
    }
  }

  private async assessRisks(dealId: string): Promise<DealStatus['risks']> {
    const deal = await this.los.deals.get(dealId)
    const ratios = await this.los.spreads.getRatios(dealId)
    const covenants = await this.los.covenants.list(dealId)

    const prompt = `
      Assess risks for this deal:
      - Requested amount: $${deal.requested_amount}
      - Financial ratios: ${JSON.stringify(ratios)}
      - Covenant history: ${JSON.stringify(covenants)}

      Identify key risks. Respond with JSON array of:
      { "level": "low|medium|high|critical", "category": "...", "description": "...", "mitigations": [...] }
    `

    return this.llm.structured(prompt, {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          level: { type: 'string' },
          category: { type: 'string' },
          description: { type: 'string' },
          mitigations: { type: 'array', items: { type: 'string' } },
        },
      },
    })
  }

  private async getRecommendation(
    dealId: string
  ): Promise<DealStatus['recommendation'] | undefined> {
    const deal = await this.los.deals.get(dealId)

    // Only generate recommendations at certain stages
    if (!['origination', 'underwriting'].includes(deal.stage)) {
      return undefined
    }

    const ratios = await this.los.spreads.getRatios(dealId)

    const prompt = `
      Based on the financial analysis:
      - Requested: $${deal.requested_amount}
      - Purpose: ${deal.purpose}
      - Ratios: ${JSON.stringify(ratios)}

      What facility structure would you recommend?
      Respond with JSON: {
        "type": "facility_structure",
        "summary": "...",
        "rationale": "...",
        "details": { "amount": ..., "term": ..., "rate": ..., "covenants": [...] },
        "confidence": 0.0-1.0
      }
    `

    const recommendation = await this.llm.structured<NonNullable<DealStatus['recommendation']>>(prompt, {
      type: 'object',
      properties: {
        type: { type: 'string' },
        summary: { type: 'string' },
        rationale: { type: 'string' },
        details: { type: 'object' },
        confidence: { type: 'number' },
      },
    })

    return {
      ...recommendation,
      id: `rec_${dealId}_${Date.now()}`,
    }
  }

  private async generateExplanation(
    request: ExplanationRequest,
    deal: any,
    audit: any[]
  ): Promise<Explanation> {
    const relevantAudit = audit.filter((e) => this.isRelevantToTopic(e, request.topic))

    const prompt = `
      Explain the ${request.topic} for this loan origination deal.
      ${request.specificQuestion ? `Specific question: ${request.specificQuestion}` : ''}

      Deal context:
      - Borrower: ${deal.borrower_name}
      - Amount: $${deal.requested_amount}
      - Stage: ${deal.stage}

      Relevant events: ${JSON.stringify(relevantAudit.slice(0, 10))}

      Provide a clear explanation that a non-technical person could understand.
    `

    const explanation = await this.llm.complete(prompt)

    return {
      topic: request.topic,
      explanation,
      supportingData: {},
      auditReferences: relevantAudit.slice(0, 5).map((e) => ({
        eventId: e.id,
        timestamp: e.timestamp,
        event: e.event_type,
        relevance: 'Supporting evidence',
      })),
    }
  }

  // ============================================
  // Internal: Utilities
  // ============================================

  private buildContext(partial?: Partial<AgentContext>): AgentContext {
    return {
      tenantId: partial?.tenantId ?? this.defaultTenantId,
      actor: partial?.actor ?? 'agent',
      dealId: partial?.dealId,
    }
  }

  private mapStageToCustomerView(internalStage: string): DealStatus['stage'] {
    const mapping: Record<string, DealStatus['stage']> = {
      broker: 'intake',
      origination: 'document_collection',
      underwriting: 'analysis',
      closing: 'closing',
      monitoring: 'monitoring',
    }
    return mapping[internalStage] ?? 'intake'
  }

  private getNextStage(currentStage: string): string {
    const transitions: Record<string, string> = {
      broker: 'origination',
      origination: 'underwriting',
      underwriting: 'closing',
      closing: 'monitoring',
    }
    return transitions[currentStage] ?? currentStage
  }

  private async calculateProgress(deal: any, documents: any[]): Promise<number> {
    // Simple progress calculation based on stage and documents
    const stageProgress: Record<string, number> = {
      broker: 10,
      origination: 30,
      underwriting: 60,
      closing: 85,
      monitoring: 100,
    }
    return stageProgress[deal.stage] ?? 0
  }

  private async identifyBlockers(deal: any, documents: any[]): Promise<DealStatus['blockers']> {
    // Check what's missing for next stage
    const nextStage = this.getNextStage(deal.stage)
    const guards = await this.los.stages.getGuards(nextStage)

    const blockers: DealStatus['blockers'] = []
    for (const guard of guards) {
      const satisfied = await this.los.stages.checkGuard(deal.id, guard)
      if (!satisfied) {
        blockers.push({
          id: guard.id,
          type: 'missing_document',
          description: guard.description,
          resolution: guard.resolution,
          assignedTo: 'customer',
        })
      }
    }

    return blockers
  }

  private async generateStatusSummary(
    deal: any,
    progress: number,
    blockers: DealStatus['blockers']
  ): Promise<string> {
    if (blockers.length === 0) {
      return `${deal.borrower_name} loan origination is ${progress}% complete. Ready to proceed.`
    }

    const blockerSummary = blockers.map((b) => b.resolution).join(', ')
    return `${deal.borrower_name} loan origination is ${progress}% complete. Waiting on: ${blockerSummary}`
  }

  private async buildActionContext(approval: any, deal: any): Promise<ActionItem['context']> {
    return {
      summary: `${approval.type} for ${deal.borrower_name}`,
      risks: await this.assessRisks(deal.id),
    }
  }

  private mapApprovalType(internalType: string): ActionItem['type'] {
    return internalType as ActionItem['type']
  }

  private assessPriority(approval: any, deal: any): ActionItem['priority'] {
    // Logic to determine priority based on due date, amount, etc.
    return 'medium'
  }

  private generateActionTitle(approval: any): string {
    return `Review ${approval.type}`
  }

  private generateActionDescription(approval: any, deal: any): string {
    return `${approval.type} required for ${deal.borrower_name} deal`
  }

  private getActionOptions(approvalType: string): ActionItem['options'] {
    return [
      { id: 'approve', label: 'Approve', type: 'approve' },
      { id: 'reject', label: 'Reject', type: 'reject' },
      { id: 'modify', label: 'Approve with modifications', type: 'modify', requiresInput: true },
    ]
  }

  private async applyModifications(approval: any, modifications: Record<string, unknown>): Promise<void> {
    // Apply modifications to the relevant entity
  }

  private async continueWorkflow(
    dealId: string,
    approvalType: string,
    decision: Decision
  ): Promise<string[]> {
    // Agent continues the workflow based on decision
    if (decision.optionId === 'approve') {
      await this.checkAndAdvanceDeal(dealId, this.buildContext({ dealId }))
      return ['Deal advanced to next stage']
    }
    return ['Decision recorded']
  }

  private buildPortfolioSummary(
    deals: any[],
    alerts: any[],
    actionItems: ActionItem[]
  ): PortfolioSummary {
    const byStage: Record<string, { count: number; exposure: number }> = {}
    const byRisk: Record<string, { count: number; exposure: number }> = {}

    for (const deal of deals) {
      const stage = deal.stage
      if (!byStage[stage]) byStage[stage] = { count: 0, exposure: 0 }
      byStage[stage].count++
      byStage[stage].exposure += deal.requested_amount
    }

    return {
      totalDeals: deals.length,
      totalExposure: deals.reduce((sum, d) => sum + d.requested_amount, 0),
      byStage,
      byRisk,
      alerts: {
        critical: alerts.filter((a) => a.severity === 'critical').length,
        warning: alerts.filter((a) => a.severity === 'warning').length,
        info: alerts.filter((a) => a.severity === 'info').length,
      },
      recentActivity: [],
      attentionRequired: actionItems,
    }
  }

  private isRelevantToTopic(event: any, topic: string): boolean {
    // Filter logic based on topic
    return true
  }
}

// Placeholder types for services (would come from @open-los/core)
interface DealService {
  create(params: any): Promise<any>
  get(id: string): Promise<any>
  list(params: any): Promise<any[]>
  getPendingApprovals(tenantId: string): Promise<any[]>
}

interface StageService {
  checkGuards(dealId: string, stage: string): Promise<{ satisfied: boolean; unsatisfied: any[] }>
  checkGuard(dealId: string, guard: any): Promise<boolean>
  getGuards(stage: string): Promise<any[]>
  transition(dealId: string, stage: string, params: any): Promise<void>
}

interface DocumentService {
  create(params: any): Promise<any>
  listByDeal(dealId: string): Promise<any[]>
}

interface EntityService {
  create(params: any): Promise<any>
}

interface SpreadService {
  create(params: any): Promise<any>
  getRatios(dealId: string): Promise<any>
}

interface CovenantService {
  list(dealId: string): Promise<any[]>
}

interface FacilityService {
  create(params: any): Promise<any>
}

interface LoanService {
  create(params: any): Promise<any>
}

interface MonitoringService {
  ingestTransactions(params: any): Promise<void>
  getAlerts(tenantId: string): Promise<any[]>
}

interface AuditService {
  listByDeal(dealId: string): Promise<any[]>
}

interface ApprovalsService {
  get(id: string): Promise<any>
  decide(id: string, params: any): Promise<void>
}
