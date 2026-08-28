import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import * as inventory from './inventory.server.js'

export const actorSchema = z.enum(['human', 'agent']).optional()

// Exported Zod schemas for WebMCP code-gen (single source of truth)
export const searchProductsSchema = z.object({
  query: z.string().min(1).optional().describe('Free-text match against product name or SKU'),
  category: z.string().min(1).optional().describe('Exact category name, e.g. Electronics'),
  limit: z.number().int().min(1).max(100).optional().describe('Max results, default 50'),
})
export const findLowStockSchema = z.object({
  days: z.number().int().min(1).max(90).optional().describe('Look-ahead window in days, default 7'),
  category: z.string().min(1).optional().describe('Restrict to one category'),
})
export const getProductDetailsSchema = z.object({
  productId: z.number().int().positive().describe('Product id from search_products.id'),
})
export const getSalesVelocitySchema = z.object({
  productId: z.number().int().positive().describe('Product id'),
  days: z.number().int().min(1).max(90).optional().describe('Trailing window days, default 14'),
})
export const analyzeStockRiskSchema = z.object({
  days: z.number().int().min(1).max(90).optional().describe('Look-ahead window days, default 7'),
  category: z.string().min(1).optional().describe('Category filter'),
  productId: z.number().int().positive().optional().describe('Limit to single product'),
})
export const recommendReorderSchema = z.object({
  productIds: z.array(z.number().int().positive()).optional().describe('Products to recommend for; omit for all at-risk'),
  targetCoverageDaysOverride: z.number().int().min(1).max(365).optional().describe("Override target coverage days"),
})
export const getPurchaseOrdersSchema = z.object({
  status: z.enum(['draft', 'approved', 'received']).optional().describe('Filter by status'),
})
export const getInventoryMovementsSchema = z.object({
  productId: z.number().int().positive().optional().describe('Filter by product'),
  type: z.enum(['sale', 'restock', 'adjustment', 'transfer_in', 'transfer_out', 'receiving']).optional().describe('Movement type'),
  limit: z.number().int().min(1).max(100).optional().describe('Max rows, default 50'),
})
export const getSuppliersSchema = z.object({})
export const getSupplierIntelligenceSchema = z.object({})
export const compareSuppliersSchema = z.object({
  productId: z.number().int().positive().describe('Product id'),
})
export const findDeadStockSchema = z.object({
  minDaysStale: z.number().int().min(1).max(365).optional().describe('Zero-sales window days, default 60'),
  category: z.string().min(1).optional().describe('Category filter'),
})
export const getInventoryHealthCheckSchema = z.object({})
export const whatShouldIWorryAboutSchema = z.object({})
export const forecastDemandSchema = z.object({
  productId: z.number().int().positive().describe('Product id'),
  horizonDays: z.number().int().min(1).max(90).optional().describe('Days to project, default 30'),
})
export const simulateInventorySchema = z.object({
  productId: z.number().int().positive().describe('Product id'),
  demandChangePct: z.number().min(-95).max(500).optional().describe('e.g. 25 for +25% demand'),
  leadTimeChangeDays: z.number().int().min(-30).max(90).optional().describe('e.g. 5 for 5 extra days'),
  horizonDays: z.number().int().min(1).max(90).optional().describe('Days to project'),
})
export const queryInventorySchema = z.object({
  query: z.string().min(1).describe('Natural language inventory question'),
})
export const generateReportSchema = z.object({
  query: z.string().min(1).describe('e.g. monthly inventory report or which suppliers are underperforming'),
  category: z.string().min(1).optional().describe('Category filter'),
})
export const buildReplenishmentPlanSchema = z.object({
  category: z.string().min(1).optional().describe('Category filter'),
  days: z.number().int().min(1).max(90).optional().describe('Look-ahead days, default 10'),
})
export const createReplenishmentProposalsSchema = buildReplenishmentPlanSchema
export const generateSkuSchema = z.object({
  category: z.string().min(1).describe('Category'),
  brand: z.string().min(1).describe('Brand'),
  model: z.string().min(1).describe('Model'),
  variant: z.string().min(1).optional().describe('Variant'),
})
export const draftProductSchema = z.object({
  category: z.string().min(1).describe('Category'),
  brand: z.string().min(1).describe('Brand'),
  model: z.string().min(1).describe('Model'),
  variant: z.string().min(1).optional().describe('Variant'),
  name: z.string().min(1).describe('Display name'),
  supplierId: z.number().int().positive().describe('Supplier id'),
  costCents: z.number().int().positive().describe('Cost in cents'),
  priceCents: z.number().int().positive().describe('Price in cents'),
  initialQuantity: z.number().int().min(0).optional().describe('Initial stock'),
  reorderThreshold: z.number().int().min(0).optional().describe('Reorder point'),
  targetCoverageDays: z.number().int().min(1).optional().describe('Target coverage days'),
})
export const createProductFromDraftSchema = z.object({
  sku: z.string().min(1).describe('SKU from draft'),
  name: z.string().min(1).describe('Name'),
  category: z.string().min(1).describe('Category'),
  supplierId: z.number().int().positive().describe('Supplier id'),
  costCents: z.number().int().positive().describe('Cost cents'),
  priceCents: z.number().int().positive().describe('Price cents'),
  quantity: z.number().int().min(0).optional().describe('Quantity'),
  reorderThreshold: z.number().int().min(0).optional().describe('Reorder threshold'),
  targetCoverageDays: z.number().int().min(1).optional().describe('Target coverage'),
})
export const createPurchaseOrderSchema = z.object({
  supplierId: z.number().int().positive().describe('Supplier id'),
  items: z.array(z.object({ productId: z.number().int().positive().describe('Product id'), quantity: z.number().int().positive().describe('Quantity') })).min(1).describe('Line items'),
  notes: z.string().optional().describe('Notes'),
  createdBy: actorSchema,
})
export const approvePurchaseOrderSchema = z.object({
  purchaseOrderId: z.number().int().positive().describe('Purchase order id'),
})
export const receiveShipmentSchema = z.object({
  purchaseOrderId: z.number().int().positive().describe('Purchase order id'),
  actor: actorSchema,
})
export const updateStockSchema = z.object({
  productId: z.number().int().positive().describe('Product id'),
  quantityDelta: z.number().int().refine((v) => v !== 0, 'quantityDelta must be non-zero').describe('Signed change, e.g. -3 or 10'),
  type: z.enum(['adjustment', 'transfer_in', 'transfer_out', 'restock']).describe('Movement type'),
  note: z.string().optional().describe('Reason'),
  actor: actorSchema,
})
export const revertMovementSchema = z.object({
  movementId: z.number().int().positive().describe('Movement id to revert'),
  actor: actorSchema,
})
export const listAgentActionsSchema = z.object({
  status: z.enum(['pending', 'approved', 'rejected', 'executed', 'failed']).optional().describe('Filter by status'),
})
export const proposeReplenishmentSchema = buildReplenishmentPlanSchema
export const decideAgentActionSchema = z.object({
  actionId: z.number().int().positive().describe('Agent action id'),
  decision: z.enum(['approved', 'rejected']).describe('Decision'),
})
// Server-only schema that includes decidedBy (not exposed to WebMCP)
export const decideAgentActionServerSchema = decideAgentActionSchema.extend({ decidedBy: actorSchema })

export const searchProductsFn = createServerFn({ method: 'GET' })
  .inputValidator(searchProductsSchema)
  .handler(({ data }) => inventory.searchProducts(data))

export const getInventorySummaryFn = createServerFn({ method: 'GET' }).handler(() => inventory.getInventorySummary())

export const findLowStockFn = createServerFn({ method: 'GET' })
  .inputValidator(findLowStockSchema)
  .handler(({ data }) => inventory.findLowStock(data))

export const getProductDetailsFn = createServerFn({ method: 'GET' })
  .inputValidator(getProductDetailsSchema)
  .handler(({ data }) => inventory.getProductDetails(data))

export const getSalesVelocityFn = createServerFn({ method: 'GET' })
  .inputValidator(getSalesVelocitySchema)
  .handler(({ data }) => inventory.getSalesVelocity(data))

export const analyzeStockRiskFn = createServerFn({ method: 'GET' })
  .inputValidator(analyzeStockRiskSchema)
  .handler(({ data }) => inventory.analyzeStockRisk(data))

export const recommendReorderFn = createServerFn({ method: 'GET' })
  .inputValidator(recommendReorderSchema)
  .handler(({ data }) => inventory.recommendReorder(data))

export const getPurchaseOrdersFn = createServerFn({ method: 'GET' })
  .inputValidator(getPurchaseOrdersSchema.optional())
  .handler(({ data }) => inventory.getPurchaseOrders(data ?? {}))

export const getSuppliersFn = createServerFn({ method: 'GET' }).handler(() => inventory.getSuppliers())

export const createPurchaseOrderFn = createServerFn({ method: 'POST' })
  .inputValidator(createPurchaseOrderSchema)
  .handler(({ data }) => inventory.createPurchaseOrder(data))

export const approvePurchaseOrderFn = createServerFn({ method: 'POST' })
  .inputValidator(approvePurchaseOrderSchema)
  .handler(({ data }) => inventory.approvePurchaseOrder(data))

export const receiveShipmentFn = createServerFn({ method: 'POST' })
  .inputValidator(receiveShipmentSchema)
  .handler(({ data }) => inventory.receiveShipment(data))

export const updateStockFn = createServerFn({ method: 'POST' })
  .inputValidator(updateStockSchema)
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
  .inputValidator(compareSuppliersSchema)
  .handler(({ data }) => inventory.compareSuppliers(data))

// ---------------------------------------------------------------------------
// Dead stock & health check
// ---------------------------------------------------------------------------

export const findDeadStockFn = createServerFn({ method: 'GET' })
  .inputValidator(findDeadStockSchema.optional())
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

export const generateSkuFn = createServerFn({ method: 'GET' })
  .inputValidator(generateSkuSchema)
  .handler(({ data }) => inventory.generateSku(data))

export const draftProductFn = createServerFn({ method: 'POST' })
  .inputValidator(draftProductSchema)
  .handler(({ data }) => inventory.draftProduct(data))

export const createProductFromDraftFn = createServerFn({ method: 'POST' })
  .inputValidator(createProductFromDraftSchema)
  .handler(({ data }) => inventory.createProductFromDraft(data))

// ---------------------------------------------------------------------------
// Agent Action Center
// ---------------------------------------------------------------------------

export const listAgentActionsFn = createServerFn({ method: 'GET' })
  .inputValidator(listAgentActionsSchema.optional())
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
  .inputValidator(decideAgentActionSchema)
  .handler(async ({ data }) => {
    // Server-derived actor — never trust client-supplied decidedBy (impersonation fix D4)
    const { getCookie } = await import('@tanstack/react-start/server')
    const { validateSessionToken, getSessionCookieName } = await import('./auth.server.js')
    const token = getCookie(getSessionCookieName())
    const user = token ? await validateSessionToken(token) : null
    const decidedBy = user ? (user.name as string) : 'human'
    return inventory.decideAgentAction({ ...data, decidedBy } as any)
  })

// ---------------------------------------------------------------------------
// Smart Replenishment
// ---------------------------------------------------------------------------

export const buildReplenishmentPlanFn = createServerFn({ method: 'GET' })
  .inputValidator(buildReplenishmentPlanSchema.optional())
  .handler(({ data }) => inventory.buildReplenishmentPlan(data ?? {}))

export const createReplenishmentProposalsFn = createServerFn({ method: 'POST' })
  .inputValidator(createReplenishmentProposalsSchema.optional())
  .handler(({ data }) => inventory.createReplenishmentProposals(data ?? {}))

// ---------------------------------------------------------------------------
// Inventory Simulator
// ---------------------------------------------------------------------------

export const simulateInventoryFn = createServerFn({ method: 'GET' })
  .inputValidator(simulateInventorySchema)
  .handler(({ data }) => inventory.simulateInventory(data))

// ---------------------------------------------------------------------------
// Reports Studio
// ---------------------------------------------------------------------------

export const generateReportFn = createServerFn({ method: 'GET' })
  .inputValidator(generateReportSchema)
  .handler(({ data }) => inventory.generateReport(data))

export const generateReportCsvFn = createServerFn({ method: 'GET' })
  .inputValidator(generateReportSchema)
  .handler(({ data }) => inventory.generateReportCsv(data))

// ---------------------------------------------------------------------------
// Natural-language querying
// ---------------------------------------------------------------------------

export const queryInventoryFn = createServerFn({ method: 'GET' })
  .inputValidator(queryInventorySchema)
  .handler(({ data }) => inventory.queryInventory(data))

// ---------------------------------------------------------------------------
// Movements & undo
// ---------------------------------------------------------------------------

export const getInventoryMovementsFn = createServerFn({ method: 'GET' })
  .inputValidator(getInventoryMovementsSchema.optional())
  .handler(({ data }) => inventory.getInventoryMovements(data ?? {}))

export const revertMovementFn = createServerFn({ method: 'POST' })
  .inputValidator(revertMovementSchema)
  .handler(({ data }) => inventory.revertMovement(data))

// ---------------------------------------------------------------------------
// Agent Missions
// ---------------------------------------------------------------------------

export const getMissionStatusFn = createServerFn({ method: 'GET' }).handler(() => inventory.getMissionStatus())
