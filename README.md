# StockPilot

An agent-native inventory management app: the same domain logic that powers the dashboard is exposed as [WebMCP](https://github.com/webmachinelearning/webmcp) tools, so a browser-based AI agent can inspect stock risk and, with a human approving every consequential step, draft and execute purchase orders alongside the shop owner.

## What it does

- Tracks products, suppliers, stock levels, and inventory movements (sales, restocks, transfers, receiving).
- Computes real-time stockout risk per product from recent vs. baseline sales velocity, supplier lead time, and known shipment delays.
- Recommends reorder quantities and drafts purchase orders, which go through a `draft → approved → received` lifecycle.
- Registers 12 WebMCP tools via `document.modelContext.registerTool()` (8 read-only, 4 consequential) so any WebMCP-capable agent connected to the tab can query and act on the exact same data as the UI.
- Shows a live "Agent Activity" panel and a persisted activity log so every tool call — human or agent-initiated — is visible and auditable.

## Tech stack

- [TanStack Start](https://tanstack.com/start) (React 19, TanStack Router, Vite 7)
- Tailwind CSS 4
- Drizzle ORM over Netlify DB (managed Postgres)
- [`@mcp-b/global`](https://www.npmjs.com/package/@mcp-b/global) as the WebMCP polyfill/transport

## Architecture

Domain logic lives once, in `src/server/inventory.server.ts`, and is called from two places:

1. **The UI**, via TanStack Start server functions (`src/server/inventory.functions.ts`) used in route loaders and event handlers.
2. **WebMCP tools** (`src/lib/webmcp/tools.ts`), which wrap the same server functions and register them with `document.modelContext` so an agent can call them directly from the browser tab.

Consequential tools (`create_purchase_order`, `approve_purchase_order`, `receive_shipment`, `update_stock`) are annotated as non-read-only and instructed in their descriptions to only run after explicit human approval in conversation. The actual security boundary is server-side validation in `inventory.server.ts`, not the WebMCP layer itself.

## Local development

```bash
npm install
netlify dev
```

Database migrations under `netlify/database/migrations/` (schema + seed data) are applied automatically against the Netlify DB branch.
