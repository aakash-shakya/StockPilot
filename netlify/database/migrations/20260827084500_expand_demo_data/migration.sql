-- Expand demo data to power supplier intelligence, dead-stock detection, and
-- supplier comparison: two more suppliers, ten more products across two new
-- categories, alternate supplier options for six flagship products, and a
-- receiving history per supplier so on-time / delay stats are real, computed
-- numbers rather than static labels.

INSERT INTO "suppliers" ("id", "name", "contact_email", "lead_time_days", "delay_days", "delay_note") VALUES

(4, 'Global Devices', 'sales@globaldevices.example', 3, 0, NULL),
(5, 'Pacific Import Co', 'orders@pacificimport.example', 14, 2, 'Ocean freight backlog adding ~2 days');

INSERT INTO "products" ("id", "sku", "name", "category", "supplier_id", "cost_cents", "price_cents", "quantity", "reorder_threshold", "target_coverage_days") VALUES

(41, 'SKU-0041-DRIL', 'Cordless Drill', 'Tools', 3, 4500, 8900, 3, 8, 30),
(42, 'SKU-0042-GOGG', 'Safety Goggles (Pack of 12)', 'Tools', 2, 600, 1400, 45, 10, 30),
(43, 'SKU-0043-GLOV', 'Work Gloves', 'Tools', 2, 350, 900, 5, 12, 30),
(44, 'SKU-0044-EXTC', 'Extension Cord 25ft', 'Tools', 3, 900, 2100, 22, 8, 30),
(45, 'SKU-0045-VACF', 'Shop Vacuum Filter', 'Tools', 3, 700, 1600, 30, 6, 30),
(46, 'SKU-0046-PACK', 'Packing Tape (6-pack)', 'Shipping', 2, 500, 1200, 60, 20, 30),
(47, 'SKU-0047-BUBW', 'Bubble Wrap Roll', 'Shipping', 2, 800, 1900, 4, 10, 30),
(48, 'SKU-0048-SHLB', 'Shipping Labels (Roll of 500)', 'Shipping', 2, 300, 750, 38, 12, 30),
(49, 'SKU-0049-MBOX', 'Moving Boxes (Pack of 10)', 'Shipping', 3, 1200, 2800, 6, 10, 30),
(50, 'SKU-0050-PALW', 'Pallet Wrap', 'Shipping', 3, 950, 2200, 26, 8, 30);

-- Sales history for the new products that need real velocity (the rest are
-- intentionally left with zero movements — realistic dead-stock candidates).

INSERT INTO "inventory_movements" ("product_id", "type", "quantity_delta", "note", "actor", "created_at") VALUES

-- Cordless Drill: accelerating demand, about to stock out
(41, 'sale', -1, NULL, 'human', NOW() - INTERVAL '20 days'),
(41, 'sale', -1, NULL, 'human', NOW() - INTERVAL '18 days'),
(41, 'sale', -1, NULL, 'human', NOW() - INTERVAL '15 days'),
(41, 'sale', -1, NULL, 'human', NOW() - INTERVAL '10 days'),
(41, 'sale', -1, NULL, 'human', NOW() - INTERVAL '9 days'),
(41, 'sale', -1, NULL, 'human', NOW() - INTERVAL '6 days'),
(41, 'sale', -1, NULL, 'human', NOW() - INTERVAL '5 days'),
(41, 'sale', -1, NULL, 'human', NOW() - INTERVAL '4 days'),
(41, 'sale', -1, NULL, 'human', NOW() - INTERVAL '3 days'),
(41, 'sale', -1, NULL, 'human', NOW() - INTERVAL '2 days'),
(41, 'sale', -1, NULL, 'human', NOW() - INTERVAL '1 days'),

-- Extension Cord: steady, healthy mover
(44, 'sale', -1, NULL, 'human', NOW() - INTERVAL '28 days'),
(44, 'sale', -1, NULL, 'human', NOW() - INTERVAL '25 days'),
(44, 'sale', -1, NULL, 'human', NOW() - INTERVAL '22 days'),
(44, 'sale', -1, NULL, 'human', NOW() - INTERVAL '19 days'),
(44, 'sale', -1, NULL, 'human', NOW() - INTERVAL '16 days'),
(44, 'sale', -1, NULL, 'human', NOW() - INTERVAL '13 days'),
(44, 'sale', -1, NULL, 'human', NOW() - INTERVAL '10 days'),
(44, 'sale', -1, NULL, 'human', NOW() - INTERVAL '7 days'),
(44, 'sale', -1, NULL, 'human', NOW() - INTERVAL '5 days'),
(44, 'sale', -1, NULL, 'human', NOW() - INTERVAL '3 days'),
(44, 'sale', -1, NULL, 'human', NOW() - INTERVAL '1 days'),

-- Packing Tape: sales climbing fast (accelerating trend showcase)
(46, 'sale', -1, NULL, 'human', NOW() - INTERVAL '22 days'),
(46, 'sale', -2, NULL, 'human', NOW() - INTERVAL '19 days'),
(46, 'sale', -1, NULL, 'human', NOW() - INTERVAL '16 days'),
(46, 'sale', -2, NULL, 'human', NOW() - INTERVAL '13 days'),
(46, 'sale', -2, NULL, 'human', NOW() - INTERVAL '11 days'),
(46, 'sale', -2, NULL, 'human', NOW() - INTERVAL '9 days'),
(46, 'sale', -3, NULL, 'human', NOW() - INTERVAL '7 days'),
(46, 'sale', -4, NULL, 'human', NOW() - INTERVAL '6 days'),
(46, 'sale', -3, NULL, 'human', NOW() - INTERVAL '5 days'),
(46, 'sale', -5, NULL, 'human', NOW() - INTERVAL '4 days'),
(46, 'sale', -4, NULL, 'human', NOW() - INTERVAL '3 days'),
(46, 'sale', -3, NULL, 'human', NOW() - INTERVAL '2 days'),
(46, 'sale', -4, NULL, 'human', NOW() - INTERVAL '1 days'),

-- Bubble Wrap Roll: about to stock out, no baseline history (brand new demand)
(47, 'sale', -1, NULL, 'human', NOW() - INTERVAL '6 days'),
(47, 'sale', -1, NULL, 'human', NOW() - INTERVAL '5 days'),
(47, 'sale', -1, NULL, 'human', NOW() - INTERVAL '4 days'),
(47, 'sale', -1, NULL, 'human', NOW() - INTERVAL '3 days'),
(47, 'sale', -1, NULL, 'human', NOW() - INTERVAL '2 days'),
(47, 'sale', -1, NULL, 'human', NOW() - INTERVAL '1 days'),

-- Moving Boxes: sparse, ambiguous mover — low stock but unclear velocity
(49, 'sale', -1, NULL, 'human', NOW() - INTERVAL '25 days'),
(49, 'sale', -1, NULL, 'human', NOW() - INTERVAL '18 days'),
(49, 'sale', -1, NULL, 'human', NOW() - INTERVAL '9 days'),
(49, 'sale', -1, NULL, 'human', NOW() - INTERVAL '2 days');

-- Primary supplier-cost rows for every existing product (mirrors products.supplier_id)
INSERT INTO "product_suppliers" ("product_id", "supplier_id", "unit_cost_cents", "lead_time_days", "is_primary")
SELECT p."id", p."supplier_id", p."cost_cents", s."lead_time_days", true
FROM "products" p JOIN "suppliers" s ON s."id" = p."supplier_id";

-- Alternate sourcing options for flagship products, so supplier comparison has
-- something real to compare (different price / lead-time trade-offs).
INSERT INTO "product_suppliers" ("product_id", "supplier_id", "unit_cost_cents", "lead_time_days", "is_primary") VALUES

(1, 4, 3400, 3, false),   -- Mechanical Keyboard via Global Devices: pricier, faster
(1, 5, 2900, 14, false),  -- Mechanical Keyboard via Pacific Import: cheaper, slower
(2, 4, 25500, 4, false),  -- 27" Monitor via Global Devices
(2, 5, 21000, 16, false), -- 27" Monitor via Pacific Import
(4, 4, 950, 3, false),    -- Wireless Mouse via Global Devices
(9, 4, 7100, 4, false),   -- Noise Cancelling Headphones via Global Devices
(12, 5, 5400, 15, false), -- Portable SSD via Pacific Import
(18, 4, 6200, 3, false);  -- WiFi 6 Router via Global Devices

-- Receiving history per supplier: turnaround = received_at - approved_at,
-- compared against the supplier's lead time, is what Supplier Intelligence
-- computes on-time % and average delay from. Ids continue on from the two
-- purchase orders already seeded (1, 2).
INSERT INTO "purchase_orders" ("id", "po_number", "supplier_id", "status", "notes", "created_by", "created_at", "approved_at", "received_at") VALUES

(3, 'PO-1042', 1, 'received', 'Keyboard + speaker restock', 'human', NOW() - INTERVAL '57 days', NOW() - INTERVAL '55 days', NOW() - INTERVAL '50 days'),
(4, 'PO-1043', 1, 'received', 'Monitor restock', 'human', NOW() - INTERVAL '42 days', NOW() - INTERVAL '40 days', NOW() - INTERVAL '35 days'),
(5, 'PO-1044', 1, 'received', 'Router + smart plug restock', 'agent', NOW() - INTERVAL '27 days', NOW() - INTERVAL '25 days', NOW() - INTERVAL '16 days'),

(6, 'PO-1045', 2, 'received', 'Printer paper restock', 'human', NOW() - INTERVAL '52 days', NOW() - INTERVAL '50 days', NOW() - INTERVAL '46 days'),
(7, 'PO-1046', 2, 'received', 'File folders + packing tape', 'human', NOW() - INTERVAL '37 days', NOW() - INTERVAL '35 days', NOW() - INTERVAL '30 days'),
(8, 'PO-1047', 2, 'received', 'HDMI cable restock', 'agent', NOW() - INTERVAL '17 days', NOW() - INTERVAL '15 days', NOW() - INTERVAL '11 days'),

(9, 'PO-1048', 3, 'received', 'Headphones restock', 'human', NOW() - INTERVAL '62 days', NOW() - INTERVAL '60 days', NOW() - INTERVAL '49 days'),
(10, 'PO-1049', 3, 'received', 'Mouse + laptop stand restock', 'human', NOW() - INTERVAL '47 days', NOW() - INTERVAL '45 days', NOW() - INTERVAL '35 days'),
(11, 'PO-1050', 3, 'received', 'Portable SSD restock', 'agent', NOW() - INTERVAL '22 days', NOW() - INTERVAL '20 days', NOW() - INTERVAL '9 days'),

(12, 'PO-1051', 4, 'received', 'Keyboard trial order', 'agent', NOW() - INTERVAL '42 days', NOW() - INTERVAL '40 days', NOW() - INTERVAL '37 days'),
(13, 'PO-1052', 4, 'received', 'Headphones trial order', 'agent', NOW() - INTERVAL '27 days', NOW() - INTERVAL '25 days', NOW() - INTERVAL '22 days'),
(14, 'PO-1053', 4, 'received', 'Router trial order', 'human', NOW() - INTERVAL '12 days', NOW() - INTERVAL '10 days', NOW() - INTERVAL '7 days'),

(15, 'PO-1054', 5, 'received', 'Monitor overseas order', 'human', NOW() - INTERVAL '72 days', NOW() - INTERVAL '70 days', NOW() - INTERVAL '54 days'),
(16, 'PO-1055', 5, 'received', 'Portable SSD overseas order', 'human', NOW() - INTERVAL '47 days', NOW() - INTERVAL '45 days', NOW() - INTERVAL '30 days'),
(17, 'PO-1056', 5, 'received', 'Keyboard overseas order', 'agent', NOW() - INTERVAL '22 days', NOW() - INTERVAL '20 days', NOW() - INTERVAL '3 days');

INSERT INTO "purchase_order_items" ("purchase_order_id", "product_id", "quantity", "unit_cost_cents") VALUES

(3, 1, 20, 3200),
(3, 8, 15, 3400),
(4, 2, 10, 14000),
(5, 18, 12, 5900),
(5, 17, 25, 1100),

(6, 22, 40, 450),
(7, 29, 30, 350),
(7, 46, 50, 500),
(8, 10, 60, 400),

(9, 9, 10, 6800),
(10, 4, 25, 900),
(10, 6, 15, 2100),
(11, 12, 12, 6100),

(12, 1, 15, 3400),
(13, 9, 8, 7100),
(14, 18, 10, 6200),

(15, 2, 8, 21000),
(16, 12, 10, 5400),
(17, 1, 20, 2900);

-- The original seed migration inserted explicit ids for suppliers, products,
-- and purchase_orders without advancing their serial sequences — fix that
-- forward here so the next application-created row doesn't collide with a
-- seeded id.
SELECT setval('suppliers_id_seq', (SELECT MAX("id") FROM "suppliers"));
SELECT setval('products_id_seq', (SELECT MAX("id") FROM "products"));
SELECT setval('purchase_orders_id_seq', (SELECT MAX("id") FROM "purchase_orders"));
