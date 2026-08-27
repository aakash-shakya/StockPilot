CREATE TABLE "agent_actions" (
	"id" serial PRIMARY KEY,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"reasoning" text NOT NULL,
	"impact" text DEFAULT 'low' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"payload" text NOT NULL,
	"related_product_ids" text,
	"estimated_cost_cents" integer,
	"proposed_by" text DEFAULT 'agent' NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"decided_at" timestamp,
	"decided_by" text,
	"executed_at" timestamp,
	"result_summary" text
);
--> statement-breakpoint
CREATE TABLE "product_suppliers" (
	"id" serial PRIMARY KEY,
	"product_id" integer NOT NULL,
	"supplier_id" integer NOT NULL,
	"unit_cost_cents" integer NOT NULL,
	"lead_time_days" integer NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
ALTER TABLE "product_suppliers" ADD CONSTRAINT "product_suppliers_product_id_products_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id");--> statement-breakpoint
ALTER TABLE "product_suppliers" ADD CONSTRAINT "product_suppliers_supplier_id_suppliers_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id");