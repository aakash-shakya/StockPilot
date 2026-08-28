-- Business policies table for configurable thresholds
CREATE TABLE IF NOT EXISTS "business_policies" (
  "id" serial PRIMARY KEY,
  "key" text NOT NULL UNIQUE,
  "value" text NOT NULL,
  "description" text,
  "updated_at" timestamp DEFAULT now()
);

-- Default business policies
INSERT INTO "business_policies" ("key", "value", "description") VALUES
('maxPoWithoutApproval', '100000', 'Max PO value in cents without requiring approval'),
('minMarginPercent', '18', 'Minimum acceptable margin percent'),
('emergencyStockDays', '7', 'Days of emergency stock to maintain'),
('targetCoverageDays', '30', 'Target inventory coverage in days'),
('safetyStockPercent', '15', 'Safety stock as percent of average demand'),
('autoApproveThreshold', '50000', 'Auto-approve POs below this value in cents'),
('maxSupplierConcentration', '40', 'Max percent of value from a single supplier'),
('deadStockDays', '60', 'Days with no sales to classify as dead stock');

-- Demo anomalies for a compelling hackathon demo:
-- 1. A product with suspicious large adjustment (no note)
-- 2. A product with zero movement (true dead stock) — Wireless Mouse (product 4) already has low stock
-- 3. A pending PO that's been waiting 14+ days (overdue)
-- 4. A supplier with poor on-time record

-- Suspicious adjustment on Safety Goggles (product 42) — large unexplained count change
INSERT INTO "inventory_movements" ("product_id", "type", "quantity_delta", "note", "actor", "created_at") VALUES
(42, 'adjustment', -15, NULL, 'human', NOW() - INTERVAL '3 days');

-- Overdue PO: approved 18 days ago, still not received
INSERT INTO "purchase_orders" ("po_number", "supplier_id", "status", "notes", "created_by", "created_at", "approved_at", "received_at") VALUES
('PO-1057', 3, 'approved', 'Urgent restock for headphones and speakers', 'agent', NOW() - INTERVAL '20 days', NOW() - INTERVAL '18 days', NULL);

INSERT INTO "purchase_order_items" ("purchase_order_id", "product_id", "quantity", "unit_cost_cents") VALUES
(currval('purchase_orders_id_seq'), 9, 15, 6800),
(currval('purchase_orders_id_seq'), 8, 20, 3400);

-- Advance serial sequences
SELECT setval('business_policies_id_seq', (SELECT MAX("id") FROM "business_policies"));
SELECT setval('purchase_orders_id_seq', (SELECT MAX("id") FROM "purchase_orders"));
