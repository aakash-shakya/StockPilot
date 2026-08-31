import { zodToJsonSchema } from '@alcyone-labs/zod-to-json-schema'
import { z } from 'zod'
import {
  approvePurchaseOrderFn,
  approvePurchaseOrderSchema,
  analyzeStockRiskSchema,
  analyzeStockRiskFn,
  buildReplenishmentPlanSchema,
  buildReplenishmentPlanFn,
  compareSuppliersSchema,
  compareSuppliersFn,
  createProductFromDraftFn,
  createProductFromDraftSchema,
  createPurchaseOrderFn,
  createPurchaseOrderSchema,
  createReplenishmentProposalsFn,
  decideAgentActionSchema,
  decideAgentActionFn,
  draftProductSchema,
  draftProductFn,
  findDeadStockSchema,
  findDeadStockFn,
  findLowStockSchema,
  findLowStockFn,
  forecastDemandSchema,
  generateReportSchema,
  generateReportFn,
  generateReportCsvFn,
  generateSkuSchema,
  generateSkuFn,
  getEmergencyImpactSchema,
  getEmergencyImpactFn,
  getBusinessPoliciesFn,
  getInventoryHealthCheckSchema,
  getInventoryHealthCheckFn,
  getInventoryMovementsSchema,
  getInventoryMovementsFn,
  getInventorySummaryFn,
  getMissionStatusFn,
  getMorningBriefingFn,
  getProductDetailsSchema,
  getProductDetailsFn,
  getPurchaseOrdersSchema,
  getPurchaseOrdersFn,
  getRecentAgentActivityFn,
  getSalesVelocitySchema,
  getSalesVelocityFn,
  getSupplierIntelligenceSchema,
  getSupplierIntelligenceFn,
  getSuppliersSchema,
  getSuppliersFn,
  investigateInventoryFn,
  listAgentActionsSchema,
  listAgentActionsFn,
  logAgentToolCallFn,
  proposeReplenishmentSchema,
  queryInventorySchema,
  queryInventoryFn,
  receiveShipmentSchema,
  receiveShipmentFn,
  recommendReorderSchema,
  recommendReorderFn,
  revertMovementSchema,
  revertMovementFn,
  searchProductsSchema,
  searchProductsFn,
  simulateInventorySchema,
  simulateInventoryFn,
  updateBusinessPolicySchema,
  updateBusinessPolicyFn,
  updateStockSchema,
  updateStockFn,
  whatShouldIWorryAboutSchema,
  whatShouldIWorryAboutFn,
} from '../../server/inventory.functions.js'
import { beginActivity, completeActivity, failActivity } from '../agent-activity-store.js'

function toJsonSchema(schema: any): Record<string, unknown> {
  const json = zodToJsonSchema(schema, { target: 'jsonSchema7', $refStrategy: 'none' }) as any
  // Ensure strictness: disallow additional properties at top level if not set
  if (json.type === 'object' && json.additionalProperties === undefined) json.additionalProperties = false
  return json
}

interface ToolContent {
  content: Array<{ type: 'text'; text: string }>
  structuredContent?: unknown
  isError?: boolean
}

interface ToolDef {
  name: string
  title: string
  description: string
  inputSchema: Record<string, unknown>
  outputSchema?: Record<string, unknown>
  annotations: { readOnlyHint: boolean; destructiveHint: boolean; idempotentHint: boolean; openWorldHint: boolean; title?: string }
  readOnly: boolean // keep for backward compat derived from annotations.readOnlyHint
  run: (input: any) => Promise<{ summary: string; payload: unknown }>
}

function toolResult(payload: unknown, opts?: { structuredContent?: unknown; isError?: boolean }): ToolContent {
  const base: any = { content: [{ type: 'text', text: JSON.stringify(payload) }] }
  if (opts?.structuredContent) base.structuredContent = opts.structuredContent
  if (opts?.isError) base.isError = true
  return base
}

function toolSuccess(payload: unknown, structuredContent?: unknown): ToolContent {
  return toolResult(payload, structuredContent !== undefined ? { structuredContent } : undefined)
}

function toolError(mapped: { code: string; message: string; hint: string }): ToolContent {
  return toolResult({ error: mapped.message, code: mapped.code, hint: mapped.hint }, { isError: true })
}

function mapError(error: unknown): { code: string; message: string; hint: string } {
  if (error instanceof Error) {
    const msg = error.message
    if (msg.includes('Unknown product') || msg.includes('not found') || msg.includes('Unknown action'))
      return { code: 'NOT_FOUND', message: msg, hint: 'Use search_products to discover valid ids' }
    if (msg.includes('already')) return { code: 'CONFLICT', message: msg, hint: 'Resource already in that state' }
    if (msg.includes('must be approved') || msg.includes('cannot be reverted'))
      return { code: 'PRECONDITION_FAILED', message: msg, hint: 'Check status preconditions' }
    if (msg.toLowerCase().includes('zod') || msg.includes('validation'))
      return { code: 'INVALID_INPUT', message: msg, hint: 'Check required fields and types' }
    return { code: 'INVALID_INPUT', message: msg, hint: 'Check input' }
  }
  return { code: 'INVALID_INPUT', message: 'Unknown error', hint: 'Retry with valid inputs' }
}

const money = (cents: number) => `$${(cents / 100).toFixed(2)}`

// ---------------------------------------------------------------------------
// READ — fetch existing data, no analysis or side effects
// ---------------------------------------------------------------------------

const READ_TOOLS: ToolDef[] = [
  {
    name: 'search_products',
    title: 'Search products',
    description:
      'Search the product catalog by name or SKU, optionally filtered by category. ' +
      'IMPORTANT: Use partial strings if exact match fails. If no results found, try semantic variations ' +
      '(e.g. "wireless" instead of "Wireless Charging Pad", or "charger" instead of "charging"). ' +
      'For natural-language questions like "what electronics are running low", use query_inventory instead.',
    inputSchema: toJsonSchema(searchProductsSchema),
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
      title: 'Search products',
    },
    readOnly: true,
    run: async (input) => {
      const results = await searchProductsFn({ data: input })
      return { summary: `Found ${results.length} matching product(s)`, payload: results }
    },
  },
  {
    name: 'get_inventory_summary',
    title: 'Get inventory summary',
    description:
      'Get store-wide inventory health: total units and products, how many are critical/warning/watch/healthy, and average stock coverage in days.',
    inputSchema: toJsonSchema(getInventoryHealthCheckSchema),
    outputSchema: { type: 'object', properties: {}, additionalProperties: true },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
      title: 'Get inventory summary',
    },
    readOnly: true,
    run: async () => {
      const summary = await getInventorySummaryFn()
      return {
        summary: `${summary.totalProducts} products, ${summary.criticalCount} critical and ${summary.warningCount} at warning level`,
        payload: summary,
      }
    },
  },
  {
    name: 'find_low_stock',
    title: 'Find low stock',
    description:
      'Find products that are at or below their reorder threshold, or projected to run out within a given number of days. ' +
      'Returns a flat list without trend analysis — for velocity trends and risk explanations, use analyze_stock_risk instead. ' +
      'If no results found, try increasing the days parameter (e.g. 14 or 30).',
    inputSchema: toJsonSchema(findLowStockSchema),
    outputSchema: { type: 'object', properties: {}, additionalProperties: true },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
      title: 'Find low stock',
    },
    readOnly: true,
    run: async (input) => {
      const results = await findLowStockFn({ data: input })
      return { summary: `${results.length} product(s) at risk within ${input.days ?? 7} days`, payload: results }
    },
  },
  {
    name: 'get_product_details',
    title: 'Get product details',
    description:
      'Get full detail for one product: current stock, supplier, lead time, risk level, and its last 25 inventory movements (sales, restocks, adjustments, receiving).',
    inputSchema: toJsonSchema(getProductDetailsSchema),
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
      title: 'Get product details',
    },
    readOnly: true,
    run: async (input) => {
      const product = await getProductDetailsFn({ data: input })
      if (!product) return { summary: 'Product not found', payload: null }
      return { summary: `${product.name}: ${product.quantity} units in stock, ${product.riskLevel} risk`, payload: product }
    },
  },
  {
    name: 'get_sales_velocity',
    title: 'Get sales velocity',
    description: 'Get the average daily units sold for a product over a trailing window (default 14 days).',
    inputSchema: toJsonSchema(getSalesVelocitySchema),
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
      title: 'Get sales velocity',
    },
    readOnly: true,
    run: async (input) => {
      const result = await getSalesVelocityFn({ data: input })
      return { summary: `${result.dailyVelocity} units/day over the last ${result.days} days`, payload: result }
    },
  },
  {
    name: 'get_purchase_orders',
    title: 'Get purchase orders',
    description: 'List purchase orders and their line items, optionally filtered by status (draft, approved, received).',
    inputSchema: toJsonSchema(getPurchaseOrdersSchema),
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
      title: 'Get purchase orders',
    },
    readOnly: true,
    run: async (input) => {
      const orders = await getPurchaseOrdersFn({ data: input })
      return { summary: `${orders.length} purchase order(s)`, payload: orders }
    },
  },
  {
    name: 'get_inventory_movements',
    title: 'Get inventory movement history',
    description:
      'List raw inventory movements (sales, restocks, adjustments, transfers, receiving), optionally filtered by product or movement type. Use this as the audit trail behind any stock change, and to find a movement id to pass to revert_movement.',
    inputSchema: toJsonSchema(getInventoryMovementsSchema),
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
      title: 'Get inventory movement history',
    },
    readOnly: true,
    run: async (input) => {
      const rows = await getInventoryMovementsFn({ data: input })
      return { summary: `${rows.length} movement(s)`, payload: rows }
    },
  },
  {
    name: 'get_suppliers',
    title: 'Get suppliers',
    description: 'List all suppliers with their standard lead time and any known current shipment delay.',
    inputSchema: toJsonSchema(getSuppliersSchema),
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
      title: 'Get suppliers',
    },
    readOnly: true,
    run: async () => {
      const rows = await getSuppliersFn()
      return { summary: `${rows.length} supplier(s)`, payload: rows }
    },
  },
  {
    name: 'get_mission_status',
    title: 'Get 30-day health mission status',
    description:
      'Get progress on the 30-Day Inventory Health mission: current health score, baseline score, target score, progress percentage, days remaining, and the list of completed milestones. Use this to track whether the shop is on track to meet its health goals.',
    inputSchema: toJsonSchema(whatShouldIWorryAboutSchema),
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
      title: 'Get 30-day health mission status',
    },
    readOnly: true,
    run: async () => {
      const result = await getMissionStatusFn()
      return { summary: `Mission "${result.title}": ${result.percentComplete}% complete (${result.completedCount}/${result.totalCount} tasks)`, payload: result }
    },
  },
  {
    name: 'get_recent_agent_activity',
    title: 'Get recent agent activity',
    description:
      'List the most recent WebMCP tool calls made by the agent in this session, with tool name, input, summary, timestamp, and estimated token cost. Use this to review what the agent has done so far.',
    inputSchema: toJsonSchema(z.object({ limit: z.number().int().min(1).max(50).optional().describe('Max rows to return (default 20)') })),
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
      title: 'Get recent agent activity',
    },
    readOnly: true,
    run: async (input) => {
      const rows = await getRecentAgentActivityFn({ data: input })
      return { summary: `${rows.length} recent tool call(s)`, payload: rows }
    },
  },
  {
    name: 'generate_report_csv',
    title: 'Generate a report as CSV',
    description:
      'Generate a structured report and return it as a downloadable CSV string. Same report types as generate_report: monthly inventory, declining sales, supplier performance, cash tied up. Use this when the user wants to download or export data.',
    inputSchema: toJsonSchema(generateReportSchema),
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
      title: 'Generate a report as CSV',
    },
    readOnly: true,
    run: async (input) => {
      const result = await generateReportCsvFn({ data: input })
      return { summary: `CSV report "${result.title}" generated (${result.csv.split('\n').length} rows)`, payload: result }
    },
  },
]

// ---------------------------------------------------------------------------
// ANALYZE — read-only computation: risk, forecasting, comparisons, reports
// ---------------------------------------------------------------------------

const ANALYZE_TOOLS: ToolDef[] = [
  {
    name: 'analyze_stock_risk',
    title: 'Analyze stock risk',
    description:
      'Run a fuller risk analysis than find_low_stock: for each product, compares recent (7-day) vs. baseline (prior 23-day) ' +
      'sales velocity to flag whether depletion is accelerating, steady, or declining, and factors in supplier lead time ' +
      'and any known shipment delays. Use this to explain WHY a product is at risk, not just that it is. ' +
      'If no at-risk products found, the inventory is healthy — try get_inventory_summary for a full picture.',
    inputSchema: toJsonSchema(analyzeStockRiskSchema),
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
      title: 'Analyze stock risk',
    },
    readOnly: true,
    run: async (input) => {
      const result = await analyzeStockRiskFn({ data: input })
      const accelerating = result.products.filter((p: any) => p.trend === 'accelerating').length
      return { summary: `${result.atRiskCount} product(s) at risk, ${accelerating} accelerating`, payload: result }
    },
  },
  {
    name: 'recommend_reorder',
    title: 'Recommend reorder quantities',
    description:
      'Compute suggested reorder quantities and estimated cost for a set of products (or, if none given, every currently ' +
      'at-risk product) — enough stock to cover the target coverage window plus the supplier lead time and any known delay. ' +
      'This does NOT place an order; it only recommends one. ' +
      'IMPORTANT: To actually create a purchase order, use create_purchase_order after reviewing the recommendation.',
    inputSchema: toJsonSchema(recommendReorderSchema),
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
      title: 'Recommend reorder quantities',
    },
    readOnly: true,
    run: async (input) => {
      const recs = await recommendReorderFn({ data: input })
      const totalCents = recs.reduce((sum: number, r: any) => sum + r.estimatedCostCents, 0)
      return { summary: `Recommended reordering ${recs.length} product(s), est. ${money(totalCents)}`, payload: recs }
    },
  },
  {
    name: 'get_supplier_intelligence',
    title: 'Get supplier intelligence',
    description:
      'Get computed reliability metrics per supplier: on-time delivery %, average delay days, active order count, average unit cost, and a 0-100 reliability score derived from real purchase order history.',
    inputSchema: toJsonSchema(getSupplierIntelligenceSchema),
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
      title: 'Get supplier intelligence',
    },
    readOnly: true,
    run: async () => {
      const rows = await getSupplierIntelligenceFn()
      return { summary: `${rows.length} supplier(s) rated`, payload: rows }
    },
  },
  {
    name: 'compare_suppliers',
    title: 'Compare suppliers for a product',
    description:
      'Compare every supplier option available for a product (cost, lead time, current delay, reliability score) and get a recommended supplier with reasoning. Use this before drafting an urgent purchase order.',
    inputSchema: toJsonSchema(compareSuppliersSchema),
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
      title: 'Compare suppliers for a product',
    },
    readOnly: true,
    run: async (input) => {
      const result = await compareSuppliersFn({ data: input })
      return { summary: result.recommendationReason ?? 'No supplier options found', payload: result }
    },
  },
  {
    name: 'find_dead_stock',
    title: 'Find dead stock',
    description:
      'Find products with zero units sold over a window (default 60 days) that still have stock on hand, ranked by capital tied up. Use this to identify candidates for clearance or discontinuation.',
    inputSchema: toJsonSchema(findDeadStockSchema),
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
      title: 'Find dead stock',
    },
    readOnly: true,
    run: async (input) => {
      const rows = await findDeadStockFn({ data: input })
      const totalCents = rows.reduce((sum: number, r: any) => sum + r.capitalTiedUpCents, 0)
      return { summary: `${rows.length} dead-stock product(s), ${money(totalCents)} tied up`, payload: rows }
    },
  },
  {
    name: 'get_inventory_health_check',
    title: 'Run inventory health check',
    description:
      'Run a full diagnostic sweep: low stock, stockouts, dead stock, abnormal sales changes, supplier delays, overdue POs, risk concentration, and single-supplier dependency. Returns every issue found with severity and recommended action. Use this for a raw diagnostic view; for a prioritized briefing, use what_should_i_worry_about.',
    inputSchema: toJsonSchema(getInventoryHealthCheckSchema),
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
      title: 'Run inventory health check',
    },
    readOnly: true,
    run: async () => {
      const result = await getInventoryHealthCheckFn()
      return {
        summary: `${result.totalIssues} issue(s): ${result.highSeverityCount} high, ${result.mediumSeverityCount} medium, ${result.lowSeverityCount} low`,
        payload: result,
      }
    },
  },
  {
    name: 'what_should_i_worry_about',
    title: 'What should I worry about today?',
    description:
      'Get a single prioritized operational briefing: pending agent approvals first, then the highest-severity inventory health issues. Use this for a quick actionable summary. For the full dashboard readout with health score, budget, and supplier alerts, use get_morning_briefing instead.',
    inputSchema: toJsonSchema(whatShouldIWorryAboutSchema),
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
      title: 'What should I worry about today?',
    },
    readOnly: true,
    run: async () => {
      const result = await whatShouldIWorryAboutFn()
      return { summary: result.summary, payload: result }
    },
  },
  {
    name: 'forecast_demand',
    title: 'Forecast demand and stockout date',
    description:
      "Project a product's stock level forward assuming current demand and lead time continue unchanged. This is a read-only forecast — use simulate_inventory instead to test a hypothetical change in demand or lead time.",
    inputSchema: toJsonSchema(forecastDemandSchema),
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
      title: 'Forecast demand and stockout date',
    },
    readOnly: true,
    run: async (input) => {
      const result = await simulateInventoryFn({ data: { productId: input.productId, horizonDays: input.horizonDays } })
      return {
        summary: result.baseline.projectedStockoutDate
          ? `${result.name} projected to stock out around ${result.baseline.projectedStockoutDate}`
          : `${result.name} has no near-term stockout risk at current velocity`,
        payload: result,
      }
    },
  },
  {
    name: 'simulate_inventory',
    title: 'Simulate a demand or lead-time change',
    description:
      'What-if simulation: given a hypothetical % change in demand and/or a change in supplier lead time (in days), project the resulting coverage, stockout date, and suggested reorder quantity against the current baseline. All assumptions used are returned alongside the result for transparency.',
    inputSchema: toJsonSchema(simulateInventorySchema),
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
      title: 'Simulate a demand or lead-time change',
    },
    readOnly: true,
    run: async (input) => {
      const result = await simulateInventoryFn({ data: input })
      return {
        summary: `Simulated coverage: ${result.simulated.coverageDays ?? 'n/a'} day(s), suggested reorder ${result.simulated.suggestedReorderQuantity} unit(s)`,
        payload: result,
      }
    },
  },
  {
    name: 'query_inventory',
    title: 'Query inventory in natural language',
    description:
      'Convert a natural-language inventory question (e.g. "what electronics are running out in the next 5 days") ' +
      'into structured filters and return matching products. Parsing is deterministic and rule-based. ' +
      'IMPORTANT: If no results found, retry with semantic variations or simpler phrasing. ' +
      'For targeted lookups by exact name or SKU, use search_products instead.',
    inputSchema: toJsonSchema(queryInventorySchema),
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
      title: 'Query inventory in natural language',
    },
    readOnly: true,
    run: async (input) => {
      const result = await queryInventoryFn({ data: input })
      return { summary: `${result.resultCount} product(s) matched`, payload: result }
    },
  },
  {
    name: 'generate_report',
    title: 'Generate a report',
    description:
      'Generate a structured report from a natural-language request. Supported types: monthly inventory summary, declining-sales report, supplier-performance report, cash-tied-up-in-inventory report. Any unrecognized request defaults to monthly inventory. If you need a different report type, compose the answer from primitive tools (search_products, get_inventory_summary, etc.) instead.',
    inputSchema: toJsonSchema(generateReportSchema),
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
      title: 'Generate a report',
    },
    readOnly: true,
    run: async (input) => {
      const result = await generateReportFn({ data: input })
      return { summary: `${result.title}: ${result.findings.length} finding(s)`, payload: result }
    },
  },
  {
    name: 'build_replenishment_plan',
    title: 'Build a Smart Replenishment plan',
    description:
      'Compose the full replenishment workflow read-only: finds every at-risk product, computes a suggested reorder quantity for each, compares suppliers per product, and groups everything into one draft purchase order per recommended supplier with cost subtotals. Optionally filter by category and set a budget cap — items are prioritized by urgency and fitted within budget. This does NOT create anything — call propose_replenishment to turn this into pending approvals, or create_purchase_order per group once a human approves.',
    inputSchema: toJsonSchema(buildReplenishmentPlanSchema),
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
      title: 'Build a Smart Replenishment plan',
    },
    readOnly: true,
    run: async (input) => {
      const plan = await buildReplenishmentPlanFn({ data: input })
      return {
        summary: `${plan.items.length} product(s) across ${plan.groupedBySupplier.length} supplier(s), est. ${money(plan.totalEstimatedCostCents)}`,
        payload: plan,
      }
    },
  },
  {
    name: 'get_morning_briefing',
    title: 'Get morning briefing',
    description:
      'Get a comprehensive morning briefing in one call: health score (0-100), urgent issues, pending approvals, ' +
      'reorder budget, dead-stock capital, supplier alerts, and the single top action to take. ' +
      'Use this as the first call at the start of any session to get the full picture. ' +
      'Best opening query: "Run a morning briefing" or "What do I need to know today?"',
    inputSchema: toJsonSchema(whatShouldIWorryAboutSchema),
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
      title: 'Get morning briefing',
    },
    readOnly: true,
    run: async () => {
      const result = await getMorningBriefingFn()
      return {
        summary: `Health score ${result.healthScore}/100 — ${result.summary}`,
        payload: result,
      }
    },
  },
  {
    name: 'get_emergency_impact',
    title: 'Analyze supplier emergency impact',
    description:
      'Analyze the impact of a supplier failure or delay: which products are affected, which will stock out, how many days until stockout, alternate suppliers available, and total revenue at risk. Use this when a supplier reports a delay or you suspect a supply chain disruption.',
    inputSchema: toJsonSchema(getEmergencyImpactSchema),
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
      title: 'Analyze supplier emergency impact',
    },
    readOnly: true,
    run: async (input) => {
      const result = await getEmergencyImpactFn({ data: input })
      return {
        summary: `${result.affectedProducts} product(s) affected, ${result.stockoutRisk} at stockout risk, ${result.totalRevenueAtRisk} revenue at risk`,
        payload: result,
      }
    },
  },
  {
    name: 'investigate_inventory',
    title: 'Investigate inventory discrepancies',
    description:
      'Run a full inventory audit: detect negative stock, suspicious adjustments without notes, receiving discrepancies (ordered vs received), duplicate SKUs, and stale products with no movement in 30+ days. Returns every anomaly found with severity and recommended action.',
    inputSchema: toJsonSchema(whatShouldIWorryAboutSchema),
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
      title: 'Investigate inventory discrepancies',
    },
    readOnly: true,
    run: async () => {
      const result = await investigateInventoryFn()
      return {
        summary: `${result.totalIssues} issue(s): ${result.highSeverityCount} high, ${result.mediumSeverityCount} medium, ${result.lowSeverityCount} low`,
        payload: result,
      }
    },
  },
]

// ---------------------------------------------------------------------------
// CREATE — draft new catalog entries or orders; no live inventory/spend change
// ---------------------------------------------------------------------------

const CREATE_TOOLS: ToolDef[] = [
  {
    name: 'generate_sku',
    title: 'Generate a SKU',
    description:
      'Deterministically generate a unique CATEGORY-BRAND-MODEL[-VARIANT] SKU from product attributes, checked against existing SKUs for collisions. Rarely needed — generate_product creates the SKU automatically. Only use if you need a SKU code without drafting a full product.',
    inputSchema: toJsonSchema(generateSkuSchema),
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
      title: 'Generate a SKU',
    },
    readOnly: true,
    run: async (input) => {
      const sku = await generateSkuFn({ data: input })
      return { summary: `Generated SKU ${sku}`, payload: { sku } }
    },
  },
  {
    name: 'generate_product',
    title: 'Draft a new product',
    description:
      'Draft a new product record — including a deterministically generated SKU — WITHOUT saving it. Returns the full draft for human review. Call create_product_from_draft with the reviewed values to actually add it to the catalog.',
    inputSchema: toJsonSchema(draftProductSchema),
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
      title: 'Draft a new product',
    },
    readOnly: true,
    run: async (input) => {
      const draft = await draftProductFn({ data: input })
      return { summary: `Drafted ${draft.sku} — "${draft.name}", awaiting review`, payload: draft }
    },
  },
  {
    name: 'create_product_from_draft',
    title: 'Create product from a reviewed draft',
    description:
      'Add a new product to the live catalog from a draft produced by generate_product. This is CONSEQUENTIAL — it creates a real, permanent catalog entry. Only call this after a human has reviewed and approved the specific draft.',
    inputSchema: toJsonSchema(createProductFromDraftSchema),
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: false,
      title: 'Create product from a reviewed draft',
    },
    readOnly: false,
    run: async (input) => {
      const product = await createProductFromDraftFn({ data: input })
      return { summary: `Created ${product.sku} — "${product.name}"`, payload: product }
    },
  },
  {
    name: 'create_purchase_order',
    title: 'Create draft purchase order',
    description:
      'Create a DRAFT purchase order for a supplier with specific product quantities. All products must have that supplier as a valid option. This does not commit any spend or notify the supplier — it only creates a draft for a human to review. Call approve_purchase_order separately once the owner has explicitly approved it.',
    inputSchema: toJsonSchema(createPurchaseOrderSchema),
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: false,
      title: 'Create draft purchase order',
    },
    readOnly: false,
    run: async (input) => {
      const po = await createPurchaseOrderFn({ data: { ...input, createdBy: 'agent' } })
      return { summary: `Created draft ${po?.poNumber} (${money(po?.totalCostCents ?? 0)}) — awaiting approval`, payload: po }
    },
  },
]

// ---------------------------------------------------------------------------
// MUTATE — consequential changes to live inventory, spend, or orders
// ---------------------------------------------------------------------------

const MUTATE_TOOLS: ToolDef[] = [
  {
    name: 'approve_purchase_order',
    title: 'Approve purchase order',
    description:
      'Approve a draft purchase order, committing to place it with the supplier. This is a CONSEQUENTIAL action with real cost — only call this after the shop owner has explicitly approved the specific order in the conversation.',
    inputSchema: toJsonSchema(approvePurchaseOrderSchema),
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: false,
      openWorldHint: false,
      title: 'Approve purchase order',
    },
    readOnly: false,
    run: async (input) => {
      const po = await approvePurchaseOrderFn({ data: input })
      return { summary: `Approved ${po?.poNumber}`, payload: po }
    },
  },
  {
    name: 'receive_shipment',
    title: 'Receive shipment',
    description:
      'Mark an approved purchase order as received: adds every line item quantity to live stock and records a receiving movement for each. This is CONSEQUENTIAL — it changes real inventory counts. Only call this once the shop owner confirms the shipment physically arrived.',
    inputSchema: toJsonSchema(receiveShipmentSchema),
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: false,
      openWorldHint: false,
      title: 'Receive shipment',
    },
    readOnly: false,
    run: async (input) => {
      const po = await receiveShipmentFn({ data: { ...input, actor: 'agent' } })
      return { summary: `Received ${po?.poNumber} — stock updated`, payload: po }
    },
  },
  {
    name: 'update_stock',
    title: 'Update stock',
    description:
      "Directly adjust a product's stock count for manual corrections or transfers (not for recording ordinary sales, and not for receiving a purchase order — use receive_shipment for that). This is CONSEQUENTIAL — it changes the real, live stock count. Confirm the reason and quantity with the shop owner before calling it.",
    inputSchema: toJsonSchema(updateStockSchema),
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: false,
      openWorldHint: false,
      title: 'Update stock',
    },
    readOnly: false,
    run: async (input) => {
      const result = await updateStockFn({ data: { ...input, actor: 'agent' } })
      return { summary: `${result.product.name} stock is now ${result.product.quantity} units`, payload: result }
    },
  },
  {
    name: 'revert_movement',
    title: 'Revert an inventory movement',
    description:
      'Undo a previous manual adjustment or transfer by recording an equal-and-opposite movement (sales and receiving cannot be reverted this way). This is CONSEQUENTIAL — it changes real stock. Only call this after the shop owner confirms which specific movement to undo.',
    inputSchema: toJsonSchema(revertMovementSchema),
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: false,
      openWorldHint: false,
      title: 'Revert an inventory movement',
    },
    readOnly: false,
    run: async (input) => {
      const result = await revertMovementFn({ data: { ...input, actor: 'agent' } })
      return { summary: `Reverted movement #${input.movementId} — ${result.product.name} is now ${result.product.quantity} units`, payload: result }
    },
  },
]

// ---------------------------------------------------------------------------
// COLLABORATE — the human-in-the-loop Agent Action Center
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// NAVIGATE — lightweight client-side UI tools (DOM events, no server calls)
// ---------------------------------------------------------------------------

const NAVIGATE_TOOLS: ToolDef[] = [
  {
    name: 'navigate_to',
    title: 'Navigate to a page',
    description:
      'Navigate the user to any page in the app. Supports all routes: "/", "/products", "/products/:id", "/purchase-orders", "/suppliers", "/simulator", "/agent-tools". Use this to direct the user to a product detail page, the dashboard, or any other route. The agent should navigate after presenting information so the user can see the relevant page.',
    inputSchema: toJsonSchema(
      z.object({
        path: z.string().describe('Route path to navigate to (e.g. "/", "/products", "/products/3")'),
      }),
    ),
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
      title: 'Navigate to a page',
    },
    readOnly: true,
    run: async (input) => {
      window.dispatchEvent(new CustomEvent('agent:navigate', { detail: { path: input.path } }))
      return { summary: `Navigating to ${input.path}`, payload: { navigated: true, path: input.path } }
    },
  },
  {
    name: 'highlight_product',
    title: 'Highlight a product on screen',
    description:
      'Visually highlight a specific product on the current page by adding a brief pulsing glow effect around its card. Use this after presenting product analysis to draw the user\'s eye to the most important item. The highlight fades after a few seconds.',
    inputSchema: toJsonSchema(
      z.object({
        productId: z.number().describe('The product ID to highlight'),
        durationMs: z.number().optional().default(4000).describe('How long to highlight in milliseconds'),
      }),
    ),
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
      title: 'Highlight a product on screen',
    },
    readOnly: true,
    run: async (input) => {
      window.dispatchEvent(
        new CustomEvent('agent:highlight', { detail: { productId: input.productId, durationMs: input.durationMs ?? 4000 } }),
      )
      return { summary: `Highlighting product ${input.productId}`, payload: { highlighted: true, productId: input.productId } }
    },
  },
  {
    name: 'scroll_to_section',
    title: 'Scroll to a section of the page',
    description:
      'Scroll the page to a specific section. Can target by CSS selector, heading text, or element ID. Use this to direct the user\'s attention to a particular area — e.g. a product table, a form, a specific card, or a heading like "Stock Health".',
    inputSchema: toJsonSchema(
      z.object({
        selector: z.string().optional().describe('CSS selector to scroll to (e.g. "table", "#my-id", ".card")'),
        headingText: z.string().optional().describe('Heading text to scroll to (e.g. "Stock Health")'),
        elementId: z.string().optional().describe('DOM element ID to scroll to'),
      }),
    ),
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
      title: 'Scroll to a section of the page',
    },
    readOnly: true,
    run: async (input) => {
      let target: Element | null = null
      if (input.selector) {
        target = document.querySelector(input.selector)
      } else if (input.elementId) {
        target = document.getElementById(input.elementId)
      } else if (input.headingText) {
        const headings = document.querySelectorAll('h1, h2, h3, h4')
        for (const h of headings) {
          if (h.textContent?.toLowerCase().includes(input.headingText.toLowerCase())) {
            target = h
            break
          }
        }
      }
      if (!target) {
        return {
          summary: `Could not find element: ${input.selector ?? input.elementId ?? input.headingText}`,
          payload: { scrolled: false, error: 'Element not found' },
        }
      }
      target.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return { summary: `Scrolled to ${input.selector ?? input.elementId ?? input.headingText}`, payload: { scrolled: true } }
    },
  },
  {
    name: 'fill_input',
    title: 'Fill a form input',
    description:
      'Fill a text input, textarea, or number input on the page. Target by CSS selector or by the label/placehoder text next to it. Dispatches React-compatible events so controlled components update. Use after navigate_to to direct the agent to a form page.',
    inputSchema: toJsonSchema(
      z.object({
        selector: z.string().optional().describe('CSS selector of the input (e.g. "#email", "input[name=\'email\']")'),
        labelText: z.string().optional().describe('Label or placeholder text of the input to find (e.g. "Contact email")'),
        value: z.string().describe('Value to fill in'),
      }),
    ),
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
      title: 'Fill a form input',
    },
    readOnly: false,
    run: async (input) => {
      let el: HTMLInputElement | HTMLTextAreaElement | null = null
      if (input.selector) {
        el = document.querySelector(input.selector) as HTMLInputElement | HTMLTextAreaElement | null
      } else if (input.labelText) {
        const labels = document.querySelectorAll('label')
        for (const label of labels) {
          if (label.textContent?.toLowerCase().includes(input.labelText!.toLowerCase())) {
            const forId = label.getAttribute('for')
            if (forId) el = document.getElementById(forId) as HTMLInputElement | HTMLTextAreaElement
            else el = label.querySelector('input, textarea') as HTMLInputElement | HTMLTextAreaElement
            if (el) break
          }
        }
        if (!el) {
          const inputs = document.querySelectorAll('input, textarea') as NodeListOf<HTMLInputElement | HTMLTextAreaElement>
          for (const inp of inputs) {
            const ph = inp.getAttribute('placeholder') || ''
            if (ph.toLowerCase().includes(input.labelText!.toLowerCase())) {
              el = inp
              break
            }
          }
        }
      }
      if (!el) {
        return { summary: `Input not found: ${input.selector ?? input.labelText}`, payload: { filled: false, error: 'Input not found' } }
      }
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set
        ?? Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set
      nativeInputValueSetter?.call(el, input.value)
      el.dispatchEvent(new Event('input', { bubbles: true }))
      el.dispatchEvent(new Event('change', { bubbles: true }))
      el.dispatchEvent(new Event('blur', { bubbles: true }))
      return { summary: `Filled "${input.selector ?? input.labelText}" with "${input.value}"`, payload: { filled: true } }
    },
  },
  {
    name: 'type_text',
    title: 'Type text into a focused input',
    description:
      'Focus an input and type text character by character, simulating real keyboard input. Best for React-controlled inputs where fill_input might not trigger state updates. Fires keydown, keypress, input, and keyup events for each character.',
    inputSchema: toJsonSchema(
      z.object({
        selector: z.string().optional().describe('CSS selector of the input to type into'),
        labelText: z.string().optional().describe('Label or placeholder text to find the input'),
        text: z.string().describe('Text to type'),
        delayMs: z.number().optional().default(30).describe('Delay between keystrokes in ms'),
      }),
    ),
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
      title: 'Type text into a focused input',
    },
    readOnly: false,
    run: async (input) => {
      let el: HTMLInputElement | HTMLTextAreaElement | null = null
      if (input.selector) {
        el = document.querySelector(input.selector) as HTMLInputElement | HTMLTextAreaElement | null
      } else if (input.labelText) {
        const labels = document.querySelectorAll('label')
        for (const label of labels) {
          if (label.textContent?.toLowerCase().includes(input.labelText!.toLowerCase())) {
            const forId = label.getAttribute('for')
            if (forId) el = document.getElementById(forId) as HTMLInputElement | HTMLTextAreaElement
            else el = label.querySelector('input, textarea') as HTMLInputElement | HTMLTextAreaElement
            if (el) break
          }
        }
      }
      if (!el) {
        return { summary: `Input not found: ${input.selector ?? input.labelText}`, payload: { typed: false, error: 'Input not found' } }
      }
      el.focus()
      el.dispatchEvent(new Event('focus', { bubbles: true }))
      for (const char of input.text) {
        el.dispatchEvent(new KeyboardEvent('keydown', { key: char, bubbles: true }))
        el.dispatchEvent(new KeyboardEvent('keypress', { key: char, bubbles: true }))
        const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set
          ?? Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set
        nativeSetter?.call(el, el.value + char)
        el.dispatchEvent(new Event('input', { bubbles: true }))
        el.dispatchEvent(new KeyboardEvent('keyup', { key: char, bubbles: true }))
        if (input.delayMs && input.delayMs > 0) {
          await new Promise((r) => setTimeout(r, input.delayMs))
        }
      }
      el.dispatchEvent(new Event('change', { bubbles: true }))
      el.dispatchEvent(new Event('blur', { bubbles: true }))
      return { summary: `Typed "${input.text}" into ${input.selector ?? input.labelText}`, payload: { typed: true, length: input.text.length } }
    },
  },
  {
    name: 'select_dropdown',
    title: 'Select an option in a dropdown',
    description:
      'Select an option in a <select> dropdown by its value or visible text. Target by CSS selector or label text. Dispatches change event so React state updates.',
    inputSchema: toJsonSchema(
      z.object({
        selector: z.string().optional().describe('CSS selector of the <select> element'),
        labelText: z.string().optional().describe('Label text of the dropdown'),
        value: z.string().optional().describe('Value attribute of the option to select'),
        text: z.string().optional().describe('Visible text of the option to select'),
      }),
    ),
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
      title: 'Select an option in a dropdown',
    },
    readOnly: false,
    run: async (input) => {
      let el: HTMLSelectElement | null = null
      if (input.selector) {
        el = document.querySelector(input.selector) as HTMLSelectElement | null
      } else if (input.labelText) {
        const labels = document.querySelectorAll('label')
        for (const label of labels) {
          if (label.textContent?.toLowerCase().includes(input.labelText!.toLowerCase())) {
            const forId = label.getAttribute('for')
            if (forId) el = document.getElementById(forId) as unknown as HTMLSelectElement
            else             el = label.querySelector('select') as unknown as HTMLSelectElement
            if (el) break
          }
        }
      }
      if (!el || el.tagName !== 'SELECT') {
        return { summary: `Select not found: ${input.selector ?? input.labelText}`, payload: { selected: false, error: 'Select not found' } }
      }
      if (input.value) {
        el.value = input.value
      } else if (input.text) {
        for (const opt of Array.from(el.options)) {
          if (opt.text.toLowerCase().includes(input.text.toLowerCase())) {
            el.value = opt.value
            break
          }
        }
      }
      el.dispatchEvent(new Event('change', { bubbles: true }))
      return { summary: `Selected in ${input.selector ?? input.labelText}: ${input.value ?? input.text}`, payload: { selected: true } }
    },
  },
  {
    name: 'click_element',
    title: 'Click a button or link',
    description:
      'Click any button, link, or clickable element on the page. Target by CSS selector or by visible text content. Use to submit forms, trigger actions, open modals, or navigate.',
    inputSchema: toJsonSchema(
      z.object({
        selector: z.string().optional().describe('CSS selector of the element to click (e.g. "button[type=submit]", ".btn-primary")'),
        text: z.string().optional().describe('Visible text of the button/link to click (e.g. "Mark received", "Add Supplier")'),
      }),
    ),
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: false,
      title: 'Click a button or link',
    },
    readOnly: false,
    run: async (input) => {
      let el: HTMLElement | null = null
      if (input.selector) {
        el = document.querySelector(input.selector) as HTMLElement | null
      } else if (input.text) {
        const all = document.querySelectorAll('button, a, [role="button"], [role="link"]')
        for (const btn of all) {
          if (btn.textContent?.trim().toLowerCase().includes(input.text!.toLowerCase())) {
            el = btn as HTMLElement
            break
          }
        }
      }
      if (!el) {
        return { summary: `Element not found: ${input.selector ?? input.text}`, payload: { clicked: false, error: 'Element not found' } }
      }
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      await new Promise((r) => setTimeout(r, 200))
      el.click()
      return { summary: `Clicked ${input.selector ?? `"${input.text}"`}`, payload: { clicked: true } }
    },
  },
  {
    name: 'wait_for_element',
    title: 'Wait for an element to appear',
    description:
      'Poll the DOM until a specific element appears. Use after clicking a button or submitting a form to wait for the resulting UI change before taking the next action.',
    inputSchema: toJsonSchema(
      z.object({
        selector: z.string().optional().describe('CSS selector to wait for'),
        text: z.string().optional().describe('Text content to wait for in any element'),
        timeoutMs: z.number().optional().default(5000).describe('Max time to wait in ms'),
      }),
    ),
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
      title: 'Wait for an element to appear',
    },
    readOnly: true,
    run: async (input) => {
      const start = Date.now()
      const timeout = input.timeoutMs ?? 5000
      while (Date.now() - start < timeout) {
        if (input.selector && document.querySelector(input.selector)) {
          return { summary: `Element appeared: ${input.selector}`, payload: { found: true } }
        }
        if (input.text) {
          const all = document.querySelectorAll('h1, h2, h3, h4, p, span, td, th, div, button, a')
          for (const el of all) {
            if (el.textContent?.toLowerCase().includes(input.text.toLowerCase())) {
              return { summary: `Found text: "${input.text}"`, payload: { found: true } }
            }
          }
        }
        await new Promise((r) => setTimeout(r, 150))
      }
      return { summary: `Timeout waiting for: ${input.selector ?? input.text}`, payload: { found: false, error: 'Timeout' } }
    },
  },
  {
    name: 'get_page_state',
    title: 'Get current page state',
    description:
      'Return a snapshot of the current page: URL, title, visible headings, form fields with their current values, and clickable buttons. Use this to understand what is on screen before taking action.',
    inputSchema: toJsonSchema(z.object({})),
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
      title: 'Get current page state',
    },
    readOnly: true,
    run: async () => {
      const headings = Array.from(document.querySelectorAll('h1, h2, h3')).map((h) => ({
        tag: h.tagName,
        text: h.textContent?.trim() || '',
      }))
      const inputs = Array.from(document.querySelectorAll('input, textarea, select')).map((el) => ({
        tag: el.tagName,
        type: (el as HTMLInputElement).type || el.tagName.toLowerCase(),
        name: el.getAttribute('name') || '',
        placeholder: el.getAttribute('placeholder') || '',
        value: (el as HTMLInputElement | HTMLTextAreaElement).value || '',
        id: el.id || '',
      }))
      const buttons = Array.from(document.querySelectorAll('button, a[role="button"], [role="button"]')).map((b) => ({
        text: b.textContent?.trim() || '',
        disabled: (b as HTMLButtonElement).disabled,
        type: (b as HTMLButtonElement).type || 'button',
      }))
      return {
        summary: `Page: ${window.location.pathname} — ${headings.length} headings, ${inputs.length} inputs, ${buttons.length} buttons`,
        payload: {
          url: window.location.pathname,
          title: document.title,
          headings,
          inputs,
          buttons,
        },
      }
    },
  },
]

const COLLABORATE_TOOLS: ToolDef[] = [
  {
    name: 'get_pending_agent_actions',
    title: 'Get pending agent actions',
    description:
      'List agent-proposed actions (replenishment plans, reorder point changes, purchase orders) awaiting a human approve/reject decision, each with its reasoning and estimated cost.',
    inputSchema: toJsonSchema(listAgentActionsSchema),
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
      title: 'Get pending agent actions',
    },
    readOnly: true,
    run: async (input) => {
      const rows = await listAgentActionsFn({ data: input })
      return { summary: `${rows.length} action(s)`, payload: rows }
    },
  },
  {
    name: 'propose_replenishment',
    title: 'Propose a Smart Replenishment plan for approval',
    description:
      'Build the current Smart Replenishment plan and file one pending Agent Action per recommended supplier for human approval — it does NOT place any order itself. Use build_replenishment_plan first if you just want to see the numbers without filing anything.',
    inputSchema: toJsonSchema(proposeReplenishmentSchema),
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: false,
      title: 'Propose a Smart Replenishment plan for approval',
    },
    readOnly: false,
    run: async (input) => {
      const proposals = await createReplenishmentProposalsFn({ data: input })
      return { summary: `Filed ${proposals.length} replenishment proposal(s) for approval`, payload: proposals }
    },
  },
  {
    name: 'approve_agent_action',
    title: 'Approve a pending agent action',
    description:
      'Approve a pending agent-proposed action, which immediately executes it (e.g. creates the purchase order it describes). This is CONSEQUENTIAL — only call this after the shop owner has explicitly approved this specific action.',
    inputSchema: toJsonSchema(decideAgentActionSchema),
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: false,
      openWorldHint: false,
      title: 'Approve a pending agent action',
    },
    readOnly: false,
    run: async (input) => {
      const result = await decideAgentActionFn({ data: { actionId: input.actionId, decision: 'approved' } })
      return { summary: `Action ${input.actionId} ${result?.status}: ${result?.resultSummary ?? ''}`, payload: result }
    },
  },
  {
    name: 'reject_agent_action',
    title: 'Reject a pending agent action',
    description: 'Reject a pending agent-proposed action. Nothing is executed; the action is marked rejected for the audit trail.',
    inputSchema: toJsonSchema(decideAgentActionSchema),
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: false,
      openWorldHint: false,
      title: 'Reject a pending agent action',
    },
    readOnly: false,
    run: async (input) => {
      const result = await decideAgentActionFn({ data: { actionId: input.actionId, decision: 'rejected' } })
      return { summary: `Action ${input.actionId} rejected`, payload: result }
    },
  },
  {
    name: 'get_business_policies',
    title: 'Get business policies',
    description:
      'Get all configurable business policies: budget thresholds, safety stock percent, target coverage days, dead stock window, supplier concentration limits, and auto-approval thresholds. These policies govern how the agent makes replenishment and approval decisions.',
    inputSchema: toJsonSchema(whatShouldIWorryAboutSchema),
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
      title: 'Get business policies',
    },
    readOnly: true,
    run: async () => {
      const policies = await getBusinessPoliciesFn()
      return { summary: `${policies.length} policy(s) configured`, payload: policies }
    },
  },
  {
    name: 'update_business_policy',
    title: 'Update a business policy',
    description:
      'Update a single business policy value. This is CONSEQUENTIAL — it changes how the agent makes decisions. Only call this after the shop owner has explicitly approved the specific change. Example: set autoApproveThreshold to "75000" to auto-approve POs under $750.',
    inputSchema: toJsonSchema(updateBusinessPolicySchema),
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
      title: 'Update a business policy',
    },
    readOnly: false,
    run: async (input) => {
      const result = await updateBusinessPolicyFn({ data: input })
      return { summary: `Updated ${result.key} to ${result.value}`, payload: result }
    },
  },
]

const TOOLS: ToolDef[] = [...READ_TOOLS, ...ANALYZE_TOOLS, ...CREATE_TOOLS, ...MUTATE_TOOLS, ...NAVIGATE_TOOLS, ...COLLABORATE_TOOLS]

export interface ToolCatalogEntry {
  name: string
  title: string
  description: string
  readOnly: boolean
}

export const TOOL_CATALOG: Array<{ category: string; tools: ToolCatalogEntry[] }> = [
  { category: 'READ', tools: READ_TOOLS },
  { category: 'ANALYZE', tools: ANALYZE_TOOLS },
  { category: 'CREATE', tools: CREATE_TOOLS },
  { category: 'MUTATE', tools: MUTATE_TOOLS },
  { category: 'NAVIGATE', tools: NAVIGATE_TOOLS },
  { category: 'COLLABORATE', tools: COLLABORATE_TOOLS },
].map(({ category, tools }) => ({
  category,
  tools: tools.map(({ name, title, description, readOnly }) => ({ name, title, description, readOnly })),
}))

let registered = false

const DEMO_PROMPT = {
  name: 'protect_my_inventory',
  title: 'Protect My Inventory',
  description:
    'Run a complete morning protection check: assess inventory health, identify items at risk of stockout, build a prioritized replenishment plan within your budget, and file purchase orders for your approval. Covers 5 minutes of manual analysis in one command.',
  arguments: [
    { name: 'budget', description: 'Max purchasing budget in cents (e.g. 50000 for $500)', required: false },
  ],
}

export async function registerInventoryWebMCPTools(): Promise<() => void> {
  if (typeof document === 'undefined') return () => {}
  if (registered) return () => {}
  registered = true

  const controller = new AbortController()

  try {
    await import('@mcp-b/global')

    const modelContext = (document as any).modelContext ?? (navigator as any)?.modelContext
    if (!modelContext?.registerTool) {
      console.warn('[WebMCP] modelContext not available after polyfill')
      registered = false
      return () => {}
    }

    for (const tool of TOOLS) {
      await modelContext.registerTool(
        {
          name: tool.name,
          title: tool.title,
          description: tool.description,
          inputSchema: tool.inputSchema,
          outputSchema: (tool as any).outputSchema,
          annotations: tool.annotations,
          execute: async (input: any, opts?: { signal?: AbortSignal }) => {
            // Respect abort signal if provided by host
            if (opts?.signal?.aborted) throw new DOMException('Aborted', 'AbortError')
            const activityId = beginActivity(tool.name, tool.title, !tool.readOnly)
            try {
              const { summary, payload } = await tool.run(input ?? {})
              completeActivity(activityId, summary)
              void logAgentToolCallFn({
                data: { toolName: tool.name, input, summary, consequential: !tool.readOnly },
              }).catch(() => {})
              if ((tool as any).outputSchema) return toolSuccess(payload, payload)
              return toolSuccess(payload)
            } catch (error) {
              const mapped = mapError(error)
              failActivity(activityId, mapped.message)
              void logAgentToolCallFn({
                data: {
                  toolName: tool.name,
                  input,
                  summary: `Failed: ${mapped.code}: ${mapped.message}`,
                  consequential: !tool.readOnly,
                },
              }).catch(() => {})
              return toolError(mapped)
            }
          },
        },
        { signal: controller.signal },
      )
    }

    // Register demo prompt if supported
    if (modelContext.registerPrompt) {
      try {
        await modelContext.registerPrompt(
          {
            name: DEMO_PROMPT.name,
            title: DEMO_PROMPT.title,
            description: DEMO_PROMPT.description,
            arguments: DEMO_PROMPT.arguments,
          },
          { signal: controller.signal },
        )
      } catch {
        // Prompt registration not supported — graceful degradation
      }
    }
  } catch (err) {
    console.warn('[WebMCP] registration failed', err)
    controller.abort()
    registered = false
    return () => {}
  }

  return () => {
    controller.abort()
    registered = false // Allow re-registration (StrictMode re-mount, HMR)
  }
}

export const inventoryToolNames = TOOLS.map((t) => t.name)
