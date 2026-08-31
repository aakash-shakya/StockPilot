CREATE TABLE `agent_actions` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`type` text NOT NULL,
	`title` text NOT NULL,
	`reasoning` text NOT NULL,
	`impact` text DEFAULT 'low' NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`payload` text NOT NULL,
	`related_product_ids` text,
	`estimated_cost_cents` integer,
	`proposed_by` text DEFAULT 'agent' NOT NULL,
	`created_at` integer DEFAULT (strftime('%s','now')),
	`decided_at` integer,
	`decided_by` text,
	`executed_at` integer,
	`result_summary` text
);
--> statement-breakpoint
CREATE TABLE `agent_tool_calls` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`tool_name` text NOT NULL,
	`input` text,
	`summary` text NOT NULL,
	`consequential` integer DEFAULT false NOT NULL,
	`user_id` integer,
	`created_at` integer DEFAULT (strftime('%s','now'))
);
--> statement-breakpoint
CREATE TABLE `business_policies` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`key` text NOT NULL UNIQUE,
	`value` text NOT NULL,
	`description` text,
	`updated_at` integer DEFAULT (strftime('%s','now'))
);
--> statement-breakpoint
CREATE TABLE `inventory_movements` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`product_id` integer NOT NULL,
	`type` text NOT NULL,
	`quantity_delta` integer NOT NULL,
	`note` text,
	`actor` text DEFAULT 'human' NOT NULL,
	`created_at` integer DEFAULT (strftime('%s','now')),
	CONSTRAINT `fk_inventory_movements_product_id_products_id_fk` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`)
);
--> statement-breakpoint
CREATE TABLE `product_suppliers` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`product_id` integer NOT NULL,
	`supplier_id` integer NOT NULL,
	`unit_cost_cents` integer NOT NULL,
	`lead_time_days` integer NOT NULL,
	`is_primary` integer DEFAULT false NOT NULL,
	CONSTRAINT `fk_product_suppliers_product_id_products_id_fk` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`),
	CONSTRAINT `fk_product_suppliers_supplier_id_suppliers_id_fk` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers`(`id`)
);
--> statement-breakpoint
CREATE TABLE `products` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`sku` text NOT NULL UNIQUE,
	`name` text NOT NULL,
	`category` text NOT NULL,
	`supplier_id` integer NOT NULL,
	`cost_cents` integer NOT NULL,
	`price_cents` integer NOT NULL,
	`quantity` integer DEFAULT 0 NOT NULL,
	`reorder_threshold` integer DEFAULT 5 NOT NULL,
	`target_coverage_days` integer DEFAULT 30 NOT NULL,
	`created_at` integer DEFAULT (strftime('%s','now')),
	CONSTRAINT `fk_products_supplier_id_suppliers_id_fk` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers`(`id`)
);
--> statement-breakpoint
CREATE TABLE `purchase_order_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`purchase_order_id` integer NOT NULL,
	`product_id` integer NOT NULL,
	`quantity` integer NOT NULL,
	`unit_cost_cents` integer NOT NULL,
	CONSTRAINT `fk_purchase_order_items_purchase_order_id_purchase_orders_id_fk` FOREIGN KEY (`purchase_order_id`) REFERENCES `purchase_orders`(`id`),
	CONSTRAINT `fk_purchase_order_items_product_id_products_id_fk` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`)
);
--> statement-breakpoint
CREATE TABLE `purchase_orders` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`po_number` text NOT NULL UNIQUE,
	`supplier_id` integer NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`notes` text,
	`created_by` text DEFAULT 'human' NOT NULL,
	`created_at` integer DEFAULT (strftime('%s','now')),
	`approved_at` integer,
	`received_at` integer,
	CONSTRAINT `fk_purchase_orders_supplier_id_suppliers_id_fk` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers`(`id`)
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`user_id` integer NOT NULL,
	`token` text NOT NULL UNIQUE,
	`expires_at` integer NOT NULL,
	`created_at` integer DEFAULT (strftime('%s','now')),
	CONSTRAINT `fk_sessions_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `suppliers` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`name` text NOT NULL,
	`contact_email` text NOT NULL,
	`lead_time_days` integer DEFAULT 7 NOT NULL,
	`delay_days` integer DEFAULT 0 NOT NULL,
	`delay_note` text,
	`created_at` integer DEFAULT (strftime('%s','now'))
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`email` text NOT NULL UNIQUE,
	`password_hash` text NOT NULL,
	`name` text NOT NULL,
	`role` text DEFAULT 'admin' NOT NULL,
	`created_at` integer DEFAULT (strftime('%s','now')),
	`updated_at` integer DEFAULT (strftime('%s','now'))
);
