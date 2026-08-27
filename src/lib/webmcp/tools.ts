import {
  approvePurchaseOrderFn,
  analyzeStockRiskFn,
  buildReplenishmentPlanFn,
  compareSuppliersFn,
  createProductFromDraftFn,
  createPurchaseOrderFn,
  createReplenishmentProposalsFn,
  decideAgentActionFn,
  draftProductFn,
  findDeadStockFn,
  findLowStockFn,
  generateReportFn,
  generateSkuFn,
  getInventoryHealthCheckFn,
  getInventoryMovementsFn,
  getInventorySummaryFn,
  getProductDetailsFn,
  getPurchaseOrdersFn,
  getSalesVelocityFn,
  getSupplierIntelligenceFn,
  getSuppliersFn,
  listAgentActionsFn,
  logAgentToolCallFn,
  queryInventoryFn,
  receiveShipmentFn,
  recommendReorderFn,
  revertMovementFn,
  searchProductsFn,
  simulateInventoryFn,
  updateStockFn,
  whatShouldIWorryAboutFn,
} from '../../server/inventory.functions.js'
import { beginActivity, completeActivity, failActivity } from '../agent-activity-store.js'

interface ToolContent {
  content: Array<{ type: 'text'; text: string }>
}

interface ToolDef {
  name: string
  title: string
  description: string
  inputSchema: Record<string, unknown>
  readOnly: boolean
  run: (input: any) => Promise<{ summary: string; payload: unknown }>
}

function toolResult(payload: unknown): ToolContent {
  return { content: [{ type: 'text', text: JSON.stringify(payload) }] }
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
      'Search the product catalog by name or SKU, optionally filtered by category. Use this to find a specific product before inspecting or acting on it.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Free-text match against product name or SKU' },
        category: { type: 'string', description: 'Exact category name to filter by, e.g. "Electronics"' },
      },
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
    inputSchema: { type: 'object', properties: {} },
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
      'Find products that are at or below their reorder threshold, or projected to run out within a given number of days based on recent sales velocity. This is the starting point for any "what will run out" investigation.',
    inputSchema: {
      type: 'object',
      properties: {
        days: { type: 'number', description: 'Look-ahead window in days used to project stockouts. Defaults to 7.' },
        category: { type: 'string', description: 'Restrict the search to one category' },
      },
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
    inputSchema: {
      type: 'object',
      properties: { productId: { type: 'number', description: 'Product id' } },
      required: ['productId'],
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
    inputSchema: {
      type: 'object',
      properties: {
        productId: { type: 'number' },
        days: { type: 'number', description: 'Trailing window in days. Defaults to 14.' },
      },
      required: ['productId'],
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
    inputSchema: {
      type: 'object',
      properties: { status: { type: 'string', enum: ['draft', 'approved', 'received'] } },
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
    inputSchema: {
      type: 'object',
      properties: {
        productId: { type: 'number' },
        type: { type: 'string', enum: ['sale', 'restock', 'adjustment', 'transfer_in', 'transfer_out', 'receiving'] },
        limit: { type: 'number', description: 'Max rows to return. Defaults to 50.' },
      },
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
    inputSchema: { type: 'object', properties: {} },
    readOnly: true,
    run: async () => {
      const rows = await getSuppliersFn()
      return { summary: `${rows.length} supplier(s)`, payload: rows }
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
      'Run a fuller risk analysis than find_low_stock: for each product, compares recent (7-day) vs. baseline (prior 23-day) sales velocity to flag whether depletion is accelerating, steady, or declining, and factors in supplier lead time and any known shipment delays. Use this to explain WHY a product is at risk, not just that it is.',
    inputSchema: {
      type: 'object',
      properties: {
        days: { type: 'number', description: 'Look-ahead window in days. Defaults to 7.' },
        category: { type: 'string' },
        productId: { type: 'number', description: 'Limit analysis to a single product' },
      },
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
      'Compute suggested reorder quantities and estimated cost for a set of products (or, if none given, every currently at-risk product) — enough stock to cover the target coverage window plus the supplier lead time and any known delay. This does NOT place an order; it only recommends one.',
    inputSchema: {
      type: 'object',
      properties: {
        productIds: { type: 'array', items: { type: 'number' }, description: 'Products to recommend for. Omit to use every at-risk product.' },
        targetCoverageDaysOverride: { type: 'number', description: "Override each product's target coverage window in days." },
      },
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
    inputSchema: { type: 'object', properties: {} },
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
    inputSchema: {
      type: 'object',
      properties: { productId: { type: 'number' } },
      required: ['productId'],
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
    inputSchema: {
      type: 'object',
      properties: {
        minDaysStale: { type: 'number', description: 'Zero-sales window in days. Defaults to 60.' },
        category: { type: 'string' },
      },
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
      'Run a full sweep across low stock, stockouts, dead stock, abnormal sales changes, supplier delays, overdue purchase orders, high-value risk concentration, and single-supplier concentration risk. Returns every issue found, each with a severity and a recommended next action.',
    inputSchema: { type: 'object', properties: {} },
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
      'Get a single prioritized operational briefing: pending agent approvals first, then the highest-severity inventory health issues. This is the recommended first call when starting a session.',
    inputSchema: { type: 'object', properties: {} },
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
    inputSchema: {
      type: 'object',
      properties: {
        productId: { type: 'number' },
        horizonDays: { type: 'number', description: 'Days to project forward. Defaults to 30.' },
      },
      required: ['productId'],
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
    inputSchema: {
      type: 'object',
      properties: {
        productId: { type: 'number' },
        demandChangePct: { type: 'number', description: 'e.g. 25 for +25% demand, -30 for -30% demand' },
        leadTimeChangeDays: { type: 'number', description: 'e.g. 5 for 5 extra days of lead time' },
        horizonDays: { type: 'number' },
      },
      required: ['productId'],
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
      'Convert a natural-language inventory question (e.g. "what electronics are running out in the next 5 days") into structured filters and return matching products. Parsing is deterministic and rule-based; the parsed filters are always returned alongside the results so the interpretation is visible.',
    inputSchema: {
      type: 'object',
      properties: { query: { type: 'string' } },
      required: ['query'],
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
      'Generate a structured report from a natural-language request. Supports monthly inventory summaries, declining-sales reports, supplier-performance reports, and cash-tied-up-in-inventory reports — each with KPIs, a data table, findings, and recommendations. Report interpretation is deterministic and rule-based, returned as part of the result.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'e.g. "monthly inventory report" or "which suppliers are underperforming"' },
        category: { type: 'string' },
      },
      required: ['query'],
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
      'Compose the full replenishment workflow read-only: finds every at-risk product, computes a suggested reorder quantity for each, compares suppliers per product, and groups everything into one draft purchase order per recommended supplier with cost subtotals. This does NOT create anything — call propose_replenishment to turn this into pending approvals, or create_purchase_order per group once a human approves.',
    inputSchema: {
      type: 'object',
      properties: {
        category: { type: 'string' },
        days: { type: 'number', description: 'Look-ahead window in days. Defaults to 10.' },
      },
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
]

// ---------------------------------------------------------------------------
// CREATE — draft new catalog entries or orders; no live inventory/spend change
// ---------------------------------------------------------------------------

const CREATE_TOOLS: ToolDef[] = [
  {
    name: 'generate_sku',
    title: 'Generate a SKU',
    description:
      'Deterministically generate a unique CATEGORY-BRAND-MODEL[-VARIANT] SKU (not an LLM guess) from product attributes, checked against existing SKUs for collisions. Use this before generate_product if you only need the code itself.',
    inputSchema: {
      type: 'object',
      properties: {
        category: { type: 'string' },
        brand: { type: 'string' },
        model: { type: 'string' },
        variant: { type: 'string' },
      },
      required: ['category', 'brand', 'model'],
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
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        category: { type: 'string' },
        brand: { type: 'string' },
        model: { type: 'string' },
        variant: { type: 'string' },
        supplierId: { type: 'number' },
        costCents: { type: 'number' },
        priceCents: { type: 'number' },
        initialQuantity: { type: 'number' },
        reorderThreshold: { type: 'number' },
        targetCoverageDays: { type: 'number' },
      },
      required: ['name', 'category', 'brand', 'model', 'supplierId', 'costCents', 'priceCents'],
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
    inputSchema: {
      type: 'object',
      properties: {
        sku: { type: 'string' },
        name: { type: 'string' },
        category: { type: 'string' },
        supplierId: { type: 'number' },
        costCents: { type: 'number' },
        priceCents: { type: 'number' },
        quantity: { type: 'number' },
        reorderThreshold: { type: 'number' },
        targetCoverageDays: { type: 'number' },
      },
      required: ['sku', 'name', 'category', 'supplierId', 'costCents', 'priceCents'],
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
    inputSchema: {
      type: 'object',
      properties: {
        supplierId: { type: 'number' },
        items: {
          type: 'array',
          items: {
            type: 'object',
            properties: { productId: { type: 'number' }, quantity: { type: 'number' } },
            required: ['productId', 'quantity'],
          },
        },
        notes: { type: 'string' },
      },
      required: ['supplierId', 'items'],
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
    inputSchema: { type: 'object', properties: { purchaseOrderId: { type: 'number' } }, required: ['purchaseOrderId'] },
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
    inputSchema: { type: 'object', properties: { purchaseOrderId: { type: 'number' } }, required: ['purchaseOrderId'] },
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
    inputSchema: {
      type: 'object',
      properties: {
        productId: { type: 'number' },
        quantityDelta: { type: 'number', description: 'Signed change in units, e.g. -3 or 10' },
        type: { type: 'string', enum: ['adjustment', 'transfer_in', 'transfer_out', 'restock'] },
        note: { type: 'string' },
      },
      required: ['productId', 'quantityDelta', 'type'],
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
    inputSchema: { type: 'object', properties: { movementId: { type: 'number' } }, required: ['movementId'] },
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

const COLLABORATE_TOOLS: ToolDef[] = [
  {
    name: 'get_pending_agent_actions',
    title: 'Get pending agent actions',
    description:
      'List agent-proposed actions (replenishment plans, reorder point changes, purchase orders) awaiting a human approve/reject decision, each with its reasoning and estimated cost.',
    inputSchema: {
      type: 'object',
      properties: { status: { type: 'string', enum: ['pending', 'approved', 'rejected', 'executed', 'failed'] } },
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
    inputSchema: {
      type: 'object',
      properties: { category: { type: 'string' }, days: { type: 'number' } },
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
    inputSchema: { type: 'object', properties: { actionId: { type: 'number' } }, required: ['actionId'] },
    readOnly: false,
    run: async (input) => {
      const result = await decideAgentActionFn({ data: { actionId: input.actionId, decision: 'approved', decidedBy: 'human' } })
      return { summary: `Action ${input.actionId} ${result?.status}: ${result?.resultSummary ?? ''}`, payload: result }
    },
  },
  {
    name: 'reject_agent_action',
    title: 'Reject a pending agent action',
    description: 'Reject a pending agent-proposed action. Nothing is executed; the action is marked rejected for the audit trail.',
    inputSchema: { type: 'object', properties: { actionId: { type: 'number' } }, required: ['actionId'] },
    readOnly: false,
    run: async (input) => {
      const result = await decideAgentActionFn({ data: { actionId: input.actionId, decision: 'rejected', decidedBy: 'human' } })
      return { summary: `Action ${input.actionId} rejected`, payload: result }
    },
  },
]

const TOOLS: ToolDef[] = [...READ_TOOLS, ...ANALYZE_TOOLS, ...CREATE_TOOLS, ...MUTATE_TOOLS, ...COLLABORATE_TOOLS]

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
  { category: 'COLLABORATE', tools: COLLABORATE_TOOLS },
].map(({ category, tools }) => ({
  category,
  tools: tools.map(({ name, title, description, readOnly }) => ({ name, title, description, readOnly })),
}))

let registered = false

export async function registerInventoryWebMCPTools(): Promise<() => void> {
  if (typeof document === 'undefined') return () => {}
  if (registered) return () => {}
  registered = true

  await import('@mcp-b/global')
  const controller = new AbortController()

  const modelContext = document.modelContext as any

  for (const tool of TOOLS) {
    await modelContext.registerTool(
      {
        name: tool.name,
        title: tool.title,
        description: tool.description,
        inputSchema: tool.inputSchema,
        annotations: { readOnlyHint: tool.readOnly },
        execute: async (input: any) => {
          const activityId = beginActivity(tool.name, tool.title, !tool.readOnly)
          try {
            const { summary, payload } = await tool.run(input ?? {})
            completeActivity(activityId, summary)
            void logAgentToolCallFn({
              data: { toolName: tool.name, input, summary, consequential: !tool.readOnly },
            })
            return toolResult(payload)
          } catch (error) {
            const message = error instanceof Error ? error.message : 'Tool call failed'
            failActivity(activityId, message)
            void logAgentToolCallFn({
              data: { toolName: tool.name, input, summary: `Failed: ${message}`, consequential: !tool.readOnly },
            })
            return toolResult({ error: message })
          }
        },
      },
      { signal: controller.signal },
    )
  }

  return () => {
    controller.abort()
    registered = false
  }
}

export const inventoryToolNames = TOOLS.map((t) => t.name)
