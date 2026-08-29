CREATE TABLE "business_policies" (
	"id" serial PRIMARY KEY,
	"key" text NOT NULL UNIQUE,
	"value" text NOT NULL,
	"description" text,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "agent_tool_calls" ADD COLUMN "user_id" integer;