CREATE TABLE "agent_tool_calls" (
	"id" serial PRIMARY KEY,
	"tool_name" text NOT NULL,
	"input" text,
	"summary" text NOT NULL,
	"consequential" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "inventory_movements" (
	"id" serial PRIMARY KEY,
	"product_id" integer NOT NULL,
	"type" text NOT NULL,
	"quantity_delta" integer NOT NULL,
	"note" text,
	"actor" text DEFAULT 'human' NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" serial PRIMARY KEY,
	"sku" text NOT NULL UNIQUE,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"supplier_id" integer NOT NULL,
	"cost_cents" integer NOT NULL,
	"price_cents" integer NOT NULL,
	"quantity" integer DEFAULT 0 NOT NULL,
	"reorder_threshold" integer DEFAULT 5 NOT NULL,
	"target_coverage_days" integer DEFAULT 30 NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "purchase_order_items" (
	"id" serial PRIMARY KEY,
	"purchase_order_id" integer NOT NULL,
	"product_id" integer NOT NULL,
	"quantity" integer NOT NULL,
	"unit_cost_cents" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "purchase_orders" (
	"id" serial PRIMARY KEY,
	"po_number" text NOT NULL UNIQUE,
	"supplier_id" integer NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"notes" text,
	"created_by" text DEFAULT 'human' NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"approved_at" timestamp,
	"received_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "suppliers" (
	"id" serial PRIMARY KEY,
	"name" text NOT NULL,
	"contact_email" text NOT NULL,
	"lead_time_days" integer DEFAULT 7 NOT NULL,
	"delay_days" integer DEFAULT 0 NOT NULL,
	"delay_note" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_product_id_products_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id");--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_supplier_id_suppliers_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id");--> statement-breakpoint
ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_purchase_order_id_purchase_orders_id_fkey" FOREIGN KEY ("purchase_order_id") REFERENCES "purchase_orders"("id");--> statement-breakpoint
ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_product_id_products_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id");--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_supplier_id_suppliers_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id");