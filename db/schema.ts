import { sqliteTable, integer, text } from 'drizzle-orm/sqlite-core'
import { sql } from 'drizzle-orm'

export const suppliers = sqliteTable('suppliers', {
  id: integer().primaryKey({ autoIncrement: true }),
  name: text().notNull(),
  contactEmail: text('contact_email').notNull(),
  leadTimeDays: integer('lead_time_days').notNull().default(7),
  delayDays: integer('delay_days').notNull().default(0),
  delayNote: text('delay_note'),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(
    sql`(strftime('%s','now'))`,
  ),
})

export const products = sqliteTable('products', {
  id: integer().primaryKey({ autoIncrement: true }),
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
  createdAt: integer('created_at', { mode: 'timestamp' }).default(
    sql`(strftime('%s','now'))`,
  ),
})

export const inventoryMovements = sqliteTable('inventory_movements', {
  id: integer().primaryKey({ autoIncrement: true }),
  productId: integer('product_id')
    .notNull()
    .references(() => products.id),
  type: text().notNull(), // 'sale' | 'restock' | 'adjustment' | 'transfer_in' | 'transfer_out' | 'receiving'
  quantityDelta: integer('quantity_delta').notNull(),
  note: text(),
  actor: text().notNull().default('human'), // 'human' | 'agent'
  createdAt: integer('created_at', { mode: 'timestamp' }).default(
    sql`(strftime('%s','now'))`,
  ),
})

export const purchaseOrders = sqliteTable('purchase_orders', {
  id: integer().primaryKey({ autoIncrement: true }),
  poNumber: text('po_number').notNull().unique(),
  supplierId: integer('supplier_id')
    .notNull()
    .references(() => suppliers.id),
  status: text().notNull().default('draft'), // 'draft' | 'approved' | 'ordered' | 'received'
  notes: text(),
  createdBy: text('created_by').notNull().default('human'), // 'human' | 'agent'
  createdAt: integer('created_at', { mode: 'timestamp' }).default(
    sql`(strftime('%s','now'))`,
  ),
  approvedAt: integer('approved_at', { mode: 'timestamp' }),
  receivedAt: integer('received_at', { mode: 'timestamp' }),
})

export const purchaseOrderItems = sqliteTable('purchase_order_items', {
  id: integer().primaryKey({ autoIncrement: true }),
  purchaseOrderId: integer('purchase_order_id')
    .notNull()
    .references(() => purchaseOrders.id),
  productId: integer('product_id')
    .notNull()
    .references(() => products.id),
  quantity: integer().notNull(),
  unitCostCents: integer('unit_cost_cents').notNull(),
})

export const agentToolCalls = sqliteTable('agent_tool_calls', {
  id: integer().primaryKey({ autoIncrement: true }),
  toolName: text('tool_name').notNull(),
  input: text(),
  summary: text().notNull(),
  consequential: integer({ mode: 'boolean' }).notNull().default(false),
  userId: integer('user_id'),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(
    sql`(strftime('%s','now'))`,
  ),
})

// Alternate supplier options for a product, used for supplier comparison /
// procurement optimization. The primary option always mirrors products.supplierId
// and products.costCents so a product always has at least one row here.
export const productSuppliers = sqliteTable('product_suppliers', {
  id: integer().primaryKey({ autoIncrement: true }),
  productId: integer('product_id')
    .notNull()
    .references(() => products.id),
  supplierId: integer('supplier_id')
    .notNull()
    .references(() => suppliers.id),
  unitCostCents: integer('unit_cost_cents').notNull(),
  leadTimeDays: integer('lead_time_days').notNull(),
  isPrimary: integer('is_primary', { mode: 'boolean' }).notNull().default(false),
})

export const users = sqliteTable('users', {
  id: integer().primaryKey({ autoIncrement: true }),
  email: text().notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  name: text().notNull(),
  role: text().notNull().default('admin'),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(
    sql`(strftime('%s','now'))`,
  ),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).default(
    sql`(strftime('%s','now'))`,
  ),
})

export const sessions = sqliteTable('sessions', {
  id: integer().primaryKey({ autoIncrement: true }),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  token: text().notNull().unique(),
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(
    sql`(strftime('%s','now'))`,
  ),
})

// Proposals raised by the agent (or a human workflow) that require an explicit
// approve/reject decision before anything consequential happens. Distinct from
// agentToolCalls, which is a raw call log — this is the human-in-the-loop queue.
export const agentActions = sqliteTable('agent_actions', {
  id: integer().primaryKey({ autoIncrement: true }),
  type: text().notNull(), // 'replenishment' | 'reorder_point_change' | 'purchase_order'
  title: text().notNull(),
  reasoning: text().notNull(),
  impact: text().notNull().default('low'), // 'low' | 'medium' | 'high'
  status: text().notNull().default('pending'), // 'pending' | 'approved' | 'rejected' | 'executed' | 'failed'
  payload: text().notNull(), // JSON-encoded action-specific data needed to execute it
  relatedProductIds: text('related_product_ids'), // JSON array of product ids, for display
  estimatedCostCents: integer('estimated_cost_cents'),
  proposedBy: text('proposed_by').notNull().default('agent'), // 'human' | 'agent'
  createdAt: integer('created_at', { mode: 'timestamp' }).default(
    sql`(strftime('%s','now'))`,
  ),
  decidedAt: integer('decided_at', { mode: 'timestamp' }),
  decidedBy: text('decided_by'), // 'human' | 'agent'
  executedAt: integer('executed_at', { mode: 'timestamp' }),
  resultSummary: text('result_summary'),
})

// Configurable business policies — key-value store for thresholds and rules
export const businessPolicies = sqliteTable('business_policies', {
  id: integer().primaryKey({ autoIncrement: true }),
  key: text().notNull().unique(),
  value: text().notNull(), // JSON-encoded value
  description: text(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).default(
    sql`(strftime('%s','now'))`,
  ),
})
