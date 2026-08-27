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
