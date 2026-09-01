# StockPilot — AI Inventory Operations Agent

> Same brain as your dashboard. Agent gets its own copy.

StockPilot is an agent-native inventory management app where the dashboard and a browser-based AI agent operate on the **same data through the same logic**. The UI calls it via TanStack Start server functions. Any WebMCP-capable agent connected to the tab calls the exact same tools via `document.modelContext.registerTool()`. No duplication. No drift. Two entry points, one source of truth.

## The Problem

Warehouse and procurement managers at 20–100 SKU shops spend **4+ hours every Monday** walking the floor with a clipboard, manually counting stock, and building purchase orders in spreadsheets. They copy supplier names, costs, and lead times from separate sheets, WhatsApp suppliers for updates, and cross their fingers on delivery timing. One stockout on a hero SKU during a launch can cost thousands.

StockPilot eliminates that Monday morning ritual.

## The Demo

**"Protect my inventory with a $3,000 budget."**

One prompt triggers a full workflow:
1. **Morning briefing** — health score (0–100), critical issues, pending approvals, dead-stock capital, supplier alerts
2. **Risk analysis** — which products will stock out, when, and why (accelerating demand, supplier delays, or declining sales)
3. **Budget-aware replenishment plan** — reorder quantities prioritized by urgency, fitted within budget, grouped by supplier with cost subtotals
4. **Propose & approve** — agent files pending actions, human approves with a single YES, purchase orders are created
5. **Receive & update** — stock is received, inventory movements logged, dashboard updates in real-time

## WebMCP Tools — 52 Tools Across 6 Categories

| Category | Count | Description |
|----------|-------|-------------|
| **READ** | 8 | `search_products`, `get_inventory_summary`, `find_low_stock`, `get_product_details`, `get_sales_velocity`, `get_purchase_orders`, `get_inventory_movements`, `get_suppliers` |
| **ANALYZE** | 16 | `analyze_stock_risk`, `recommend_reorder`, `get_supplier_intelligence`, `compare_suppliers`, `find_dead_stock`, `get_inventory_health_check`, `what_should_i_worry_about`, `forecast_demand`, `simulate_inventory`, `query_inventory`, `generate_report`, `build_replenishment_plan`, `get_morning_briefing`, `get_emergency_impact`, `investigate_inventory`, `get_profitability_analysis` |
| **CREATE** | 3 | `generate_sku`, `generate_product`, `create_product_from_draft` |
| **MUTATE** | 7 | `create_purchase_order`, `approve_purchase_order`, `receive_shipment`, `update_stock`, `revert_movement`, `create_sale`, `process_return` |
| **NAVIGATE** | 8 | `navigate_products`, `navigate_purchase_orders`, `navigate_suppliers`, `navigate_simulator`, `navigate_sales`, `navigate_pos`, `navigate_agent_actions`, `navigate_agent_tools` |
| **COLLABORATE** | 10 | `get_pending_agent_actions`, `propose_replenishment`, `approve_agent_action`, `reject_agent_action`, `get_business_policies`, `update_business_policy`, `get_mission_status`, `get_recent_agent_activity`, `generate_report_csv`, `create_sale` |

Every tool has:
- **4 annotations**: `readOnlyHint`, `destructiveHint`, `idempotentHint`, `openWorldHint`
- **Code-gen input schemas**: Zod → JSON Schema via `@alcyone-labs/zod-to-json-schema` — no manual drift
- **`isError` contract**: structured error codes (`NOT_FOUND`, `CONFLICT`, `PRECONDITION_FAILED`, `INVALID_INPUT`) with hints
- **Audit trail**: every tool call logged to `agent_tool_calls` table with input, summary, and timestamp
- **Auto-navigation**: 9 consequential tools auto-navigate to the relevant page after execution

## Key Workflows

### Morning Briefing (`get_morning_briefing`)
One-call comprehensive status: health score, urgent issues, pending approvals, reorder budget, dead-stock capital, supplier alerts, and the single top action. The agent's 6am wake-up call.

### Profitability Analysis (`get_profitability_analysis`)
Cross-product profitability analysis: sales velocity, profit margin per unit, projected monthly revenue and profit. Filter by category, supplier, or minimum profit threshold. Replaces 8+ individual tool calls with one call.

### Cash-Aware Replenishment (`build_replenishment_plan` with `budgetCents`)
Pass a budget cap and the plan prioritizes by urgency (critical → warning → watch), fits items within budget, and returns what fits vs. what's rejected. No overspending.

### Emergency Response (`get_emergency_impact`)
"Supplier delayed 10 days" → instant impact analysis: which products stock out, days until stockout, alternate suppliers available, total revenue at risk.

### Inventory Detective (`investigate_inventory`)
Automated audit: negative stock, suspicious adjustments without notes, receiving discrepancies, duplicate SKUs, and stale products with no movement in 30+ days.

### Business Policies (`get_business_policies` / `update_business_policy`)
Configurable thresholds: auto-approve POs under $500, safety stock at 15%, target coverage 30 days, max supplier concentration 40%. The agent reads these before making decisions.

## Human-Agent Collaboration

StockPilot enforces a **three-layer collaboration model**:

1. **Agent Proposes → Human Approves**: Consequential actions (creating POs, receiving shipments) require human approval via the Agent Actions queue. Server enforces `status === 'pending'` before allowing approval.

2. **PO State Machine**: Purchase orders follow `draft → approved → received` with server-side guards at each transition. The agent can create drafts but cannot approve them.

3. **Real-Time Visibility**: The Agent Activity Panel shows every tool call as it happens. The agent operates on the same data as the human, through the same logic, with the same enforcement mechanisms.

## Architecture

```
src/server/inventory.server.ts    ← Single source of truth (all domain logic)
        ↓
src/server/inventory.functions.ts ← Zod schemas + TanStack Start server functions
        ↓                    ↓
   UI (routes)         WebMCP tools (tools.ts)
   via loaders         via document.modelContext.registerTool()
```

- **Shared domain logic**: `inventory.server.ts` (~2200 lines) handles risk analysis, velocity computation, profitability analysis, replenishment planning, PO lifecycle, supplier intelligence, health checks, detective work, and emergency impact — called identically by both entry points.
- **Server-side safety**: `decide_agent_action` derives `decidedBy` from the session cookie, never trusting client input. PO transitions enforce state machine rules.
- **Progressive enhancement**: `document.modelContext` is an enhancement. The app is 100% functional via TanStack Start server functions without WebMCP.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | TanStack Start (React 19, TanStack Router v1) |
| Build | Vite 7 + Nitro |
| Styling | Tailwind CSS 4 |
| Database | Cloudflare D1 (SQLite) via Drizzle ORM |
| Agent Interface | WebMCP (`@mcp-b/global`) via `document.modelContext.registerTool()` |
| Language | TypeScript 5.7 (strict mode) |
| Deployment | Cloudflare Workers |

## Local Development

```bash
npm install
npm run dev
```

## License

MIT
