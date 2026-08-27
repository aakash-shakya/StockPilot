import {
  pgTable,
  serial,
  text,
  integer,
  timestamp,
  boolean,
} from 'drizzle-orm/pg-core'

export const suppliers = pgTable('suppliers', {
  id: serial().primaryKey(),
  name: text().notNull(),
  contactEmail: text('contact_email').notNull(),
  leadTimeDays: integer('lead_time_days').notNull().default(7),
  delayDays: integer('delay_days').notNull().default(0),
  delayNote: text('delay_note'),
  createdAt: timestamp('created_at').defaultNow(),
})

export const products = pgTable('products', {
  id: serial().primaryKey(),
  sku: text().notNull().unique(),
  name: text().notNull(),
  category: text().notNull(),
  supplierId: integer('supplier_id')
    .notNull()
    .references(() => suppliers.id),
  costCents: integer('cost_cents').notNull(),
  priceCents: integer('price_cents').notNull(),
  quantity: integer().notNull().default(0),
  reorderThreshold: integer('reorder_threshold').notNull().default(5),
  targetCoverageDays: integer('target_coverage_days').notNull().default(30),
  createdAt: timestamp('created_at').defaultNow(),
})

export const inventoryMovements = pgTable('inventory_movements', {
  id: serial().primaryKey(),
  productId: integer('product_id')
    .notNull()
    .references(() => products.id),
  type: text().notNull(), // 'sale' | 'restock' | 'adjustment' | 'transfer_in' | 'transfer_out' | 'receiving'
  quantityDelta: integer('quantity_delta').notNull(),
  note: text(),
  actor: text().notNull().default('human'), // 'human' | 'agent'
  createdAt: timestamp('created_at').defaultNow(),
})

export const purchaseOrders = pgTable('purchase_orders', {
  id: serial().primaryKey(),
  poNumber: text('po_number').notNull().unique(),
  supplierId: integer('supplier_id')
    .notNull()
    .references(() => suppliers.id),
  status: text().notNull().default('draft'), // 'draft' | 'approved' | 'ordered' | 'received'
  notes: text(),
  createdBy: text('created_by').notNull().default('human'), // 'human' | 'agent'
  createdAt: timestamp('created_at').defaultNow(),
  approvedAt: timestamp('approved_at'),
  receivedAt: timestamp('received_at'),
})

export const purchaseOrderItems = pgTable('purchase_order_items', {
  id: serial().primaryKey(),
  purchaseOrderId: integer('purchase_order_id')
    .notNull()
    .references(() => purchaseOrders.id),
  productId: integer('product_id')
    .notNull()
    .references(() => products.id),
  quantity: integer().notNull(),
  unitCostCents: integer('unit_cost_cents').notNull(),
})

export const agentToolCalls = pgTable('agent_tool_calls', {
  id: serial().primaryKey(),
  toolName: text('tool_name').notNull(),
  input: text(),
  summary: text().notNull(),
  consequential: boolean().notNull().default(false),
  createdAt: timestamp('created_at').defaultNow(),
})

// Alternate supplier options for a product, used for supplier comparison /
// procurement optimization. The primary option always mirrors products.supplierId
// and products.costCents so a product always has at least one row here.
export const productSuppliers = pgTable('product_suppliers', {
  id: serial().primaryKey(),
  productId: integer('product_id')
    .notNull()
    .references(() => products.id),
  supplierId: integer('supplier_id')
    .notNull()
    .references(() => suppliers.id),
  unitCostCents: integer('unit_cost_cents').notNull(),
  leadTimeDays: integer('lead_time_days').notNull(),
  isPrimary: boolean('is_primary').notNull().default(false),
})

// Proposals raised by the agent (or a human workflow) that require an explicit
// approve/reject decision before anything consequential happens. Distinct from
// agentToolCalls, which is a raw call log — this is the human-in-the-loop queue.
export const agentActions = pgTable('agent_actions', {
  id: serial().primaryKey(),
  type: text().notNull(), // 'replenishment' | 'reorder_point_change' | 'purchase_order'
  title: text().notNull(),
  reasoning: text().notNull(),
  impact: text().notNull().default('low'), // 'low' | 'medium' | 'high'
  status: text().notNull().default('pending'), // 'pending' | 'approved' | 'rejected' | 'executed' | 'failed'
  payload: text().notNull(), // JSON-encoded action-specific data needed to execute it
  relatedProductIds: text('related_product_ids'), // JSON array of product ids, for display
  estimatedCostCents: integer('estimated_cost_cents'),
  proposedBy: text('proposed_by').notNull().default('agent'), // 'human' | 'agent'
  createdAt: timestamp('created_at').defaultNow(),
  decidedAt: timestamp('decided_at'),
  decidedBy: text('decided_by'), // 'human' | 'agent'
  executedAt: timestamp('executed_at'),
  resultSummary: text('result_summary'),
})
