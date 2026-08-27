import {
  approvePurchaseOrderFn,
  analyzeStockRiskFn,
  createPurchaseOrderFn,
  findLowStockFn,
  getInventorySummaryFn,
  getProductDetailsFn,
  getPurchaseOrdersFn,
  getSalesVelocityFn,
  logAgentToolCallFn,
  receiveShipmentFn,
  recommendReorderFn,
  searchProductsFn,
  updateStockFn,
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

const TOOLS: ToolDef[] = [
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
        days: {
          type: 'number',
          description: 'Look-ahead window in days used to project stockouts. Defaults to 7.',
        },
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
      return {
        summary: `${product.name}: ${product.quantity} units in stock, ${product.riskLevel} risk`,
        payload: product,
      }
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
      return {
        summary: `${result.atRiskCount} product(s) at risk, ${accelerating} accelerating`,
        payload: result,
      }
    },
  },
  {
    name: 'get_purchase_orders',
    title: 'Get purchase orders',
    description: 'List purchase orders and their line items, optionally filtered by status (draft, approved, received).',
    inputSchema: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['draft', 'approved', 'received'] },
      },
    },
    readOnly: true,
    run: async (input) => {
      const orders = await getPurchaseOrdersFn({ data: input })
      return { summary: `${orders.length} purchase order(s)`, payload: orders }
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
        targetCoverageDaysOverride: { type: 'number', description: 'Override each product\'s target coverage window in days.' },
      },
    },
    readOnly: true,
    run: async (input) => {
      const recs = await recommendReorderFn({ data: input })
      const totalCents = recs.reduce((sum: number, r: any) => sum + r.estimatedCostCents, 0)
      return {
        summary: `Recommended reordering ${recs.length} product(s), est. ${money(totalCents)}`,
        payload: recs,
      }
    },
  },
  {
    name: 'create_purchase_order',
    title: 'Create draft purchase order',
    description:
      'Create a DRAFT purchase order for a supplier with specific product quantities. All products must be supplied by the given supplier. This does not commit any spend or notify the supplier — it only creates a draft for a human to review. Call approve_purchase_order separately once the owner has explicitly approved it.',
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
  {
    name: 'approve_purchase_order',
    title: 'Approve purchase order',
    description:
      'Approve a draft purchase order, committing to place it with the supplier. This is a CONSEQUENTIAL action with real cost — only call this after the shop owner has explicitly approved the specific order in the conversation.',
    inputSchema: {
      type: 'object',
      properties: { purchaseOrderId: { type: 'number' } },
      required: ['purchaseOrderId'],
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
    inputSchema: {
      type: 'object',
      properties: { purchaseOrderId: { type: 'number' } },
      required: ['purchaseOrderId'],
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
      'Directly adjust a product\'s stock count for manual corrections or transfers (not for recording ordinary sales, and not for receiving a purchase order — use receive_shipment for that). This is CONSEQUENTIAL — it changes the real, live stock count. Confirm the reason and quantity with the shop owner before calling it.',
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
]

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
