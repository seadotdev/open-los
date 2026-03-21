/**
 * Service Adapter Layer (Anti-Corruption Pattern)
 *
 * Bridges between what the LoanOriginationAgent expects (OpenLOSServices)
 * and what the real core services provide (AppContext). This keeps agent.ts
 * clean and isolates all interface translation in one place.
 */

import { STAGE_GUARDS } from '@open-los/core'
import type { StageGuard, GuardContext } from '@open-los/core'
import type { OpenLOSServices } from '../types.js'

/**
 * Minimal shape of AppContext services needed by the adapter.
 * Using structural typing so we don't need to import AppContext directly.
 */
export interface CoreServices {
  dealService: {
    getById(id: string, tenantId?: string): Promise<any>
    create(input: any, actor: string, tenantId?: string): Promise<any>
    list(tenantId?: string, filters?: any): Promise<any>
  }
  documentService: {
    upload(dealId: string, input: any, actor: string, tenantId?: string): Promise<any>
    listByDeal(dealId: string, tenantId?: string): Promise<any>
    getContent?(docId: string, tenantId?: string): Promise<any>
  }
  stageService: {
    transition(dealId: string, input: any, actor: string, user?: any, tenantId?: string): Promise<any>
    listByDeal(dealId: string, tenantId?: string): Promise<any>
  }
  entityService: {
    create(input: any, actor: string, dealId?: string, tenantId?: string): Promise<any>
  }
  relationshipService: {
    getBorrowerGroup(primaryEntityId: string): Promise<any>
  }
  spreadService: {
    create(dealId: string, input: any, actor: string): Promise<any>
    getRatios(dealId: string): Promise<any>
  }
  covenantService: {
    list(dealId: string): Promise<any>
  }
  facilityService: {
    create(dealId: string, input: any, actor: string): Promise<any>
  }
  loanAccountService: {
    create(input: any, actor: string, tenantId?: string): Promise<any>
  }
  monitoringService: {
    ingest(dealId: string, input: any, actor: string): Promise<any>
    getStatus(dealId: string, actor: string): Promise<any>
  }
  auditService: {
    listByDeal(dealId: string, filters?: any): Promise<any>
  }
  approvalService?: {
    getById(dealId: string, requestId: string): Promise<any>
    decide(dealId: string, requestId: string, input: any, decidedBy: string): Promise<any>
    list(dealId: string, filters?: any): Promise<any>
  }
}

export interface AdapterContext {
  tenantId: string
  actor: string
}

export function createAgentServices(
  ctx: CoreServices,
  agentCtx: AdapterContext
): OpenLOSServices {
  const { tenantId, actor } = agentCtx

  return {
    deals: {
      async get(id: string) {
        return ctx.dealService.getById(id, tenantId)
      },
      async create(params: any) {
        return ctx.dealService.create(params, actor, tenantId)
      },
      async list(params: any) {
        const result = await ctx.dealService.list(tenantId, params)
        // DealService.list returns { deals, total, next_cursor }
        return result?.deals ?? result ?? []
      },
      async getPendingApprovals(_tenantId: string) {
        // Scan recent deals and check for pending approvals
        if (!ctx.approvalService) return []
        try {
          const dealResult = await ctx.dealService.list(tenantId, { limit: 50 })
          const dealList = dealResult?.deals ?? []
          const pending: any[] = []
          for (const deal of dealList) {
            try {
              const approvals = await ctx.approvalService.list(deal.id, { status: 'pending' })
              const requests = approvals?.requests ?? []
              for (const req of requests) {
                pending.push({ ...req, deal })
              }
            } catch { /* skip deals without approvals */ }
          }
          return pending
        } catch {
          return []
        }
      },
    },

    stages: {
      async checkGuards(dealId: string, stage: string) {
        const deal = await ctx.dealService.getById(dealId, tenantId)
        const docs = await ctx.documentService.listByDeal(dealId, tenantId)
        const docCount = Array.isArray(docs) ? docs.length : 0
        const guards = STAGE_GUARDS[stage] ?? []
        const guardCtx: GuardContext = { deal, docCount, spreadCount: 0 }

        const unsatisfied = guards
          .filter((g: StageGuard) => !g.check(guardCtx))
          .map((g: StageGuard) => ({ item: g.item }))

        return { satisfied: unsatisfied.length === 0, unsatisfied }
      },
      async checkGuard(dealId: string, guard: any) {
        const deal = await ctx.dealService.getById(dealId, tenantId)
        const docs = await ctx.documentService.listByDeal(dealId, tenantId)
        const docCount = Array.isArray(docs) ? docs.length : 0
        const guardCtx: GuardContext = { deal, docCount, spreadCount: 0 }

        if (typeof guard.check === 'function') {
          return guard.check(guardCtx)
        }
        // Look up guard by item name in STAGE_GUARDS
        for (const guards of Object.values(STAGE_GUARDS)) {
          const found = guards.find((g: StageGuard) => g.item === guard.id || g.item === guard.item)
          if (found) return found.check(guardCtx)
        }
        return false
      },
      async getGuards(stage: string) {
        const guards = STAGE_GUARDS[stage] ?? []
        return guards.map((g: StageGuard) => ({
          id: g.item,
          item: g.item,
          description: `Guard: ${g.item}`,
          resolution: `Satisfy ${g.item} requirement`,
          check: g.check,
        }))
      },
      async transition(dealId: string, stage: string, params: any) {
        await ctx.stageService.transition(
          dealId,
          { to_stage: stage, rationale: params?.rationale, override: params?.override, override_rationale: params?.override_rationale },
          params?.actor ?? actor,
          params?.actor ? undefined : { id: actor, role: 'credit_lead' },
          tenantId,
        )
      },
    },

    documents: {
      async create(params: any) {
        return ctx.documentService.upload(
          params.deal_id,
          {
            doc_type: params.doc_type ?? params.type,
            filename: params.filename,
            phase: params.phase,
            content_base64: params.content_base64 ?? params.content,
          },
          actor,
          tenantId
        )
      },
      async listByDeal(dealId: string) {
        return ctx.documentService.listByDeal(dealId, tenantId)
      },
      async getContent(docId: string) {
        if (ctx.documentService.getContent) {
          return ctx.documentService.getContent(docId, tenantId)
        }
        return null
      },
    },

    entities: {
      async create(params: any) {
        return ctx.entityService.create(
          { type: params.type, name: params.name, legal_name: params.legal_name, identifiers: params.identifiers },
          actor,
          params.deal_id,
          tenantId
        )
      },
    },

    relationships: {
      async getBorrowerGroup(primaryEntityId: string) {
        return ctx.relationshipService.getBorrowerGroup(primaryEntityId)
      },
    },

    spreads: {
      async create(params: any) {
        return ctx.spreadService.create(
          params.deal_id,
          { entity_id: params.entity_id, period: params.period, line_items: params.line_items, metrics: params.metrics },
          actor
        )
      },
      async getRatios(dealId: string) {
        const result = await ctx.spreadService.getRatios(dealId)
        // getRatios returns { ratios: Array }; agent expects the first ratio set
        return result?.ratios?.[0] ?? {}
      },
    },

    covenants: {
      async list(dealId: string) {
        const result = await ctx.covenantService.list(dealId)
        // CovenantService.list returns { covenants: Array }
        return result?.covenants ?? result ?? []
      },
    },

    facilities: {
      async create(params: any) {
        return ctx.facilityService.create(
          params.deal_id,
          { type: params.type, amount: params.amount, currency: params.currency, interest_rate_type: params.interest_rate_type, interest_rate_value: params.interest_rate_value, term_months: params.term_months },
          actor
        )
      },
    },

    loans: {
      async create(params: any) {
        return ctx.loanAccountService.create(params, actor, tenantId)
      },
    },

    monitoring: {
      async ingestTransactions(params: any) {
        await ctx.monitoringService.ingest(
          params.deal_id,
          { source_type: params.source_type ?? 'manual', transactions: params.transactions ?? [] },
          actor
        )
      },
      async getAlerts(_tenantId: string) {
        // Tenant-wide alert scan requires iterating all deals.
        // Return empty for now — per plan, this is deferred.
        return []
      },
    },

    audit: {
      async listByDeal(dealId: string) {
        const result = await ctx.auditService.listByDeal(dealId)
        // AuditService.listByDeal returns { events, total, next_cursor }
        return result?.events ?? result ?? []
      },
    },

    approvals: {
      async get(id: string) {
        if (!ctx.approvalService) throw new Error('ApprovalService not available')
        // Agent calls with just requestId — we need to look up the dealId.
        // For now, scan recent deals to find the approval request.
        const dealResult = await ctx.dealService.list(tenantId, { limit: 100 })
        const dealList = dealResult?.deals ?? []
        for (const deal of dealList) {
          try {
            return await ctx.approvalService.getById(deal.id, id)
          } catch { /* not in this deal */ }
        }
        throw new Error(`Approval request ${id} not found`)
      },
      async decide(id: string, params: any) {
        if (!ctx.approvalService) throw new Error('ApprovalService not available')
        // Same pattern: find the dealId for this request
        const dealResult = await ctx.dealService.list(tenantId, { limit: 100 })
        const dealList = dealResult?.deals ?? []
        for (const deal of dealList) {
          try {
            await ctx.approvalService.getById(deal.id, id)
            // Found it — now decide
            await ctx.approvalService.decide(
              deal.id,
              id,
              { decision: params.decision, rationale: params.rationale },
              params.decided_by ?? actor
            )
            return
          } catch { /* not in this deal */ }
        }
        throw new Error(`Approval request ${id} not found`)
      },
    },
  }
}
