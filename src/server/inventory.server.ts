import { and, desc, eq, gte, like, inArray, lt, not, or, sql } from 'drizzle-orm'
import { db } from '../../db/index.js'
import {
  agentActions,
  agentToolCalls,
  businessPolicies,
  inventoryMovements,
  products,
  productSuppliers,
  purchaseOrderItems,
  purchaseOrders,
  suppliers,
} from '../../db/schema.js'
import { riskLevelFor, round1 } from './format.js'
import type { RiskLevel } from './format.js'
import { buildSkuBase, withCollisionSuffix } from './sku.js'
import type { SkuParts } from './sku.js'

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
          sql`cast(unixepoch('now') - ${sinceDaysAgo * 86400} as integer)`,
        ),
        lt(
          inventoryMovements.createdAt,
          sql`cast(unixepoch('now') - ${untilDaysAgo * 86400} as integer)`,
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
      or(like(products.name, `%${input.query}%`), like(products.sku, `%${input.query}%`)),
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

export async function getProductValues() {
  const rows = await db
    .select({
      name: products.name,
      quantity: products.quantity,
      priceCents: products.priceCents,
    })
    .from(products)
  return rows
    .map((r) => ({
      name: r.name,
      valueCents: r.quantity * r.priceCents,
    }))
    .sort((a, b) => b.valueCents - a.valueCents)
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

  const supplierOptions = await db
    .select()
    .from(productSuppliers)
    .where(
      and(
        eq(productSuppliers.supplierId, input.supplierId),
        inArray(
          productSuppliers.productId,
          input.items.map((i) => i.productId),
        ),
      ),
    )
  const unitCostByProductId = new Map(supplierOptions.map((o) => [o.productId, o.unitCostCents]))

  for (const item of input.items) {
    const product = byId.get(item.productId)
    if (!product) throw new Error(`Unknown product ${item.productId}`)
    if (!unitCostByProductId.has(item.productId)) {
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
      unitCostCents: unitCostByProductId.get(item.productId)!,
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

// ---------------------------------------------------------------------------
// POS: Sales & Returns
// ---------------------------------------------------------------------------

export async function processSale(input: {
  items: Array<{ productId: number; quantity: number; unitPriceCents: number }>
  actor?: Actor
}) {
  if (!input.items.length) throw new Error('Sale must have at least one item')

  const saleLines: Array<{
    product: typeof products.$inferSelect
    quantity: number
    unitPriceCents: number
    totalCents: number
  }> = []

  for (const item of input.items) {
    const [product] = await db.select().from(products).where(eq(products.id, item.productId))
    if (!product) throw new Error(`Product #${item.productId} not found`)
    if (product.quantity < item.quantity) {
      throw new Error(`Insufficient stock for ${product.name}: have ${product.quantity}, need ${item.quantity}`)
    }
    saleLines.push({
      product,
      quantity: item.quantity,
      unitPriceCents: item.unitPriceCents,
      totalCents: item.quantity * item.unitPriceCents,
    })
  }

  const movementRecords: Array<typeof inventoryMovements.$inferInsert> = []
  for (const line of saleLines) {
    const nextQty = line.product.quantity - line.quantity
    await db.update(products).set({ quantity: nextQty }).where(eq(products.id, line.product.id))
    movementRecords.push({
      productId: line.product.id,
      type: 'sale',
      quantityDelta: -line.quantity,
      note: `POS sale — ${line.quantity}× ${line.product.name} @ $${(line.unitPriceCents / 100).toFixed(2)}`,
      actor: input.actor ?? 'human',
    })
  }

  if (movementRecords.length) {
    await db.insert(inventoryMovements).values(movementRecords)
  }

  const totalCents = saleLines.reduce((sum, l) => sum + l.totalCents, 0)
  return {
    totalCents,
    items: saleLines.map((l) => ({
      productId: l.product.id,
      name: l.product.name,
      sku: l.product.sku,
      quantity: l.quantity,
      unitPriceCents: l.unitPriceCents,
      totalCents: l.totalCents,
      remainingStock: l.product.quantity - l.quantity,
    })),
  }
}

export async function processReturn(input: {
  items: Array<{ productId: number; quantity: number; unitPriceCents: number }>
  reason?: string
  actor?: Actor
}) {
  if (!input.items.length) throw new Error('Return must have at least one item')

  const returnLines: Array<{
    product: typeof products.$inferSelect
    quantity: number
    unitPriceCents: number
    totalCents: number
  }> = []

  for (const item of input.items) {
    const [product] = await db.select().from(products).where(eq(products.id, item.productId))
    if (!product) throw new Error(`Product #${item.productId} not found`)
    returnLines.push({
      product,
      quantity: item.quantity,
      unitPriceCents: item.unitPriceCents,
      totalCents: item.quantity * item.unitPriceCents,
    })
  }

  const movementRecords: Array<typeof inventoryMovements.$inferInsert> = []
  for (const line of returnLines) {
    const nextQty = line.product.quantity + line.quantity
    await db.update(products).set({ quantity: nextQty }).where(eq(products.id, line.product.id))
    movementRecords.push({
      productId: line.product.id,
      type: 'return',
      quantityDelta: line.quantity,
      note: `POS return — ${line.quantity}× ${line.product.name}${input.reason ? ` (${input.reason})` : ''}`,
      actor: input.actor ?? 'human',
    })
  }

  if (movementRecords.length) {
    await db.insert(inventoryMovements).values(movementRecords)
  }

  const totalCents = returnLines.reduce((sum, l) => sum + l.totalCents, 0)
  return {
    totalCents,
    items: returnLines.map((l) => ({
      productId: l.product.id,
      name: l.product.name,
      sku: l.product.sku,
      quantity: l.quantity,
      unitPriceCents: l.unitPriceCents,
      totalCents: l.totalCents,
      newStock: l.product.quantity + l.quantity,
    })),
  }
}

// ---------------------------------------------------------------------------
// Sales history
// ---------------------------------------------------------------------------

export async function getSalesHistory(input?: { limit?: number; offset?: number }) {
  const limit = input?.limit ?? 50
  const offset = input?.offset ?? 0

  const rows = await db
    .select({
      id: inventoryMovements.id,
      productId: inventoryMovements.productId,
      productName: products.name,
      productSku: products.sku,
      quantityDelta: inventoryMovements.quantityDelta,
      note: inventoryMovements.note,
      actor: inventoryMovements.actor,
      createdAt: inventoryMovements.createdAt,
    })
    .from(inventoryMovements)
    .innerJoin(products, eq(inventoryMovements.productId, products.id))
    .where(eq(inventoryMovements.type, 'sale'))
    .orderBy(inventoryMovements.createdAt)
    .limit(limit)
    .offset(offset)

  const [countRow] = await db
    .select({ count: sql<number>`count(*)` })
    .from(inventoryMovements)
    .where(eq(inventoryMovements.type, 'sale'))

  return {
    sales: rows.map((r) => ({
      id: r.id,
      productId: r.productId,
      productName: r.productName,
      productSku: r.productSku,
      quantity: Math.abs(r.quantityDelta),
      note: r.note,
      actor: r.actor,
      createdAt: r.createdAt,
    })),
    total: countRow?.count ?? 0,
  }
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

  let movement: typeof inventoryMovements.$inferSelect
  await db.update(products).set({ quantity: nextQuantity }).where(eq(products.id, input.productId))
  const [m] = await db
    .insert(inventoryMovements)
    .values({
      productId: input.productId,
      type: input.type,
      quantityDelta: input.quantityDelta,
      note: input.note,
      actor: input.actor ?? 'human',
    })
    .returning()
  movement = m!

  return { product: { ...product, quantity: nextQuantity }, movement: movement! }
}

// ---------------------------------------------------------------------------
// Agent activity audit log
// ---------------------------------------------------------------------------

export async function logAgentToolCall(input: {
  toolName: string
  input: unknown
  summary: string
  consequential: boolean
  userId?: number | null
}) {
  await db.insert(agentToolCalls).values({
    toolName: input.toolName,
    input: JSON.stringify(input.input ?? {}),
    summary: input.summary,
    consequential: input.consequential,
    userId: input.userId ?? null,
  })
}

export async function getRecentAgentActivity(limit = 30, userId?: number | null) {
  const rows = userId
    ? await db.select().from(agentToolCalls).where(eq(agentToolCalls.userId, userId)).orderBy(desc(agentToolCalls.createdAt)).limit(limit)
    : await db.select().from(agentToolCalls).orderBy(desc(agentToolCalls.createdAt)).limit(limit)
  return rows.map((row) => {
    const readOnlyTools = ['search_', 'get_', 'find_', 'analyze_', 'build_', 'what_', 'investigate_', 'query_', 'generate_', 'forecast_', 'simulate_', 'recommend_', 'compare_']
    const isReadOnly = readOnlyTools.some((prefix) => row.toolName.startsWith(prefix))
    const inputLen = row.input ? row.input.length : 0
    const tokenEstimate = Math.ceil(inputLen / 4) + 50 // rough: ~4 chars per token + tool overhead
    return {
      ...row,
      actor: isReadOnly ? 'agent' : 'agent',
      tokenEstimate,
    }
  })
}

export async function getSuppliers() {
  return db.select().from(suppliers).orderBy(suppliers.name)
}

export async function createSupplier(data: {
  name: string
  contactEmail: string
  leadTimeDays?: number
  delayDays?: number
  delayNote?: string
}) {
  const result = await db.insert(suppliers).values({
    name: data.name,
    contactEmail: data.contactEmail,
    leadTimeDays: data.leadTimeDays ?? 7,
    delayDays: data.delayDays ?? 0,
    delayNote: data.delayNote ?? null,
  }).returning()
  return result[0]
}

// ---------------------------------------------------------------------------
// Supplier intelligence & comparison
// ---------------------------------------------------------------------------

/**
 * On-time-ness is approximated as (receivedAt - approvedAt) <= supplier's
 * *current* leadTimeDays, since no per-order promised-lead-time column exists.
 * A disclosed simplification, not a precise SLA measurement.
 */
export async function getSupplierIntelligence() {
  const supplierRows = await db.select().from(suppliers)
  const poRows = await db.select().from(purchaseOrders)
  const productRows = await db.select().from(products)

  return supplierRows
    .map((s) => {
      const pos = poRows.filter((p) => p.supplierId === s.id)
      const received = pos.filter((p) => p.status === 'received' && p.approvedAt && p.receivedAt)
      const turnaroundDays = received.map(
        (p) => (new Date(p.receivedAt!).getTime() - new Date(p.approvedAt!).getTime()) / 86400000,
      )
      const onTimeCount = turnaroundDays.filter((d) => d <= s.leadTimeDays).length
      const onTimePct = received.length ? round1((onTimeCount / received.length) * 100) : null
      const avgDelayDays = received.length
        ? round1(
            turnaroundDays.reduce((sum, d) => sum + Math.max(0, d - s.leadTimeDays), 0) / received.length,
          )
        : null
      const activeOrders = pos.filter((p) => p.status === 'approved' || p.status === 'draft').length
      const productsSupplied = productRows.filter((p) => p.supplierId === s.id)
      const avgCostCents = productsSupplied.length
        ? Math.round(productsSupplied.reduce((sum, p) => sum + p.costCents, 0) / productsSupplied.length)
        : null
      const reliabilityScore =
        onTimePct === null ? null : Math.max(0, Math.min(100, Math.round(onTimePct - (avgDelayDays ?? 0) * 2)))

      return {
        supplierId: s.id,
        name: s.name,
        leadTimeDays: s.leadTimeDays,
        delayDays: s.delayDays,
        delayNote: s.delayNote,
        totalOrders: pos.length,
        receivedOrders: received.length,
        activeOrders,
        onTimePct,
        avgDelayDays,
        avgCostCents,
        productsSuppliedCount: productsSupplied.length,
        reliabilityScore,
      }
    })
    .sort((a, b) => (b.reliabilityScore ?? -1) - (a.reliabilityScore ?? -1))
}

export async function compareSuppliers(input: { productId: number }) {
  const [product] = await db.select().from(products).where(eq(products.id, input.productId))
  if (!product) throw new Error('Unknown product')

  const options = await db
    .select({
      supplierId: productSuppliers.supplierId,
      supplierName: suppliers.name,
      unitCostCents: productSuppliers.unitCostCents,
      leadTimeDays: productSuppliers.leadTimeDays,
      delayDays: suppliers.delayDays,
      isPrimary: productSuppliers.isPrimary,
    })
    .from(productSuppliers)
    .innerJoin(suppliers, eq(productSuppliers.supplierId, suppliers.id))
    .where(eq(productSuppliers.productId, input.productId))

  const intelligence = await getSupplierIntelligence()
  const intelById = new Map(intelligence.map((s) => [s.supplierId, s]))

  const scored = options.map((o) => {
    const intel = intelById.get(o.supplierId)
    return {
      ...o,
      totalLeadDays: o.leadTimeDays + o.delayDays,
      onTimePct: intel?.onTimePct ?? null,
      reliabilityScore: intel?.reliabilityScore ?? null,
    }
  })

  const scoreOf = (o: (typeof scored)[number]) =>
    (o.reliabilityScore ?? 50) - o.totalLeadDays * 2 - o.unitCostCents / 100

  const recommended = scored.reduce<(typeof scored)[number] | null>(
    (best, cur) => (best === null || scoreOf(cur) > scoreOf(best) ? cur : best),
    null,
  )

  return {
    productId: input.productId,
    productName: product.name,
    options: scored,
    recommendedSupplierId: recommended?.supplierId ?? null,
    recommendationReason: recommended
      ? `${recommended.supplierName} offers the best balance of lead time (${recommended.totalLeadDays}d), cost ($${(recommended.unitCostCents / 100).toFixed(2)}), and reliability${
          recommended.reliabilityScore !== null ? ` (${recommended.reliabilityScore}/100)` : ''
        }.`
      : null,
  }
}

// ---------------------------------------------------------------------------
// Dead stock
// ---------------------------------------------------------------------------

export async function findDeadStock(input: { minDaysStale?: number; category?: string } = {}) {
  const days = input.minDaysStale ?? 60
  const sold = await soldUnitsByProduct(days, 0)
  const risk = await riskForProducts()
  return risk
    .filter((p) => (input.category ? p.category === input.category : true))
    .filter((p) => p.quantity > 0 && (sold.get(p.productId) ?? 0) === 0)
    .map((p) => ({
      productId: p.productId,
      sku: p.sku,
      name: p.name,
      category: p.category,
      quantity: p.quantity,
      costCents: p.costCents,
      capitalTiedUpCents: p.quantity * p.costCents,
      daysStale: days,
    }))
    .sort((a, b) => b.capitalTiedUpCents - a.capitalTiedUpCents)
}

// ---------------------------------------------------------------------------
// Inventory Health Check
// ---------------------------------------------------------------------------

export interface HealthIssue {
  type: string
  severity: 'low' | 'medium' | 'high'
  productId?: number
  productName?: string
  supplierId?: number
  supplierName?: string
  description: string
  recommendation: string
}

const SEVERITY_RANK: Record<HealthIssue['severity'], number> = { high: 0, medium: 1, low: 2 }

export async function getInventoryHealthCheck() {
  const [risk, supplierRows, supplierIntel, poRows, deadStock] = await Promise.all([
    riskForProducts(),
    getSuppliers(),
    getSupplierIntelligence(),
    getPurchaseOrders(),
    findDeadStock({}),
  ])

  const issues: HealthIssue[] = []

  for (const p of risk) {
    if (p.quantity === 0) {
      issues.push({
        type: 'stockout',
        severity: 'high',
        productId: p.productId,
        productName: p.name,
        description: `${p.name} (${p.sku}) is completely out of stock.`,
        recommendation: `Create a purchase order with ${p.supplierName} immediately.`,
      })
    } else if (p.riskLevel === 'critical') {
      issues.push({
        type: 'low_stock',
        severity: 'high',
        productId: p.productId,
        productName: p.name,
        description: `${p.name} has only ${p.coverageDays ?? '?'} day(s) of coverage left.`,
        recommendation: `Reorder from ${p.supplierName} now — see recommend_reorder for a suggested quantity.`,
      })
    } else if (p.riskLevel === 'warning') {
      issues.push({
        type: 'low_stock',
        severity: 'medium',
        productId: p.productId,
        productName: p.name,
        description: `${p.name} is trending toward a stockout (${p.coverageDays ?? '?'} day(s) coverage).`,
        recommendation: `Monitor closely and plan a reorder within the next week.`,
      })
    }

    if (p.trend === 'declining' && p.baselineDailyVelocity > 0 && p.recentDailyVelocity < p.baselineDailyVelocity * 0.5) {
      issues.push({
        type: 'abnormal_sales_change',
        severity: 'low',
        productId: p.productId,
        productName: p.name,
        description: `${p.name}'s sales velocity fell from ${p.baselineDailyVelocity}/day to ${p.recentDailyVelocity}/day.`,
        recommendation: `Investigate the demand shift before placing a large reorder.`,
      })
    }

    if (p.delayDays > 2) {
      issues.push({
        type: 'supplier_delay',
        severity: p.delayDays > 5 ? 'high' : 'medium',
        productId: p.productId,
        productName: p.name,
        supplierId: p.supplierId,
        supplierName: p.supplierName,
        description: `${p.supplierName} is running ${p.delayDays} day(s) behind on lead time for ${p.name}.${p.delayNote ? ` ${p.delayNote}` : ''}`,
        recommendation: `Compare alternate suppliers for this product or order earlier than usual.`,
      })
    }
  }

  for (const d of deadStock) {
    issues.push({
      type: 'dead_stock',
      severity: d.capitalTiedUpCents > 50000 ? 'medium' : 'low',
      productId: d.productId,
      productName: d.name,
      description: `${d.name} has sold 0 units in ${d.daysStale} days with ${d.quantity} unit(s) in stock ($${(d.capitalTiedUpCents / 100).toFixed(2)} tied up).`,
      recommendation: `Run a promotion, discount it, or discontinue this SKU.`,
    })
  }

  for (const po of poRows) {
    if (po.status === 'approved' && po.approvedAt && (Date.now() - new Date(po.approvedAt).getTime()) / 86400000 > 14) {
      issues.push({
        type: 'overdue_po',
        severity: 'medium',
        supplierId: po.supplierId,
        supplierName: po.supplierName,
        description: `${po.poNumber} with ${po.supplierName} was approved over 14 days ago and still hasn't been received.`,
        recommendation: `Follow up with ${po.supplierName}, or mark it received if the shipment already arrived.`,
      })
    }
  }

  for (const s of supplierIntel) {
    if (s.onTimePct !== null && s.onTimePct < 60 && s.receivedOrders >= 2) {
      issues.push({
        type: 'supplier_reliability',
        severity: 'medium',
        supplierId: s.supplierId,
        supplierName: s.name,
        description: `${s.name} has delivered only ${s.onTimePct}% of orders on time across ${s.receivedOrders} received order(s).`,
        recommendation: `Reduce dependence on ${s.name} where alternate suppliers are available.`,
      })
    }
  }

  const totalValueCents = risk.reduce((sum, p) => sum + p.quantity * p.costCents, 0)
  const atRiskValueCents = risk
    .filter((p) => p.riskLevel !== 'healthy')
    .reduce((sum, p) => sum + p.quantity * p.costCents, 0)
  if (totalValueCents > 0 && atRiskValueCents / totalValueCents > 0.3) {
    issues.push({
      type: 'high_value_risk',
      severity: 'medium',
      description: `${Math.round((atRiskValueCents / totalValueCents) * 100)}% of inventory value ($${(atRiskValueCents / 100).toFixed(2)}) sits in at-risk products.`,
      recommendation: `Prioritize replenishment for high-cost at-risk SKUs to protect revenue.`,
    })
  }

  const valueBySupplier = new Map<number, number>()
  for (const p of risk) valueBySupplier.set(p.supplierId, (valueBySupplier.get(p.supplierId) ?? 0) + p.quantity * p.costCents)
  for (const [supplierId, value] of valueBySupplier) {
    if (totalValueCents > 0 && value / totalValueCents > 0.4) {
      const supplier = supplierRows.find((s) => s.id === supplierId)
      issues.push({
        type: 'concentration_risk',
        severity: 'medium',
        supplierId,
        supplierName: supplier?.name,
        description: `${Math.round((value / totalValueCents) * 100)}% of inventory value is concentrated with ${supplier?.name ?? 'a single supplier'}.`,
        recommendation: `Diversify sourcing for key products to reduce single-supplier exposure.`,
      })
    }
  }

  issues.sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity])

  return {
    generatedAt: new Date().toISOString(),
    totalIssues: issues.length,
    highSeverityCount: issues.filter((i) => i.severity === 'high').length,
    mediumSeverityCount: issues.filter((i) => i.severity === 'medium').length,
    lowSeverityCount: issues.filter((i) => i.severity === 'low').length,
    issues,
  }
}

// ---------------------------------------------------------------------------
// Product & SKU generation
// ---------------------------------------------------------------------------

export async function generateSku(input: SkuParts) {
  const base = buildSkuBase(input)
  let attempt = 1
  while (true) {
    const candidate = withCollisionSuffix(base, attempt)
    const [existing] = await db.select({ id: products.id }).from(products).where(eq(products.sku, candidate))
    if (!existing) return candidate
    attempt += 1
  }
}

export async function draftProduct(input: SkuParts & {
  name: string
  supplierId: number
  costCents: number
  priceCents: number
  initialQuantity?: number
  reorderThreshold?: number
  targetCoverageDays?: number
}) {
  const [supplier] = await db.select().from(suppliers).where(eq(suppliers.id, input.supplierId))
  if (!supplier) throw new Error('Unknown supplier')
  if (input.priceCents <= input.costCents) {
    throw new Error('Price should be greater than cost')
  }

  const sku = await generateSku(input)
  return {
    sku,
    name: input.name,
    category: input.category,
    supplierId: input.supplierId,
    supplierName: supplier.name,
    costCents: input.costCents,
    priceCents: input.priceCents,
    quantity: input.initialQuantity ?? 0,
    reorderThreshold: input.reorderThreshold ?? 5,
    targetCoverageDays: input.targetCoverageDays ?? 30,
  }
}

export async function createProductFromDraft(input: {
  sku: string
  name: string
  category: string
  supplierId: number
  costCents: number
  priceCents: number
  quantity?: number
  reorderThreshold?: number
  targetCoverageDays?: number
}) {
  const [existingSku] = await db.select({ id: products.id }).from(products).where(eq(products.sku, input.sku))
  if (existingSku) throw new Error(`SKU ${input.sku} already exists`)

  const [supplier] = await db.select().from(suppliers).where(eq(suppliers.id, input.supplierId))
  if (!supplier) throw new Error('Unknown supplier')

  const [product] = await db
    .insert(products)
    .values({
      sku: input.sku,
      name: input.name,
      category: input.category,
      supplierId: input.supplierId,
      costCents: input.costCents,
      priceCents: input.priceCents,
      quantity: input.quantity ?? 0,
      reorderThreshold: input.reorderThreshold ?? 5,
      targetCoverageDays: input.targetCoverageDays ?? 30,
    })
    .returning()

  await db.insert(productSuppliers).values({
    productId: product.id,
    supplierId: input.supplierId,
    unitCostCents: input.costCents,
    leadTimeDays: supplier.leadTimeDays,
    isPrimary: true,
  })

  if (input.quantity && input.quantity > 0) {
    await db.insert(inventoryMovements).values({
      productId: product.id,
      type: 'restock',
      quantityDelta: input.quantity,
      note: 'Initial stock on product creation',
      actor: 'human',
    })
  }

  return product
}

// ---------------------------------------------------------------------------
// Agent Action Center — human-in-the-loop approval queue
// ---------------------------------------------------------------------------

export type AgentActionType = 'replenishment' | 'reorder_point_change' | 'purchase_order'

export async function proposeAgentAction(input: {
  type: AgentActionType
  title: string
  reasoning: string
  impact?: 'low' | 'medium' | 'high'
  payload: unknown
  relatedProductIds?: number[]
  estimatedCostCents?: number
  proposedBy?: Actor
}) {
  const [action] = await db
    .insert(agentActions)
    .values({
      type: input.type,
      title: input.title,
      reasoning: input.reasoning,
      impact: input.impact ?? 'low',
      payload: JSON.stringify(input.payload ?? {}),
      relatedProductIds: input.relatedProductIds ? JSON.stringify(input.relatedProductIds) : null,
      estimatedCostCents: input.estimatedCostCents,
      proposedBy: input.proposedBy ?? 'agent',
    })
    .returning()
  return action
}

export async function listAgentActions(input: { status?: string } = {}) {
  return db
    .select()
    .from(agentActions)
    .where(input.status ? eq(agentActions.status, input.status) : undefined)
    .orderBy(desc(agentActions.createdAt))
}

async function executeAgentAction(actionId: number) {
  const [action] = await db.select().from(agentActions).where(eq(agentActions.id, actionId))
  if (!action) throw new Error('Unknown action')

  try {
    const payload = JSON.parse(action.payload)
    let resultSummary: string

    if (action.type === 'purchase_order' || action.type === 'replenishment') {
      const po = await createPurchaseOrder({
        supplierId: payload.supplierId,
        items: payload.items,
        notes: payload.notes ?? action.title,
        createdBy: 'agent',
      })
      resultSummary = `Created ${po!.poNumber} with ${payload.items.length} line item(s).`
    } else if (action.type === 'reorder_point_change') {
      await db
        .update(products)
        .set({ reorderThreshold: payload.reorderThreshold })
        .where(eq(products.id, payload.productId))
      resultSummary = `Updated reorder threshold for product ${payload.productId} to ${payload.reorderThreshold}.`
    } else {
      throw new Error(`Unknown action type ${action.type}`)
    }

    await db
      .update(agentActions)
      .set({ status: 'executed', executedAt: new Date(), resultSummary })
      .where(eq(agentActions.id, actionId))
  } catch (err) {
    await db
      .update(agentActions)
      .set({ status: 'failed', resultSummary: err instanceof Error ? err.message : String(err) })
      .where(eq(agentActions.id, actionId))
  }

  const [updated] = await db.select().from(agentActions).where(eq(agentActions.id, actionId))
  return updated
}

export async function decideAgentAction(input: {
  actionId: number
  decision: 'approved' | 'rejected'
  decidedBy?: Actor
}) {
  const [action] = await db.select().from(agentActions).where(eq(agentActions.id, input.actionId))
  if (!action) throw new Error('Unknown action')
  if (action.status !== 'pending') throw new Error(`Action is already ${action.status}`)

  await db
    .update(agentActions)
    .set({ status: input.decision, decidedAt: new Date(), decidedBy: input.decidedBy ?? 'human' })
    .where(eq(agentActions.id, input.actionId))

  if (input.decision === 'approved') return executeAgentAction(input.actionId)

  const [updated] = await db.select().from(agentActions).where(eq(agentActions.id, input.actionId))
  return updated
}

// ---------------------------------------------------------------------------
// Supplier scoring helper — used by buildReplenishmentPlan to avoid N+1
// ---------------------------------------------------------------------------

interface ReplanItem {
  productId: number
  sku: string
  name: string
  currentQuantity: number
  coverageDays: number | null
  riskLevel: RiskLevel
  urgency: number
  suggestedQuantity: number
  recommendedSupplierId: number
  recommendedSupplierName: string
  unitCostCents: number
  estimatedCostCents: number
  recommendationReason: string | null
}

function scoreSupplierOption(
  option: { supplierId: number; supplierName: string; unitCostCents: number; leadTimeDays: number; delayDays: number; isPrimary: boolean },
  intel: Map<number, { onTimePct: number | null; reliabilityScore: number | null; avgDelayDays: number | null }>,
) {
  const i = intel.get(option.supplierId)
  const reliabilityScore = i?.reliabilityScore ?? 50
  const totalLeadDays = option.leadTimeDays + option.delayDays
  const score = reliabilityScore - totalLeadDays * 2 - option.unitCostCents / 100
  return {
    ...option,
    totalLeadDays,
    onTimePct: i?.onTimePct ?? null,
    reliabilityScore: i?.reliabilityScore ?? null,
    score,
  }
}

function groupItemsBySupplier(items: ReplanItem[]) {
  const bySupplier = new Map<number, ReplanItem[]>()
  for (const item of items) {
    const list = bySupplier.get(item.recommendedSupplierId) ?? []
    list.push(item)
    bySupplier.set(item.recommendedSupplierId, list)
  }
  return Array.from(bySupplier.entries()).map(([supplierId, group]) => ({
    supplierId,
    supplierName: group[0].recommendedSupplierName,
    items: group,
    subtotalCents: group.reduce((sum, i) => sum + i.estimatedCostCents, 0),
  }))
}

// ---------------------------------------------------------------------------
// Smart Replenishment — the flagship multi-tool workflow
// ---------------------------------------------------------------------------

export async function buildReplenishmentPlan(input: { category?: string; days?: number; budgetCents?: number } = {}) {
  const days = input.days ?? 10
  const low = await findLowStock({ days, category: input.category })
  if (!low.length) {
    return { generatedAt: new Date().toISOString(), items: [], groupedBySupplier: [], totalEstimatedCostCents: 0 }
  }

  const reorder = await recommendReorder({ productIds: low.map((p) => p.productId) })
  const candidates = reorder.filter((r) => r.suggestedQuantity > 0)

  // Batch-load supplier intelligence once (avoids N+1 from per-product compareSuppliers)
  const intelligence = await getSupplierIntelligence()
  const intelById = new Map(intelligence.map((s) => [s.supplierId, s]))

  // Batch-load all product-supplier options for candidate products
  const candidateIds = candidates.map((c) => c.productId)
  const allOptions = await db
    .select({
      productId: productSuppliers.productId,
      supplierId: productSuppliers.supplierId,
      supplierName: suppliers.name,
      unitCostCents: productSuppliers.unitCostCents,
      leadTimeDays: productSuppliers.leadTimeDays,
      delayDays: suppliers.delayDays,
      isPrimary: productSuppliers.isPrimary,
    })
    .from(productSuppliers)
    .innerJoin(suppliers, eq(productSuppliers.supplierId, suppliers.id))
    .where(inArray(productSuppliers.productId, candidateIds))

  const optionsByProduct = new Map<number, typeof allOptions>()
  for (const opt of allOptions) {
    const list = optionsByProduct.get(opt.productId) ?? []
    list.push(opt)
    optionsByProduct.set(opt.productId, list)
  }

  const urgencyScore = (r: (typeof candidates)[number]) =>
    r.riskLevel === 'critical' ? 1 : r.riskLevel === 'warning' ? 2 : 3

  const items = []
  for (const r of candidates) {
    const options = optionsByProduct.get(r.productId) ?? []
    const scored = options.map((o) => scoreSupplierOption(o, intelById))
    const chosen = scored.reduce<(typeof scored)[number] | null>(
      (best, cur) => (best === null || cur.score > best.score ? cur : best),
      null,
    )
    const recommendationReason = chosen
      ? `${chosen.supplierName} offers the best balance of lead time (${chosen.totalLeadDays}d), cost ($${(chosen.unitCostCents / 100).toFixed(2)}), and reliability${chosen.reliabilityScore !== null ? ` (${chosen.reliabilityScore}/100)` : ''}.`
      : null
    items.push({
      productId: r.productId,
      sku: r.sku,
      name: r.name,
      currentQuantity: r.currentQuantity,
      coverageDays: r.coverageDays,
      riskLevel: r.riskLevel,
      urgency: urgencyScore(r),
      suggestedQuantity: r.suggestedQuantity,
      recommendedSupplierId: chosen?.supplierId ?? r.supplierId,
      recommendedSupplierName: chosen?.supplierName ?? r.supplierName,
      unitCostCents: chosen?.unitCostCents ?? 0,
      estimatedCostCents: (chosen?.unitCostCents ?? 0) * r.suggestedQuantity,
      recommendationReason,
    })
  }

  // Budget-aware prioritization: sort by urgency, then fit within budget
  if (input.budgetCents && input.budgetCents > 0) {
    items.sort((a, b) => a.urgency - b.urgency || a.estimatedCostCents - b.estimatedCostCents)
    let remaining = input.budgetCents
    const approved: ReplanItem[] = []
    for (const item of items) {
      if (item.estimatedCostCents <= remaining) {
        remaining -= item.estimatedCostCents
        approved.push(item)
      }
    }
    const rejected = items.filter((i) => !approved.includes(i))
    return {
      generatedAt: new Date().toISOString(),
      items: approved,
      rejectedItems: rejected,
      groupedBySupplier: groupItemsBySupplier(approved),
      totalEstimatedCostCents: approved.reduce((sum, i) => sum + i.estimatedCostCents, 0),
      budgetCents: input.budgetCents,
      budgetUsedCents: input.budgetCents - remaining,
      budgetRemainingCents: remaining,
    }
  }

  const bySupplier = new Map<number, ReplanItem[]>()
  for (const item of items) {
    const list = bySupplier.get(item.recommendedSupplierId) ?? []
    list.push(item)
    bySupplier.set(item.recommendedSupplierId, list)
  }

  return {
    generatedAt: new Date().toISOString(),
    items,
    groupedBySupplier: Array.from(bySupplier.entries()).map(([supplierId, group]) => ({
      supplierId,
      supplierName: group[0].recommendedSupplierName,
      items: group,
      subtotalCents: group.reduce((sum, i) => sum + i.estimatedCostCents, 0),
    })),
    totalEstimatedCostCents: items.reduce((sum, i) => sum + i.estimatedCostCents, 0),
  }
}

export async function createReplenishmentProposals(input: { category?: string; days?: number } = {}) {
  const plan = await buildReplenishmentPlan(input)
  if (!plan.groupedBySupplier.length) return []

  const proposals: Array<typeof agentActions.$inferSelect> = []
  for (const group of plan.groupedBySupplier) {
    const [action] = await db
      .insert(agentActions)
      .values({
        type: 'replenishment',
        title: `Replenish ${group.items.length} product(s) from ${group.supplierName}`,
        reasoning: group.items
          .map(
            (item: ReplanItem) =>
              `${item.name}: ${item.coverageDays ?? 0} day(s) of coverage left, ${item.riskLevel} risk — order ${item.suggestedQuantity} unit(s). ${item.recommendationReason ?? ''}`,
          )
          .join(' '),
        impact: group.subtotalCents > 200000 ? 'high' : group.subtotalCents > 50000 ? 'medium' : 'low',
        payload: JSON.stringify({
          supplierId: group.supplierId,
          items: group.items.map((item: ReplanItem) => ({ productId: item.productId, quantity: item.suggestedQuantity })),
          notes: 'Smart Replenishment proposal',
        }),
        relatedProductIds: JSON.stringify(group.items.map((item: ReplanItem) => item.productId)),
        estimatedCostCents: group.subtotalCents,
        proposedBy: 'agent',
      })
      .returning()
    proposals.push(action)
  }
  return proposals
}

// ---------------------------------------------------------------------------
// "What should I worry about today?"
// ---------------------------------------------------------------------------

export async function whatShouldIWorryAbout() {
  const health = await getInventoryHealthCheck()
  const pending = await listAgentActions({ status: 'pending' })

  const items: Array<{
    rank: number
    type: string
    severity: 'low' | 'medium' | 'high'
    description: string
    recommendation: string
    productId?: number
    supplierId?: number
  }> = health.issues.slice(0, 10).map((issue, idx) => ({
    rank: idx + 1,
    type: issue.type,
    severity: issue.severity,
    description: issue.description,
    recommendation: issue.recommendation,
    productId: issue.productId,
    supplierId: issue.supplierId,
  }))

  if (pending.length) {
    items.unshift({
      rank: 0,
      type: 'pending_approval',
      severity: 'medium',
      description: `${pending.length} agent-proposed action(s) are waiting for your approval.`,
      recommendation: 'Review the Agent Action Center.',
    })
  }

  return {
    generatedAt: new Date().toISOString(),
    summary:
      health.totalIssues === 0
        ? 'No issues detected — inventory is healthy.'
        : `${health.highSeverityCount} high, ${health.mediumSeverityCount} medium, ${health.lowSeverityCount} low priority issue(s).`,
    items,
  }
}

// ---------------------------------------------------------------------------
// Inventory Simulator
// ---------------------------------------------------------------------------

export async function simulateInventory(input: {
  productId: number
  demandChangePct?: number
  leadTimeChangeDays?: number
  horizonDays?: number
}) {
  const horizon = Math.min(input.horizonDays ?? 30, 90)
  const [risk] = await riskForProducts([input.productId])
  if (!risk) throw new Error('Unknown product')

  const baselineVelocity = risk.recentDailyVelocity > 0 ? risk.recentDailyVelocity : risk.baselineDailyVelocity
  const demandMultiplier = 1 + (input.demandChangePct ?? 0) / 100
  const simulatedVelocity = round1(Math.max(0, baselineVelocity * demandMultiplier))
  const simulatedLeadTime = Math.max(0, risk.leadTimeDays + (input.leadTimeChangeDays ?? 0))

  const baselineCoverageDays = baselineVelocity > 0 ? round1(risk.quantity / baselineVelocity) : null
  const simulatedCoverageDays = simulatedVelocity > 0 ? round1(risk.quantity / simulatedVelocity) : null

  const baselineStockoutDate =
    baselineCoverageDays !== null
      ? new Date(Date.now() + baselineCoverageDays * 86400000).toISOString().slice(0, 10)
      : null
  const simulatedStockoutDate =
    simulatedCoverageDays !== null
      ? new Date(Date.now() + simulatedCoverageDays * 86400000).toISOString().slice(0, 10)
      : null

  const coverNeeded = risk.targetCoverageDays + simulatedLeadTime + risk.delayDays
  const suggestedReorderQuantity = Math.max(0, Math.ceil(simulatedVelocity * coverNeeded - risk.quantity))

  const timeline = Array.from({ length: horizon }, (_, day) => ({
    day,
    baselineQuantity: Math.max(0, round1(risk.quantity - baselineVelocity * day)),
    simulatedQuantity: Math.max(0, round1(risk.quantity - simulatedVelocity * day)),
  }))

  return {
    productId: input.productId,
    name: risk.name,
    assumptions: {
      baselineDailyVelocity: baselineVelocity,
      simulatedDailyVelocity: simulatedVelocity,
      demandChangePct: input.demandChangePct ?? 0,
      baselineLeadTimeDays: risk.leadTimeDays,
      simulatedLeadTimeDays: simulatedLeadTime,
      horizonDays: horizon,
    },
    baseline: { coverageDays: baselineCoverageDays, projectedStockoutDate: baselineStockoutDate },
    simulated: {
      coverageDays: simulatedCoverageDays,
      projectedStockoutDate: simulatedStockoutDate,
      suggestedReorderQuantity,
    },
    timeline,
  }
}

// ---------------------------------------------------------------------------
// Reports Studio
// ---------------------------------------------------------------------------

export type ReportType = 'monthly_inventory' | 'declining_sales' | 'supplier_performance' | 'cash_tied_up'

export function parseReportRequest(query: string): { reportType: ReportType } {
  const q = query.toLowerCase()
  if (q.includes('supplier') || q.includes('vendor')) return { reportType: 'supplier_performance' }
  if (q.includes('declin') || q.includes('slow') || q.includes('drop')) return { reportType: 'declining_sales' }
  if (q.includes('cash') || q.includes('capital') || q.includes('tied up') || q.includes('dead stock')) {
    return { reportType: 'cash_tied_up' }
  }
  return { reportType: 'monthly_inventory' }
}

export async function generateReport(input: { query: string; category?: string }) {
  const { reportType } = parseReportRequest(input.query)
  const category = input.category
  const generatedAt = new Date().toISOString()

  if (reportType === 'supplier_performance') {
    const intel = await getSupplierIntelligence()
    const rated = intel.filter((s) => s.onTimePct !== null)
    return {
      reportType,
      title: 'Supplier Performance Report',
      generatedAt,
      kpis: [
        { label: 'Suppliers', value: intel.length },
        {
          label: 'Avg on-time %',
          value: rated.length ? round1(rated.reduce((s, i) => s + (i.onTimePct ?? 0), 0) / rated.length) : null,
        },
      ],
      rows: intel,
      findings: intel
        .filter((s) => s.onTimePct !== null && s.onTimePct < 70)
        .map((s) => `${s.name} is delivering on time only ${s.onTimePct}% of the time.`),
      recommendations: intel
        .filter((s) => s.onTimePct !== null && s.onTimePct < 70)
        .map((s) => `Diversify sourcing away from ${s.name} where alternates exist.`),
    }
  }

  if (reportType === 'declining_sales') {
    const risk = await riskForProducts()
    const declining = risk
      .filter((p) => (category ? p.category === category : true))
      .filter((p) => p.trend === 'declining')
      .sort((a, b) => a.recentDailyVelocity - b.recentDailyVelocity)
    return {
      reportType,
      title: 'Declining Sales Report',
      generatedAt,
      kpis: [{ label: 'Declining products', value: declining.length }],
      rows: declining,
      findings: declining
        .slice(0, 5)
        .map((p) => `${p.name}: velocity fell from ${p.baselineDailyVelocity}/day to ${p.recentDailyVelocity}/day.`),
      recommendations: declining
        .slice(0, 5)
        .map((p) => `Review pricing or marketing for ${p.name}, or reduce future reorder quantities.`),
    }
  }

  if (reportType === 'cash_tied_up') {
    const dead = await findDeadStock({ category })
    const totalCapitalCents = dead.reduce((sum, d) => sum + d.capitalTiedUpCents, 0)
    return {
      reportType,
      title: 'Cash Tied Up in Inventory Report',
      generatedAt,
      kpis: [
        { label: 'Dead-stock products', value: dead.length },
        { label: 'Capital tied up', value: `$${(totalCapitalCents / 100).toFixed(2)}` },
      ],
      rows: dead,
      findings: dead.slice(0, 5).map((d) => `${d.name} has $${(d.capitalTiedUpCents / 100).toFixed(2)} tied up in unsold stock.`),
      recommendations: dead.length
        ? ['Run a clearance promotion on the top dead-stock items.', 'Lower reorder thresholds for these SKUs.']
        : [],
    }
  }

  const summary = await getInventorySummary()
  const risk = await riskForProducts()
  const filtered = category ? risk.filter((p) => p.category === category) : risk
  const totalValueCents = filtered.reduce((sum, p) => sum + p.quantity * p.costCents, 0)
  return {
    reportType,
    title: 'Monthly Inventory Report',
    generatedAt,
    kpis: [
      { label: 'Total products', value: summary.totalProducts },
      { label: 'Total units', value: summary.totalUnits },
      { label: 'Inventory value', value: `$${(totalValueCents / 100).toFixed(2)}` },
      { label: 'Avg coverage days', value: summary.avgCoverageDays ?? 'n/a' },
    ],
    rows: filtered,
    findings: [`${summary.criticalCount} product(s) are at critical risk, ${summary.warningCount} at warning level.`],
    recommendations: summary.criticalCount > 0 ? ['Prioritize reordering critical-risk products this week.'] : [],
  }
}

export function reportToCsv(rows: Array<Record<string, unknown>>): string {
  if (!rows.length) return ''
  const headers = Object.keys(rows[0])
  const escape = (v: unknown) => {
    const s = v === null || v === undefined ? '' : String(v)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const lines = [headers.join(',')]
  for (const row of rows) lines.push(headers.map((h) => escape(row[h])).join(','))
  return lines.join('\n')
}

export async function generateReportCsv(input: { query: string; category?: string }) {
  const report = await generateReport(input)
  return { title: report.title, csv: reportToCsv(report.rows as Array<Record<string, unknown>>) }
}

// ---------------------------------------------------------------------------
// Natural-language inventory querying (deterministic, rule-based — see results.md)
// ---------------------------------------------------------------------------

export interface ParsedInventoryQuery {
  category?: string
  maxCoverageDays?: number
  riskLevel?: RiskLevel
  rawQuery: string
}

const KNOWN_CATEGORIES = ['electronics', 'office', 'tools', 'shipping']

export function parseInventoryQuery(text: string): ParsedInventoryQuery {
  const q = text.toLowerCase()
  const result: ParsedInventoryQuery = { rawQuery: text }

  for (const cat of KNOWN_CATEGORIES) {
    if (q.includes(cat)) {
      result.category = cat[0].toUpperCase() + cat.slice(1)
      break
    }
  }

  if (q.includes('critical')) result.riskLevel = 'critical'
  else if (q.includes('warning') || q.includes('at risk') || q.includes('at-risk')) result.riskLevel = 'warning'
  else if (q.includes('watch')) result.riskLevel = 'watch'
  else if (q.includes('healthy')) result.riskLevel = 'healthy'

  const daysMatch = q.match(/(\d+)\s*day/)
  if (daysMatch) result.maxCoverageDays = Number(daysMatch[1])
  else if (q.includes('running out') || q.includes('low stock') || q.includes('low on stock')) {
    result.maxCoverageDays = 7
  }

  return result
}

export async function queryInventory(input: { query: string }) {
  const filters = parseInventoryQuery(input.query)
  const risk = await riskForProducts()
  const filtered = risk
    .filter((p) => (filters.category ? p.category === filters.category : true))
    .filter((p) => (filters.riskLevel ? p.riskLevel === filters.riskLevel : true))
    .filter((p) =>
      filters.maxCoverageDays !== undefined ? p.coverageDays !== null && p.coverageDays <= filters.maxCoverageDays : true,
    )
    .sort((a, b) => (a.coverageDays ?? Infinity) - (b.coverageDays ?? Infinity))

  return { filters, resultCount: filtered.length, products: filtered }
}

// ---------------------------------------------------------------------------
// Movements listing (audit trail) & undo
// ---------------------------------------------------------------------------

export async function getInventoryMovements(input: { productId?: number; type?: string; limit?: number } = {}) {
  const conditions = []
  if (input.productId) conditions.push(eq(inventoryMovements.productId, input.productId))
  if (input.type) conditions.push(eq(inventoryMovements.type, input.type))

  return db
    .select({
      id: inventoryMovements.id,
      productId: inventoryMovements.productId,
      productName: products.name,
      type: inventoryMovements.type,
      quantityDelta: inventoryMovements.quantityDelta,
      note: inventoryMovements.note,
      actor: inventoryMovements.actor,
      createdAt: inventoryMovements.createdAt,
    })
    .from(inventoryMovements)
    .innerJoin(products, eq(inventoryMovements.productId, products.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(inventoryMovements.createdAt))
    .limit(input.limit ?? 50)
}

export async function revertMovement(input: { movementId: number; actor?: Actor }) {
  const [movement] = await db.select().from(inventoryMovements).where(eq(inventoryMovements.id, input.movementId))
  if (!movement) throw new Error('Unknown movement')
  if (movement.type === 'sale' || movement.type === 'return' || movement.type === 'receiving') {
    throw new Error(`Cannot revert a ${movement.type} movement — only manual adjustments and transfers can be undone`)
  }

  const [product] = await db.select().from(products).where(eq(products.id, movement.productId))
  if (!product) throw new Error('Product not found')

  const reversedDelta = -movement.quantityDelta
  const nextQuantity = product.quantity + reversedDelta
  if (nextQuantity < 0) {
    throw new Error(`Reverting this movement would take ${product.name} below zero stock`)
  }

  let reversal: typeof inventoryMovements.$inferSelect
  await db.update(products).set({ quantity: nextQuantity }).where(eq(products.id, product.id))
  const [r] = await db
    .insert(inventoryMovements)
    .values({
      productId: product.id,
      type: movement.type,
      quantityDelta: reversedDelta,
      note: `Reverted movement #${movement.id}${movement.note ? ` (${movement.note})` : ''}`,
      actor: input.actor ?? 'human',
    })
    .returning()
  reversal = r!

  return { product: { ...product, quantity: nextQuantity }, reversal: reversal! }
}

// ---------------------------------------------------------------------------
// Agent Missions — live-derived progress, never fabricated
// ---------------------------------------------------------------------------

export async function getMissionStatus() {
  const health = await getInventoryHealthCheck()
  const pending = await listAgentActions({ status: 'pending' })
  const executedActions = await listAgentActions({ status: 'executed' })
  const deadStock = await findDeadStock({})

  const tasks = [
    {
      id: 'resolve_critical',
      label: 'Resolve all critical-risk products',
      done: health.highSeverityCount === 0,
      progress: health.highSeverityCount,
      target: 0,
    },
    {
      id: 'clear_pending_actions',
      label: 'Review all pending agent actions',
      done: pending.length === 0,
      progress: pending.length,
      target: 0,
    },
    {
      id: 'address_dead_stock',
      label: 'Address dead-stock products',
      done: deadStock.length === 0,
      progress: deadStock.length,
      target: 0,
    },
    {
      id: 'agent_executed_action',
      label: 'Have the agent execute at least one approved action',
      done: executedActions.length > 0,
      progress: executedActions.length,
      target: 1,
    },
  ]

  const completedCount = tasks.filter((t) => t.done).length

  return {
    missionId: '30_day_inventory_health',
    title: '30-Day Inventory Health',
    tasks,
    completedCount,
    totalCount: tasks.length,
    percentComplete: Math.round((completedCount / tasks.length) * 100),
  }
}

// ---------------------------------------------------------------------------
// Business Policies — configurable thresholds and rules
// ---------------------------------------------------------------------------

const DEFAULT_POLICIES: Array<{ key: string; value: string; description: string }> = [
  { key: 'maxPoWithoutApproval', value: '100000', description: 'Max PO value in cents without requiring approval' },
  { key: 'minMarginPercent', value: '18', description: 'Minimum acceptable margin percent' },
  { key: 'emergencyStockDays', value: '7', description: 'Days of emergency stock to maintain' },
  { key: 'targetCoverageDays', value: '30', description: 'Target inventory coverage in days' },
  { key: 'safetyStockPercent', value: '15', description: 'Safety stock as percent of average demand' },
  { key: 'autoApproveThreshold', value: '50000', description: 'Auto-approve POs below this value in cents' },
  { key: 'maxSupplierConcentration', value: '40', description: 'Max percent of value from a single supplier' },
  { key: 'deadStockDays', value: '60', description: 'Days with no sales to classify as dead stock' },
]

export async function getBusinessPolicies() {
  const rows = await db.select().from(businessPolicies)
  // Merge with defaults — defaults fill in any missing keys
  const existing = new Map(rows.map((r) => [r.key, r]))
  return DEFAULT_POLICIES.map((d) => ({
    key: d.key,
    value: existing.get(d.key)?.value ?? d.value,
    description: d.description,
    updatedAt: existing.get(d.key)?.updatedAt ?? null,
  }))
}

export async function updateBusinessPolicy(input: { key: string; value: string }) {
  const existing = await db.select().from(businessPolicies).where(eq(businessPolicies.key, input.key))
  if (existing.length) {
    await db
      .update(businessPolicies)
      .set({ value: input.value, updatedAt: new Date() })
      .where(eq(businessPolicies.key, input.key))
  } else {
    await db.insert(businessPolicies).values({ key: input.key, value: input.value })
  }
  return { key: input.key, value: input.value }
}

export async function getPolicyValue(key: string): Promise<string | null> {
  const [row] = await db.select().from(businessPolicies).where(eq(businessPolicies.key, key))
  if (row) return row.value
  const def = DEFAULT_POLICIES.find((d) => d.key === key)
  return def?.value ?? null
}

// ---------------------------------------------------------------------------
// Morning Briefing — one-call comprehensive status report
// ---------------------------------------------------------------------------

export async function getMorningBriefing() {
  const [health, plan, pending, deadStock, suppliers] = await Promise.all([
    getInventoryHealthCheck(),
    buildReplenishmentPlan(),
    listAgentActions({ status: 'pending' }),
    findDeadStock(),
    getSupplierIntelligence(),
  ])

  const urgentIssues = health.issues.filter((i) => i.severity === 'high')
  const watchIssues = health.issues.filter((i) => i.severity === 'medium')
  const deadStockCapital = deadStock.reduce((s, d) => s + d.capitalTiedUpCents, 0)
  const supplierAlerts = suppliers.filter((s) => s.onTimePct !== null && s.onTimePct < 70)

  const topAction = plan.items[0] ?? null
  const healthScore = Math.max(
    0,
    100 - health.highSeverityCount * 15 - health.mediumSeverityCount * 5 - health.lowSeverityCount * 1,
  )

  return {
    generatedAt: new Date().toISOString(),
    healthScore,
    summary:
      health.totalIssues === 0
        ? 'All clear — inventory is healthy.'
        : `${health.highSeverityCount} critical, ${health.mediumSeverityCount} warning, ${health.lowSeverityCount} info issue(s).`,
    urgentIssues,
    watchIssues,
    reorderBudgetCents: plan.totalEstimatedCostCents,
    reorderItems: plan.items.length,
    pendingApprovals: pending.length,
    deadStockCapitalCents: deadStockCapital,
    deadStockCount: deadStock.length,
    supplierAlerts,
    topAction: topAction
      ? {
          name: topAction.name,
          sku: topAction.sku,
          suggestedQuantity: topAction.suggestedQuantity,
          estimatedCostCents: topAction.estimatedCostCents,
          supplierName: topAction.recommendedSupplierName,
          riskLevel: topAction.riskLevel,
          coverageDays: topAction.coverageDays,
        }
      : null,
    budgetSummary: plan.totalEstimatedCostCents > 0
      ? {
          totalCents: plan.totalEstimatedCostCents,
          breakdown: plan.groupedBySupplier.map((g) => ({
            supplierName: g.supplierName,
            itemCount: g.items.length,
            subtotalCents: g.subtotalCents,
          })),
        }
      : null,
  }
}

// ---------------------------------------------------------------------------
// Emergency Impact — supplier failure analysis
// ---------------------------------------------------------------------------

export async function getEmergencyImpact(input: { supplierId: number; delayDays?: number }) {
  const delayDays = input.delayDays ?? 14

  const [supplierRow, supplierProducts, intelligence] = await Promise.all([
    db.select().from(suppliers).where(eq(suppliers.id, input.supplierId)).then((r) => r[0]),
    db
      .select({
        productId: products.id,
        sku: products.sku,
        name: products.name,
        quantity: products.quantity,
        costCents: products.costCents,
        priceCents: products.priceCents,
        leadTimeDays: suppliers.leadTimeDays,
        delayDays: suppliers.delayDays,
      })
      .from(products)
      .innerJoin(suppliers, eq(products.supplierId, suppliers.id))
      .where(eq(products.supplierId, input.supplierId)),
    getSupplierIntelligence(),
  ])

  if (!supplierRow) throw new Error('Unknown supplier')

  const intel = intelligence.find((s) => s.supplierId === input.supplierId)
  const { recentUnits } = await velocityWindows()

  const impacts = []
  for (const product of supplierProducts) {
    const recentDaily = round1((recentUnits.get(product.productId) ?? 0) / 7)
    const velocity = recentDaily > 0 ? recentDaily : 1
    const coverageDays = round1(product.quantity / velocity)
    const effectiveLeadTime = product.leadTimeDays + product.delayDays + delayDays
    const willStockOut = coverageDays < effectiveLeadTime

    // Find alternate suppliers
    const alternates = await db
      .select({
        supplierId: productSuppliers.supplierId,
        name: suppliers.name,
        unitCostCents: productSuppliers.unitCostCents,
        leadTimeDays: productSuppliers.leadTimeDays,
      })
      .from(productSuppliers)
      .innerJoin(suppliers, eq(productSuppliers.supplierId, suppliers.id))
      .where(
        and(
          eq(productSuppliers.productId, product.productId),
          not(eq(productSuppliers.supplierId, input.supplierId)),
        ),
      )

    const daysUntilStockout = coverageDays
    const revenueAtRiskCents = willStockOut ? Math.ceil(daysUntilStockout * velocity) * product.priceCents : 0

    impacts.push({
      productId: product.productId,
      sku: product.sku,
      name: product.name,
      currentStock: product.quantity,
      dailyVelocity: velocity,
      coverageDays,
      willStockOut,
      daysUntilStockout: willStockOut ? Math.round(daysUntilStockout) : null,
      effectiveLeadTimeDays: effectiveLeadTime,
      alternateSuppliers: alternates,
      revenueAtRiskCents,
    })
  }

  const stockoutRisk = impacts.filter((i) => i.willStockOut).length
  const totalRevenueAtRiskCents = impacts.reduce((s, i) => s + i.revenueAtRiskCents, 0)

  return {
    generatedAt: new Date().toISOString(),
    supplier: {
      id: supplierRow.id,
      name: supplierRow.name,
      leadTimeDays: supplierRow.leadTimeDays,
      currentDelayDays: supplierRow.delayDays,
      reliabilityScore: intel?.reliabilityScore ?? null,
      onTimePct: intel?.onTimePct ?? null,
    },
    delayDays,
    affectedProducts: impacts.length,
    stockoutRisk,
    totalRevenueAtRiskCents,
    totalRevenueAtRisk: `$${(totalRevenueAtRiskCents / 100).toFixed(2)}`,
    products: impacts,
    recommendation:
      stockoutRisk > 0
        ? `URGENT: ${stockoutRisk} product(s) will stock out within the delay window. Consider alternate suppliers immediately.`
        : `No imminent stockouts, but ${impacts.length} product(s) have reduced coverage. Monitor closely.`,
  }
}

// ---------------------------------------------------------------------------
// Inventory Detective — discrepancy & anomaly detection
// ---------------------------------------------------------------------------

export async function investigateInventory() {
  const [movements, productRows, poRows, poItems] = await Promise.all([
    db.select().from(inventoryMovements).orderBy(desc(inventoryMovements.createdAt)).limit(200),
    db.select().from(products),
    db.select().from(purchaseOrders),
    db.select().from(purchaseOrderItems),
  ])

  const issues: Array<{
    type: string
    severity: 'low' | 'medium' | 'high'
    productId?: number
    productName?: string
    description: string
    recommendation: string
  }> = []

  // Negative stock check
  for (const p of productRows) {
    if (p.quantity < 0) {
      issues.push({
        type: 'negative_stock',
        severity: 'high',
        productId: p.id,
        productName: p.name,
        description: `${p.name} (${p.sku}) has negative stock: ${p.quantity} units.`,
        recommendation: 'Investigate immediately — negative stock indicates a data integrity issue.',
      })
    }
  }

  // Suspicious adjustments (large deltas without notes)
  const adjustments = movements.filter((m) => m.type === 'adjustment' && Math.abs(m.quantityDelta) > 10)
  for (const adj of adjustments) {
    const product = productRows.find((p) => p.id === adj.productId)
    issues.push({
      type: 'suspicious_adjustment',
      severity: adj.note ? 'low' : 'medium',
      productId: adj.productId,
      productName: product?.name,
      description: `Large adjustment of ${adj.quantityDelta > 0 ? '+' : ''}${adj.quantityDelta} units on ${product?.name ?? `product ${adj.productId}`}${adj.note ? '' : ' (no note explaining reason)'}.`,
      recommendation: adj.note
        ? `Verify adjustment reason: "${adj.note}"`
        : 'Add a note explaining this adjustment for the audit trail.',
    })
  }

  // Duplicate SKU check (shouldn't happen but worth detecting)
  const skuCounts = new Map<string, number>()
  for (const p of productRows) {
    skuCounts.set(p.sku, (skuCounts.get(p.sku) ?? 0) + 1)
  }
  for (const [sku, count] of skuCounts) {
    if (count > 1) {
      const product = productRows.find((p) => p.sku === sku)
      issues.push({
        type: 'duplicate_sku',
        severity: 'high',
        productId: product?.id,
        productName: product?.name,
        description: `SKU "${sku}" appears ${count} times in the catalog.`,
        recommendation: 'Merge or rename duplicate SKUs to prevent order confusion.',
      })
    }
  }

  // PO items with mismatched quantities (received vs ordered)
  const receivedMovements = movements.filter((m) => m.type === 'receiving')
  for (const po of poRows) {
    if (po.status !== 'received') continue
    const items = poItems.filter((i) => i.purchaseOrderId === po.id)
    for (const item of items) {
      const received = receivedMovements
        .filter((m) => m.productId === item.productId && m.note?.includes(po.poNumber))
        .reduce((sum, m) => sum + m.quantityDelta, 0)
      if (received !== item.quantity) {
        const product = productRows.find((p) => p.id === item.productId)
        issues.push({
          type: 'receiving_discrepancy',
          severity: 'medium',
          productId: item.productId,
          productName: product?.name,
          description: `${po.poNumber}: ordered ${item.quantity} of ${product?.name ?? `product ${item.productId}`}, received ${received}.`,
          recommendation: 'Investigate the discrepancy — may indicate shipping error or miscount.',
        })
      }
    }
  }

  // Stale products (no movement in 30+ days but still in stock)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000)
  const recentProductIds = new Set(
    movements.filter((m) => m.createdAt && m.createdAt > thirtyDaysAgo).map((m) => m.productId),
  )
  for (const p of productRows) {
    if (p.quantity > 0 && !recentProductIds.has(p.id)) {
      issues.push({
        type: 'stale_product',
        severity: 'low',
        productId: p.id,
        productName: p.name,
        description: `${p.name} (${p.sku}) has ${p.quantity} units but no movement in 30+ days.`,
        recommendation: 'Consider running a promotion or reevaluating demand for this SKU.',
      })
    }
  }

  const bySeverity = {
    high: issues.filter((i) => i.severity === 'high').length,
    medium: issues.filter((i) => i.severity === 'medium').length,
    low: issues.filter((i) => i.severity === 'low').length,
  }

  return {
    generatedAt: new Date().toISOString(),
    totalIssues: issues.length,
    highSeverityCount: bySeverity.high,
    mediumSeverityCount: bySeverity.medium,
    lowSeverityCount: bySeverity.low,
    issues,
  }
}
