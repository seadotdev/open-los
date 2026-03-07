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
  Recommendation,
  Explanation,
  PortfolioSummary,
  Alert,
  AlertSubscription,
} from './interface/types'

import type {
  OpenLOSServices,
  LLMClient,
  AgentConfig,
  AgentContext,
} from './types'

import type {
  RunPolicy,
  RunDecision,
  UnderwritingRun,
  RunCase,
  RunTrace,
  DecisionTerms,
  DecisionRationale,
} from '@open-los/core'
import { resolveUsageForTrace } from './llm/usage.js'

import { estimateCostUsd } from './pricing.js'

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

    const recommendation = await this.llm.structured<Omit<Recommendation, 'id'>>(prompt, {
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
  // Underwriting Evaluation
  // ============================================

  /**
   * Run a full underwriting evaluation on a deal.
   *
   * Produces an UnderwritingRun — the canonical contract type shared
   * between the LOS, SIM, and UW Bench.
   *
   * Flow:
   * 1. Fetch deal data, ratios, documents, audit
   * 2. Run deterministic rules baseline
   * 3. Call LLM with deal context + policy + rules baseline
   * 4. Assemble UnderwritingRun with rich trace
   * 5. On LLM failure, fall back to rules baseline
   */
  async evaluate(
    dealId: string,
    policy: RunPolicy,
    context?: Partial<AgentContext>,
    options?: { allowRulesFallback?: boolean }
  ): Promise<UnderwritingRun> {
    const ctx = this.buildContext(context)
    const startTime = Date.now()
    const runId = crypto.randomUUID()

    // 1. Fetch deal data
    const deal = await this.los.deals.get(dealId)
    const ratios = await this.los.spreads.getRatios(dealId)
    const docs = await this.los.documents.listByDeal(dealId)
    let borrowerGroup: { entities: any[]; relationships: any[] } | null = null
    if (deal.primary_entity_id) {
      try {
        borrowerGroup = await this.los.relationships.getBorrowerGroup(deal.primary_entity_id)
      } catch {
        borrowerGroup = null
      }
    }
    let auditEvents: any[] = []
    try { auditEvents = await this.los.audit.listByDeal(dealId) } catch { /* ok */ }

    // 2. Rules baseline
    const requestedAmount = deal.requested_amount ?? 0
    const requestedAmountDollars = requestedAmount / 100
    const policyParams = policy.params ?? {}
    const maxLoan = (policyParams.max_single_loan as number) ?? 500000
    const targetYield = (policyParams.target_yield_pct as number) ?? 10.0
    const rulesBaseline = this.runRulesBaseline(deal, ratios, requestedAmountDollars, maxLoan, targetYield, policyParams)

    // 3. Build LLM prompt and call
    const persona = (policyParams.persona as string) ?? 'a conservative commercial lender'
    const sectorLimits = policyParams.sector_limits
      ? JSON.stringify(policyParams.sector_limits)
      : 'none specified'

    const dscr = typeof ratios.dscr === 'number' ? ratios.dscr.toFixed(2) : 'N/A'
    const grossMargin = typeof ratios.gross_margin === 'number' ? (ratios.gross_margin * 100).toFixed(1) : 'N/A'
    const netMargin = typeof ratios.net_margin === 'number' ? (ratios.net_margin * 100).toFixed(1) : 'N/A'
    const currentRatio = typeof ratios.current_ratio === 'number' ? ratios.current_ratio.toFixed(2) : 'N/A'

    const allowRulesFallback = options?.allowRulesFallback ?? false

    const systemPrompt = `You are a senior credit analyst for ${persona}. Your lending parameters:
- Target yield: ${targetYield}%
- Maximum single loan: $${maxLoan.toLocaleString()}
- Sector limits: ${sectorLimits}

Evaluate this loan application and return a structured decision.
APR must be in DECIMAL form (0.095 = 9.5%). Maximum APR is 0.55.`

    const docList = Array.isArray(docs)
      ? docs.slice(0, 25).map((d: any) => {
        const name = d.filename ?? 'unknown'
        const type = d.doc_type ?? 'unknown'
        return `${type}:${name}`
      }).join(', ')
      : 'none'

    // Fetch document contents for financial docs (bank_statement, pnl)
    let docContentsSection = ''
    if (Array.isArray(docs)) {
      const financialDocs = docs.filter((d: any) =>
        ['bank_statement', 'pnl'].includes(d.doc_type)
      ).slice(0, 10)

      const contentParts: string[] = []
      for (const doc of financialDocs) {
        try {
          const contentResult = await this.los.documents.getContent(doc.id)
          if (contentResult?.content_base64) {
            const decoded = Buffer.from(contentResult.content_base64, 'base64').toString('utf-8')
            contentParts.push(`### ${doc.doc_type}: ${doc.filename}\n${decoded}`)
          }
        } catch {
          // Non-fatal: content retrieval may not be available
        }
      }
      if (contentParts.length > 0) {
        docContentsSection = '\n## Document Contents\n' + contentParts.join('\n\n')
      }
    }

    const dealContext = JSON.stringify({
      borrower_name: deal.borrower_name,
      jurisdiction: deal.jurisdiction,
      purpose: deal.purpose,
      custom_fields: deal.custom_fields ?? {},
      borrower_group_entities: borrowerGroup?.entities ?? [],
      borrower_group_relationships: borrowerGroup?.relationships ?? [],
      recent_audit_events: auditEvents.slice(-10).map((e: any) => ({
        type: e.type ?? e.event_type,
        timestamp: e.timestamp,
        actor: e.actor,
      })),
    })

    const userPrompt = `

## Borrower: ${deal.borrower_name}
## Financials
- Annual Revenue: See spread data  |  DSCR: ${dscr}x  |  Gross Margin: ${grossMargin}%
- Net Margin: ${netMargin}%  |  Current Ratio: ${currentRatio}
## Request: $${requestedAmountDollars.toLocaleString()} for ${deal.purpose ?? 'general business purposes'}
## Documents: ${docList}
## Borrower Group + Deal Context (JSON)
${dealContext}
## Rules baseline: ${rulesBaseline.action} (risk grade: ${rulesBaseline.risk_grade}, confidence: ${rulesBaseline.confidence}) — for reference, make your own assessment${docContentsSection}`

    const decisionSchema = {
      type: 'object' as const,
      properties: {
        action: { type: 'string', enum: ['approve', 'decline', 'counter', 'refer'] },
        risk_grade: { type: 'string', enum: ['A', 'B', 'C', 'D'] },
        prob_default_12m: { type: 'number' },
        terms: {
          type: 'object',
          properties: {
            amount: { type: 'number' },
            apr: { type: 'number' },
            tenor_months: { type: 'number' },
          },
        },
        rationale: {
          type: 'object',
          properties: {
            summary: { type: 'string' },
            key_factors: { type: 'array', items: { type: 'string' } },
            what_would_change: { type: 'array', items: { type: 'string' } },
          },
        },
        conditions: { type: 'array', items: { type: 'string' } },
        covenants: { type: 'array', items: { type: 'string' } },
        confidence: { type: 'number' },
      },
      required: ['action', 'risk_grade', 'rationale'],
    }

    // Try LLM, optionally fall back to rules on failure
    let decision: RunDecision
    const traceSteps: Array<{ t: string; type: 'tool_call' | 'note' | 'reasoning' | 'doc_request'; name?: string; content?: string; result?: Record<string, unknown> }> = []
    let tokensIn = 0
    let tokensOut = 0
    let costUsd = 0

    traceSteps.push({
      t: new Date(startTime).toISOString(),
      type: 'reasoning',
      name: 'rules_baseline',
      content: `Rules evaluation: ${rulesBaseline.action} (grade: ${rulesBaseline.risk_grade})`,
      result: rulesBaseline as unknown as Record<string, unknown>,
    })

    try {
      const llmResult = await this.llm.structured<{
        action: string
        risk_grade: string
        prob_default_12m?: number
        terms?: { amount?: number; apr?: number; tenor_months?: number }
        rationale: { summary?: string; key_factors?: string[]; what_would_change?: string[] }
        conditions?: string[]
        covenants?: string[]
        confidence?: number
      }>(userPrompt, decisionSchema, { system: systemPrompt })

      // Clamp APR to valid range
      if (llmResult.terms?.apr && llmResult.terms.apr > 0.55) {
        llmResult.terms.apr = 0.55
      }

      decision = {
        action: llmResult.action as RunDecision['action'],
        risk_grade: llmResult.risk_grade,
        prob_default_12m: llmResult.prob_default_12m ?? rulesBaseline.prob_default_12m,
        terms: llmResult.terms as DecisionTerms,
        conditions: llmResult.conditions ?? [],
        covenants: llmResult.covenants ?? [],
        rationale: llmResult.rationale as DecisionRationale,
        confidence: llmResult.confidence ?? 0.75,
      }

      traceSteps.push({
        t: new Date().toISOString(),
        type: 'tool_call',
        name: 'llm_evaluate',
        content: `LLM evaluation via ${policy.model}: ${decision.action}`,
      })

      traceSteps.push({
        t: new Date().toISOString(),
        type: 'reasoning',
        name: 'llm_rationale',
        content: decision.rationale?.summary ?? 'No rationale provided',
      })
    } catch (err: any) {
      if (!allowRulesFallback) {
        throw new Error(`LLM evaluation failed with fallback disabled: ${err?.message ?? 'unknown error'}`)
      }
      decision = rulesBaseline
      traceSteps.push({
        t: new Date().toISOString(),
        type: 'note',
        name: 'llm_fallback',
        content: `LLM call failed, using rules baseline: ${err?.message ?? 'unknown error'}`,
      })
    }

    // Capture usage regardless of success/failure so billed attempts are counted.
    const usage = resolveUsageForTrace(
      this.llm,
      (tokensInEstimate, tokensOutEstimate) =>
        estimateCostUsd(tokensInEstimate, tokensOutEstimate, policy.model)
    )
    tokensIn = usage.tokensIn
    tokensOut = usage.tokensOut
    costUsd = usage.costUsd

    const latencyMs = Date.now() - startTime

    const trace: RunTrace = {
      steps: traceSteps,
      latency_ms: latencyMs,
      cost: { tokens_in: tokensIn, tokens_out: tokensOut, estimated_cost_usd: costUsd },
    }

    const runCase: RunCase = {
      case_id: dealId,
      source: 'production',
      segment: 'smb_term_loan',
      jurisdiction: deal.jurisdiction ?? 'US',
      currency: 'USD',
      requested_amount: requestedAmountDollars,
      requested_purpose: deal.purpose ?? undefined,
    }

    return {
      run_id: runId,
      timestamp_utc: new Date().toISOString(),
      case: runCase,
      policy,
      decision,
      trace,
    }
  }

  private runRulesBaseline(
    deal: any,
    ratios: any,
    requestedAmountDollars: number,
    maxLoan: number,
    targetYield: number,
    policyParams: Record<string, unknown>
  ): RunDecision {
    const dscr = typeof ratios.dscr === 'number' ? ratios.dscr : null
    const grossMargin = typeof ratios.gross_margin === 'number' ? ratios.gross_margin : null

    let action: string = 'approve'
    let riskGrade = 'B'
    let confidence = 0.70
    let probDefault = 0.05
    const keyFactors: string[] = []
    const conditions: string[] = []
    const whatWouldChange: string[] = []

    if (requestedAmountDollars > maxLoan) {
      action = 'decline'
      riskGrade = 'D'
      confidence = 0.95
      probDefault = 0.30
      keyFactors.push(`Requested amount $${requestedAmountDollars.toLocaleString()} exceeds maximum $${maxLoan.toLocaleString()}`)
      whatWouldChange.push('Reduce loan amount below maximum threshold')
    }

    if (dscr !== null && dscr < 1.0) {
      action = 'decline'
      riskGrade = 'D'
      confidence = 0.90
      probDefault = 0.40
      keyFactors.push(`DSCR ${dscr.toFixed(2)}x is below 1.0x minimum`)
      whatWouldChange.push('Improve cash flow to achieve DSCR >= 1.2x')
    } else if (dscr !== null && dscr < 1.2) {
      if (action === 'approve') action = 'refer'
      riskGrade = 'C'
      probDefault = 0.15
      keyFactors.push(`DSCR ${dscr.toFixed(2)}x is marginal (below 1.2x)`)
      conditions.push('Quarterly financial reporting required')
    } else if (dscr !== null) {
      keyFactors.push(`DSCR ${dscr.toFixed(2)}x provides adequate debt service coverage`)
    }

    if (grossMargin !== null && grossMargin < 0.10) {
      if (action === 'approve') action = 'refer'
      riskGrade = 'C'
      probDefault = Math.max(probDefault, 0.20)
      keyFactors.push(`Gross margin ${(grossMargin * 100).toFixed(1)}% is very thin`)
      whatWouldChange.push('Improve gross margins above 15%')
    } else if (grossMargin !== null) {
      keyFactors.push(`Gross margin ${(grossMargin * 100).toFixed(1)}% is healthy`)
    }

    if (policyParams.sector_limits && typeof policyParams.sector_limits === 'object') {
      const sectorLimits = policyParams.sector_limits as Record<string, number>
      const sector = deal.custom_fields?.sector as string | undefined
      const totalCapital = typeof policyParams.total_capital === 'number' ? policyParams.total_capital : null
      const portfolio = Array.isArray(policyParams.existing_portfolio)
        ? policyParams.existing_portfolio as Array<{ sector?: string; remaining_balance?: number }>
        : []
      if (sector && totalCapital && totalCapital > 0 && sectorLimits[sector] != null) {
        const existingExposure = portfolio
          .filter((loan) => loan.sector === sector)
          .reduce((sum, loan) => sum + (loan.remaining_balance ?? 0), 0)
        const projectedPct = (existingExposure + requestedAmountDollars) / totalCapital
        if (projectedPct > sectorLimits[sector]) {
          action = 'decline'
          riskGrade = 'D'
          confidence = Math.max(confidence, 0.9)
          probDefault = Math.max(probDefault, 0.25)
          keyFactors.push(
            `Sector concentration breach for ${sector}: projected ${(projectedPct * 100).toFixed(1)}% exceeds ${(sectorLimits[sector] * 100).toFixed(1)}% limit`
          )
          whatWouldChange.push(`Reduce sector exposure for ${sector} or increase total capital`)
        }
      }
    }

    if (action === 'approve') {
      if (dscr !== null && dscr >= 1.5 && grossMargin !== null && grossMargin >= 0.25) {
        riskGrade = 'A'
        probDefault = 0.02
        confidence = 0.85
      } else {
        riskGrade = 'B'
        probDefault = 0.05
        confidence = 0.75
      }
    }

    const terms: DecisionTerms = {}
    if (action === 'approve' || action === 'counter') {
      const baseRate = targetYield / 100
      const riskPremium = riskGrade === 'A' ? 0.0 : riskGrade === 'B' ? 0.02 : 0.05
      terms.amount = action === 'counter'
        ? Math.min(requestedAmountDollars, maxLoan * 0.8)
        : requestedAmountDollars
      terms.apr = baseRate + riskPremium
      if (terms.apr > 0.55) terms.apr = 0.55
      terms.tenor_months = 24
      terms.fees = { origination: Math.round(terms.amount * 0.01) }
    }

    const rationale: DecisionRationale = {
      summary: action === 'approve'
        ? `Approved based on ${keyFactors[0]?.toLowerCase() ?? 'acceptable risk profile'}.`
        : action === 'decline'
          ? `Declined: ${keyFactors[0] ?? 'insufficient risk profile'}.`
          : `Referred for manual review: ${keyFactors[0] ?? 'marginal indicators'}.`,
      key_factors: keyFactors,
      what_would_change: whatWouldChange,
    }

    return {
      action: action as RunDecision['action'],
      risk_grade: riskGrade,
      prob_default_12m: probDefault,
      terms,
      conditions,
      covenants: dscr !== null && dscr < 1.5 ? ['DSCR >= 1.2x quarterly'] : [],
      rationale,
      confidence,
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
