import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import * as inventory from './inventory.server.js'

const actorSchema = z.enum(['human', 'agent']).optional()

export const searchProductsFn = createServerFn({ method: 'GET' })
  .inputValidator(
    z.object({ query: z.string().optional(), category: z.string().optional(), limit: z.number().optional() }),
  )
  .handler(({ data }) => inventory.searchProducts(data))

export const getInventorySummaryFn = createServerFn({ method: 'GET' }).handler(() =>
  inventory.getInventorySummary(),
)

export const findLowStockFn = createServerFn({ method: 'GET' })
  .inputValidator(z.object({ days: z.number().min(1).max(90).optional(), category: z.string().optional() }))
  .handler(({ data }) => inventory.findLowStock(data))

export const getProductDetailsFn = createServerFn({ method: 'GET' })
  .inputValidator(z.object({ productId: z.number() }))
  .handler(({ data }) => inventory.getProductDetails(data))

export const getSalesVelocityFn = createServerFn({ method: 'GET' })
  .inputValidator(z.object({ productId: z.number(), days: z.number().min(1).max(90).optional() }))
  .handler(({ data }) => inventory.getSalesVelocity(data))

export const analyzeStockRiskFn = createServerFn({ method: 'GET' })
  .inputValidator(
    z.object({
      days: z.number().min(1).max(90).optional(),
      category: z.string().optional(),
      productId: z.number().optional(),
    }),
  )
  .handler(({ data }) => inventory.analyzeStockRisk(data))

export const recommendReorderFn = createServerFn({ method: 'GET' })
  .inputValidator(
    z.object({
      productIds: z.array(z.number()).optional(),
      targetCoverageDaysOverride: z.number().min(1).max(365).optional(),
    }),
  )
  .handler(({ data }) => inventory.recommendReorder(data))

export const getPurchaseOrdersFn = createServerFn({ method: 'GET' })
  .inputValidator(z.object({ status: z.string().optional() }).optional())
  .handler(({ data }) => inventory.getPurchaseOrders(data ?? {}))

export const getSuppliersFn = createServerFn({ method: 'GET' }).handler(() => inventory.getSuppliers())

export const createPurchaseOrderFn = createServerFn({ method: 'POST' })
  .inputValidator(
    z.object({
      supplierId: z.number(),
      items: z.array(z.object({ productId: z.number(), quantity: z.number().positive() })).min(1),
      notes: z.string().optional(),
      createdBy: actorSchema,
    }),
  )
  .handler(({ data }) => inventory.createPurchaseOrder(data))

export const approvePurchaseOrderFn = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ purchaseOrderId: z.number() }))
  .handler(({ data }) => inventory.approvePurchaseOrder(data))

export const receiveShipmentFn = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ purchaseOrderId: z.number(), actor: actorSchema }))
  .handler(({ data }) => inventory.receiveShipment(data))

export const updateStockFn = createServerFn({ method: 'POST' })
  .inputValidator(
    z.object({
      productId: z.number(),
      quantityDelta: z.number().int(),
      type: z.enum(['adjustment', 'transfer_in', 'transfer_out', 'restock']),
      note: z.string().optional(),
      actor: actorSchema,
    }),
  )
  .handler(({ data }) => inventory.updateStock(data))

export const logAgentToolCallFn = createServerFn({ method: 'POST' })
  .inputValidator(
    z.object({
      toolName: z.string(),
      input: z.unknown(),
      summary: z.string(),
      consequential: z.boolean(),
    }),
  )
  .handler(({ data }) => inventory.logAgentToolCall(data))

export const getRecentAgentActivityFn = createServerFn({ method: 'GET' })
  .inputValidator(z.object({ limit: z.number().optional() }).optional())
  .handler(({ data }) => inventory.getRecentAgentActivity(data?.limit))

// ---------------------------------------------------------------------------
// Supplier intelligence & comparison
// ---------------------------------------------------------------------------

export const getSupplierIntelligenceFn = createServerFn({ method: 'GET' }).handler(() =>
  inventory.getSupplierIntelligence(),
)

export const compareSuppliersFn = createServerFn({ method: 'GET' })
  .inputValidator(z.object({ productId: z.number() }))
  .handler(({ data }) => inventory.compareSuppliers(data))

// ---------------------------------------------------------------------------
// Dead stock & health check
// ---------------------------------------------------------------------------

export const findDeadStockFn = createServerFn({ method: 'GET' })
  .inputValidator(z.object({ minDaysStale: z.number().min(1).max(365).optional(), category: z.string().optional() }).optional())
  .handler(({ data }) => inventory.findDeadStock(data ?? {}))

export const getInventoryHealthCheckFn = createServerFn({ method: 'GET' }).handler(() =>
  inventory.getInventoryHealthCheck(),
)

export const whatShouldIWorryAboutFn = createServerFn({ method: 'GET' }).handler(() =>
  inventory.whatShouldIWorryAbout(),
)

// ---------------------------------------------------------------------------
// Product & SKU generation
// ---------------------------------------------------------------------------

const skuPartsSchema = z.object({
  category: z.string(),
  brand: z.string(),
  model: z.string(),
  variant: z.string().optional(),
})

export const generateSkuFn = createServerFn({ method: 'GET' })
  .inputValidator(skuPartsSchema)
  .handler(({ data }) => inventory.generateSku(data))

export const draftProductFn = createServerFn({ method: 'POST' })
  .inputValidator(
    skuPartsSchema.extend({
      name: z.string(),
      supplierId: z.number(),
      costCents: z.number().positive(),
      priceCents: z.number().positive(),
      initialQuantity: z.number().min(0).optional(),
      reorderThreshold: z.number().min(0).optional(),
      targetCoverageDays: z.number().min(1).optional(),
    }),
  )
  .handler(({ data }) => inventory.draftProduct(data))

export const createProductFromDraftFn = createServerFn({ method: 'POST' })
  .inputValidator(
    z.object({
      sku: z.string(),
      name: z.string(),
      category: z.string(),
      supplierId: z.number(),
      costCents: z.number().positive(),
      priceCents: z.number().positive(),
      quantity: z.number().min(0).optional(),
      reorderThreshold: z.number().min(0).optional(),
      targetCoverageDays: z.number().min(1).optional(),
    }),
  )
  .handler(({ data }) => inventory.createProductFromDraft(data))

// ---------------------------------------------------------------------------
// Agent Action Center
// ---------------------------------------------------------------------------

export const listAgentActionsFn = createServerFn({ method: 'GET' })
  .inputValidator(z.object({ status: z.string().optional() }).optional())
  .handler(({ data }) => inventory.listAgentActions(data ?? {}))

export const proposeAgentActionFn = createServerFn({ method: 'POST' })
  .inputValidator(
    z.object({
      type: z.enum(['replenishment', 'reorder_point_change', 'purchase_order']),
      title: z.string(),
      reasoning: z.string(),
      impact: z.enum(['low', 'medium', 'high']).optional(),
      payload: z.unknown(),
      relatedProductIds: z.array(z.number()).optional(),
      estimatedCostCents: z.number().optional(),
      proposedBy: actorSchema,
    }),
  )
  .handler(({ data }) => inventory.proposeAgentAction(data))

export const decideAgentActionFn = createServerFn({ method: 'POST' })
  .inputValidator(
    z.object({
      actionId: z.number(),
      decision: z.enum(['approved', 'rejected']),
      decidedBy: actorSchema,
    }),
  )
  .handler(({ data }) => inventory.decideAgentAction(data))

// ---------------------------------------------------------------------------
// Smart Replenishment
// ---------------------------------------------------------------------------

export const buildReplenishmentPlanFn = createServerFn({ method: 'GET' })
  .inputValidator(z.object({ category: z.string().optional(), days: z.number().min(1).max(90).optional() }).optional())
  .handler(({ data }) => inventory.buildReplenishmentPlan(data ?? {}))

export const createReplenishmentProposalsFn = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ category: z.string().optional(), days: z.number().min(1).max(90).optional() }).optional())
  .handler(({ data }) => inventory.createReplenishmentProposals(data ?? {}))

// ---------------------------------------------------------------------------
// Inventory Simulator
// ---------------------------------------------------------------------------

export const simulateInventoryFn = createServerFn({ method: 'GET' })
  .inputValidator(
    z.object({
      productId: z.number(),
      demandChangePct: z.number().min(-95).max(500).optional(),
      leadTimeChangeDays: z.number().min(-30).max(90).optional(),
      horizonDays: z.number().min(1).max(90).optional(),
    }),
  )
  .handler(({ data }) => inventory.simulateInventory(data))

// ---------------------------------------------------------------------------
// Reports Studio
// ---------------------------------------------------------------------------

export const generateReportFn = createServerFn({ method: 'GET' })
  .inputValidator(z.object({ query: z.string(), category: z.string().optional() }))
  .handler(({ data }) => inventory.generateReport(data))

export const generateReportCsvFn = createServerFn({ method: 'GET' })
  .inputValidator(z.object({ query: z.string(), category: z.string().optional() }))
  .handler(({ data }) => inventory.generateReportCsv(data))

// ---------------------------------------------------------------------------
// Natural-language querying
// ---------------------------------------------------------------------------

export const queryInventoryFn = createServerFn({ method: 'GET' })
  .inputValidator(z.object({ query: z.string() }))
  .handler(({ data }) => inventory.queryInventory(data))

// ---------------------------------------------------------------------------
// Movements & undo
// ---------------------------------------------------------------------------

export const getInventoryMovementsFn = createServerFn({ method: 'GET' })
  .inputValidator(
    z.object({ productId: z.number().optional(), type: z.string().optional(), limit: z.number().optional() }).optional(),
  )
  .handler(({ data }) => inventory.getInventoryMovements(data ?? {}))

export const revertMovementFn = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ movementId: z.number(), actor: actorSchema }))
  .handler(({ data }) => inventory.revertMovement(data))

// ---------------------------------------------------------------------------
// Agent Missions
// ---------------------------------------------------------------------------

export const getMissionStatusFn = createServerFn({ method: 'GET' }).handler(() => inventory.getMissionStatus())
