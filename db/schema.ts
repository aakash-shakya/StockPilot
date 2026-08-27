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
