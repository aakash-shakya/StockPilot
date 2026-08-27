import { and, desc, eq, gte, ilike, inArray, lt, or, sql } from 'drizzle-orm'
import { db } from '../../db/index.js'
import {
  agentToolCalls,
  inventoryMovements,
  products,
  purchaseOrderItems,
  purchaseOrders,
  suppliers,
} from '../../db/schema.js'
import { riskLevelFor, round1 } from './format.js'
import type { RiskLevel } from './format.js'

export type Actor = 'human' | 'agent'

// ---------------------------------------------------------------------------
// Velocity helpers
// ---------------------------------------------------------------------------

/** Total units sold per product between `sinceDaysAgo` and `untilDaysAgo` (both from now, sinceDaysAgo > untilDaysAgo). */
async function soldUnitsByProduct(sinceDaysAgo: number, untilDaysAgo: number) {
  sinceDaysAgo = Math.min(365, Math.max(1, Math.round(sinceDaysAgo)))
  untilDaysAgo = Math.min(sinceDaysAgo - 1, Math.max(0, Math.round(untilDaysAgo)))
  const rows = await db
    .select({
      productId: inventoryMovements.productId,
      units: sql<string>`sum(-${inventoryMovements.quantityDelta})`,
    })
    .from(inventoryMovements)
    .where(
      and(
        eq(inventoryMovements.type, 'sale'),
        gte(
          inventoryMovements.createdAt,
          sql`now() - interval '${sql.raw(String(sinceDaysAgo))} days'`,
        ),
        lt(
          inventoryMovements.createdAt,
          sql`now() - interval '${sql.raw(String(untilDaysAgo))} days'`,
        ),
      ),
    )
    .groupBy(inventoryMovements.productId)

  const map = new Map<number, number>()
  for (const row of rows) map.set(row.productId, Number(row.units) || 0)
  return map
}

async function velocityWindows() {
  const [recentUnits, baselineUnits] = await Promise.all([
    soldUnitsByProduct(7, 0),
    soldUnitsByProduct(30, 7),
  ])
  return { recentUnits, baselineUnits }
}

function trendFor(recent: number, baseline: number): 'accelerating' | 'steady' | 'declining' {
  if (baseline <= 0) return recent > 0 ? 'accelerating' : 'steady'
  const ratio = recent / baseline
  if (ratio >= 1.4) return 'accelerating'
  if (ratio <= 0.7) return 'declining'
  return 'steady'
}

// ---------------------------------------------------------------------------
// Product search & summary
// ---------------------------------------------------------------------------

export async function searchProducts(input: { query?: string; category?: string; limit?: number }) {
  const conditions = []
  if (input.query) {
    conditions.push(
      or(ilike(products.name, `%${input.query}%`), ilike(products.sku, `%${input.query}%`)),
    )
  }
  if (input.category) {
    conditions.push(eq(products.category, input.category))
  }

  const rows = await db
    .select({
      id: products.id,
      sku: products.sku,
      name: products.name,
      category: products.category,
      quantity: products.quantity,
      reorderThreshold: products.reorderThreshold,
      priceCents: products.priceCents,
      supplierName: suppliers.name,
    })
    .from(products)
    .innerJoin(suppliers, eq(products.supplierId, suppliers.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(products.name)
    .limit(input.limit ?? 50)

  return rows
}

async function riskForProducts(productIds?: number[]) {
  const { recentUnits, baselineUnits } = await velocityWindows()

  const rows = await db
    .select({
      id: products.id,
      sku: products.sku,
      name: products.name,
      category: products.category,
      quantity: products.quantity,
      reorderThreshold: products.reorderThreshold,
      targetCoverageDays: products.targetCoverageDays,
      costCents: products.costCents,
      supplierId: products.supplierId,
      supplierName: suppliers.name,
      leadTimeDays: suppliers.leadTimeDays,
      delayDays: suppliers.delayDays,
      delayNote: suppliers.delayNote,
    })
    .from(products)
    .innerJoin(suppliers, eq(products.supplierId, suppliers.id))
    .where(productIds && productIds.length ? inArray(products.id, productIds) : undefined)

  return rows.map((p) => {
    const recentDaily = round1((recentUnits.get(p.id) ?? 0) / 7)
    const baselineDaily = round1((baselineUnits.get(p.id) ?? 0) / 23)
    const velocity = recentDaily > 0 ? recentDaily : baselineDaily
    const coverageDays = velocity > 0 ? round1(p.quantity / velocity) : null
    const riskLevel: RiskLevel =
      p.quantity <= p.reorderThreshold && (coverageDays === null || coverageDays > 5)
        ? 'warning'
        : riskLevelFor(coverageDays)
    const projectedStockoutDate =
      coverageDays !== null
        ? new Date(Date.now() + coverageDays * 86400000).toISOString().slice(0, 10)
        : null

    return {
      productId: p.id,
      sku: p.sku,
      name: p.name,
      category: p.category,
      quantity: p.quantity,
      reorderThreshold: p.reorderThreshold,
      targetCoverageDays: p.targetCoverageDays,
      costCents: p.costCents,
      supplierId: p.supplierId,
      supplierName: p.supplierName,
      leadTimeDays: p.leadTimeDays,
      delayDays: p.delayDays,
      delayNote: p.delayNote,
      recentDailyVelocity: recentDaily,
      baselineDailyVelocity: baselineDaily,
      trend: trendFor(recentDaily, baselineDaily),
      coverageDays,
      projectedStockoutDate,
      riskLevel,
    }
  })
}

export async function getInventorySummary() {
  const risk = await riskForProducts()
  const totalUnits = risk.reduce((sum, p) => sum + p.quantity, 0)
  const covered = risk.filter((p) => p.coverageDays !== null)
  const avgCoverageDays = covered.length
    ? round1(covered.reduce((sum, p) => sum + (p.coverageDays ?? 0), 0) / covered.length)
    : null

  return {
    totalProducts: risk.length,
    totalUnits,
    criticalCount: risk.filter((p) => p.riskLevel === 'critical').length,
    warningCount: risk.filter((p) => p.riskLevel === 'warning').length,
    watchCount: risk.filter((p) => p.riskLevel === 'watch').length,
    healthyCount: risk.filter((p) => p.riskLevel === 'healthy').length,
    avgCoverageDays,
    categories: Array.from(new Set(risk.map((p) => p.category))),
  }
}

export async function findLowStock(input: { days?: number; category?: string }) {
  const days = input.days ?? 7
  const risk = await riskForProducts()
  return risk
    .filter((p) => (input.category ? p.category === input.category : true))
    .filter((p) => p.quantity <= p.reorderThreshold || (p.coverageDays !== null && p.coverageDays <= days))
    .sort((a, b) => (a.coverageDays ?? Infinity) - (b.coverageDays ?? Infinity))
}

export async function getProductDetails(input: { productId: number }) {
  const [risk] = await riskForProducts([input.productId])
  if (!risk) return null

  const movements = await db
    .select()
    .from(inventoryMovements)
    .where(eq(inventoryMovements.productId, input.productId))
    .orderBy(desc(inventoryMovements.createdAt))
    .limit(25)

  return { ...risk, recentMovements: movements }
}

export async function getSalesVelocity(input: { productId: number; days?: number }) {
  const days = input.days ?? 14
  const units = await soldUnitsByProduct(days, 0)
  const totalUnits = units.get(input.productId) ?? 0
  return {
    productId: input.productId,
    days,
    totalUnits,
    dailyVelocity: round1(totalUnits / days),
  }
}

export async function analyzeStockRisk(input: { days?: number; category?: string; productId?: number }) {
  const days = input.days ?? 7
  const risk = await riskForProducts(input.productId ? [input.productId] : undefined)
  const filtered = risk
    .filter((p) => (input.category ? p.category === input.category : true))
    .sort((a, b) => (a.coverageDays ?? Infinity) - (b.coverageDays ?? Infinity))

  const atRisk = filtered.filter(
    (p) => p.riskLevel !== 'healthy' && (p.coverageDays === null || p.coverageDays <= days || p.quantity <= p.reorderThreshold),
  )

  return {
    windowDays: days,
    atRiskCount: atRisk.length,
    products: input.productId ? filtered : atRisk,
  }
}

// ---------------------------------------------------------------------------
// Reordering & purchase orders
// ---------------------------------------------------------------------------

export async function recommendReorder(input: { productIds?: number[]; targetCoverageDaysOverride?: number }) {
  let targetIds = input.productIds
  if (!targetIds || targetIds.length === 0) {
    const low = await findLowStock({ days: 10 })
    targetIds = low.map((p) => p.productId)
  }
  if (targetIds.length === 0) return []

  const risk = await riskForProducts(targetIds)

  return risk.map((p) => {
    const targetDays = input.targetCoverageDaysOverride ?? p.targetCoverageDays
    const coverNeeded = targetDays + p.leadTimeDays + p.delayDays
    const velocity = p.recentDailyVelocity > 0 ? p.recentDailyVelocity : p.baselineDailyVelocity
    const suggestedQuantity = Math.max(0, Math.ceil(velocity * coverNeeded - p.quantity))
    return {
      productId: p.productId,
      sku: p.sku,
      name: p.name,
      supplierId: p.supplierId,
      supplierName: p.supplierName,
      currentQuantity: p.quantity,
      coverageDays: p.coverageDays,
      riskLevel: p.riskLevel,
      leadTimeDays: p.leadTimeDays,
      delayDays: p.delayDays,
      suggestedQuantity,
      estimatedCostCents: suggestedQuantity * p.costCents,
    }
  })
}

export async function getPurchaseOrders(input: { status?: string } = {}) {
  const rows = await db
    .select({
      id: purchaseOrders.id,
      poNumber: purchaseOrders.poNumber,
      status: purchaseOrders.status,
      notes: purchaseOrders.notes,
      createdBy: purchaseOrders.createdBy,
      createdAt: purchaseOrders.createdAt,
      approvedAt: purchaseOrders.approvedAt,
      receivedAt: purchaseOrders.receivedAt,
      supplierId: purchaseOrders.supplierId,
      supplierName: suppliers.name,
    })
    .from(purchaseOrders)
    .innerJoin(suppliers, eq(purchaseOrders.supplierId, suppliers.id))
    .where(input.status ? eq(purchaseOrders.status, input.status) : undefined)
    .orderBy(desc(purchaseOrders.createdAt))

  const items = await db
    .select({
      purchaseOrderId: purchaseOrderItems.purchaseOrderId,
      productId: purchaseOrderItems.productId,
      productName: products.name,
      quantity: purchaseOrderItems.quantity,
      unitCostCents: purchaseOrderItems.unitCostCents,
    })
    .from(purchaseOrderItems)
    .innerJoin(products, eq(purchaseOrderItems.productId, products.id))
    .where(
      inArray(
        purchaseOrderItems.purchaseOrderId,
        rows.map((r) => r.id),
      ),
    )

  return rows.map((po) => {
    const poItems = items.filter((i) => i.purchaseOrderId === po.id)
    const totalCostCents = poItems.reduce((sum, i) => sum + i.quantity * i.unitCostCents, 0)
    return { ...po, items: poItems, totalCostCents }
  })
}

export async function createPurchaseOrder(input: {
  supplierId: number
  items: Array<{ productId: number; quantity: number }>
  notes?: string
  createdBy?: Actor
}) {
  if (!input.items.length) throw new Error('A purchase order needs at least one item')
  for (const item of input.items) {
    if (item.quantity <= 0) throw new Error(`Quantity for product ${item.productId} must be positive`)
  }

  const productRows = await db
    .select()
    .from(products)
    .where(
      inArray(
        products.id,
        input.items.map((i) => i.productId),
      ),
    )
  const byId = new Map(productRows.map((p) => [p.id, p]))

  for (const item of input.items) {
    const product = byId.get(item.productId)
    if (!product) throw new Error(`Unknown product ${item.productId}`)
    if (product.supplierId !== input.supplierId) {
      throw new Error(`${product.name} is not supplied by supplier ${input.supplierId}`)
    }
  }

  const [po] = await db
    .insert(purchaseOrders)
    .values({
      poNumber: 'PENDING',
      supplierId: input.supplierId,
      status: 'draft',
      notes: input.notes,
      createdBy: input.createdBy ?? 'human',
    })
    .returning()

  const poNumber = `PO-${1039 + po.id}`
  await db.update(purchaseOrders).set({ poNumber }).where(eq(purchaseOrders.id, po.id))

  await db.insert(purchaseOrderItems).values(
    input.items.map((item) => ({
      purchaseOrderId: po.id,
      productId: item.productId,
      quantity: item.quantity,
      unitCostCents: byId.get(item.productId)!.costCents,
    })),
  )

  const [full] = await getPurchaseOrders().then((all) => all.filter((p) => p.id === po.id))
  return full
}

export async function approvePurchaseOrder(input: { purchaseOrderId: number }) {
  const [po] = await db.select().from(purchaseOrders).where(eq(purchaseOrders.id, input.purchaseOrderId))
  if (!po) throw new Error('Purchase order not found')
  if (po.status !== 'draft') throw new Error(`Purchase order ${po.poNumber} is already ${po.status}`)

  await db
    .update(purchaseOrders)
    .set({ status: 'approved', approvedAt: new Date() })
    .where(eq(purchaseOrders.id, input.purchaseOrderId))

  const [full] = await getPurchaseOrders().then((all) => all.filter((p) => p.id === input.purchaseOrderId))
  return full
}

export async function receiveShipment(input: { purchaseOrderId: number; actor?: Actor }) {
  const [po] = await db.select().from(purchaseOrders).where(eq(purchaseOrders.id, input.purchaseOrderId))
  if (!po) throw new Error('Purchase order not found')
  if (po.status !== 'approved') throw new Error(`Purchase order ${po.poNumber} must be approved before it can be received`)

  const items = await db
    .select()
    .from(purchaseOrderItems)
    .where(eq(purchaseOrderItems.purchaseOrderId, input.purchaseOrderId))

  for (const item of items) {
    await db
      .update(products)
      .set({ quantity: sql`${products.quantity} + ${item.quantity}` })
      .where(eq(products.id, item.productId))

    await db.insert(inventoryMovements).values({
      productId: item.productId,
      type: 'receiving',
      quantityDelta: item.quantity,
      note: `Received against ${po.poNumber}`,
      actor: input.actor ?? 'human',
    })
  }

  await db
    .update(purchaseOrders)
    .set({ status: 'received', receivedAt: new Date() })
    .where(eq(purchaseOrders.id, input.purchaseOrderId))

  const [full] = await getPurchaseOrders().then((all) => all.filter((p) => p.id === input.purchaseOrderId))
  return full
}

export async function updateStock(input: {
  productId: number
  quantityDelta: number
  type: 'adjustment' | 'transfer_in' | 'transfer_out' | 'restock'
  note?: string
  actor?: Actor
}) {
  if (input.quantityDelta === 0) throw new Error('quantityDelta must be non-zero')

  const [product] = await db.select().from(products).where(eq(products.id, input.productId))
  if (!product) throw new Error('Unknown product')

  const nextQuantity = product.quantity + input.quantityDelta
  if (nextQuantity < 0) {
    throw new Error(`Cannot reduce ${product.name} below zero (current stock: ${product.quantity})`)
  }

  await db.update(products).set({ quantity: nextQuantity }).where(eq(products.id, input.productId))

  const [movement] = await db
    .insert(inventoryMovements)
    .values({
      productId: input.productId,
      type: input.type,
      quantityDelta: input.quantityDelta,
      note: input.note,
      actor: input.actor ?? 'human',
    })
    .returning()

  return { product: { ...product, quantity: nextQuantity }, movement }
}

// ---------------------------------------------------------------------------
// Agent activity audit log
// ---------------------------------------------------------------------------

export async function logAgentToolCall(input: {
  toolName: string
  input: unknown
  summary: string
  consequential: boolean
}) {
  await db.insert(agentToolCalls).values({
    toolName: input.toolName,
    input: JSON.stringify(input.input ?? {}),
    summary: input.summary,
    consequential: input.consequential,
  })
}

export async function getRecentAgentActivity(limit = 30) {
  return db.select().from(agentToolCalls).orderBy(desc(agentToolCalls.createdAt)).limit(limit)
}

export async function getSuppliers() {
  return db.select().from(suppliers).orderBy(suppliers.name)
}
