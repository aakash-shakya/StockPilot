# AGENTS.md

This document provides an overview of the project structure for developers and AI agents working on this codebase.

## Project Overview

StockPilot — an agent-native inventory management app. The dashboard and a browser-based AI agent operate on the
same inventory data through the same domain logic: the UI calls it via TanStack Start server functions, and any
WebMCP-capable agent connected to the tab calls the exact same logic via tools registered on
`document.modelContext`. Built with TanStack Start and deployed on Netlify, backed by Netlify Database (Postgres).

### Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | TanStack Start |
| Frontend | React 19, TanStack Router v1 |
| Build | Vite 7 |
| Styling | Tailwind CSS 4 |
| Database | Netlify Database (managed Postgres) via Drizzle ORM |
| Agent interface | WebMCP (`document.modelContext.registerTool`) via `@mcp-b/global` |
| Language | TypeScript 5.7 (strict mode) |
| Deployment | Netlify |

## Directory Structure

```
├── db
│   ├── schema.ts               # Drizzle table definitions — source of truth for the schema
│   └── index.ts                # Drizzle client (drizzle-orm/netlify-db)
├── drizzle.config.ts            # out: netlify/database/migrations
├── netlify/database/migrations  # SQL migrations, applied automatically by Netlify at deploy time
│   ├── 20260827070017_create_inventory_schema/migration.sql
│   └── 20260827070500_seed_demo_data/migration.sql
├── src
│   ├── components
│   │   ├── Nav.tsx                  # Top nav bar (Dashboard / Products / Purchase Orders)
│   │   ├── AgentActivityPanel.tsx   # Live, in-tab panel showing WebMCP tool calls as they happen
│   │   └── badges.tsx               # RiskBadge, TrendLabel, PoStatusBadge
│   ├── lib
│   │   ├── agent-activity-store.ts  # @tanstack/react-store store backing the live activity panel
│   │   └── webmcp
│   │       ├── tools.ts             # WebMCP tool definitions — wraps the server functions below
│   │       └── WebMcpProvider.tsx   # Registers tools with document.modelContext on mount
│   ├── server
│   │   ├── inventory.server.ts      # All domain logic: risk analysis, reorder recs, PO lifecycle, stock updates
│   │   ├── inventory.functions.ts   # TanStack Start server functions wrapping inventory.server.ts for the UI
│   │   └── format.ts                # Formatting helpers (money, dates)
│   ├── routes
│   │   ├── __root.tsx               # Root shell: Nav, Outlet, WebMcpProvider, AgentActivityPanel
│   │   ├── index.tsx                # Dashboard: stock health, at-risk products, open POs, agent activity log
│   │   ├── products.tsx             # Product search/browse
│   │   ├── products.$productId.tsx  # Product detail: risk, reorder recommendation, manual stock adjustment
│   │   └── purchase-orders.tsx      # PO list with approve / mark received actions
│   └── router.tsx                   # TanStack Router setup
├── netlify.toml
├── package.json
└── tsconfig.json
```

## Key Concepts

### Shared domain logic, two entry points

All business logic — stock risk, sales velocity, reorder recommendations, purchase order lifecycle, stock
mutations — lives once in `src/server/inventory.server.ts`. It is never duplicated:

1. **The UI** calls it through TanStack Start server functions in `src/server/inventory.functions.ts`, used from
   route `loader`s and event handlers.
2. **WebMCP tools** (`src/lib/webmcp/tools.ts`) call the *same* server functions and register themselves with
   `document.modelContext.registerTool()` so a WebMCP-capable agent in the same tab can query and act on
   identical data. There are 32 tools across 5 categories: `READ` 8, `ANALYZE` 12, `CREATE` 4, `MUTATE` 4, `COLLABORATE` 4 (7 core, 25 aliases — see `docs/designs/webmcp-minimal-fix.md`). The single source for `inputSchema` is Zod in `src/server/inventory.functions.ts` via `@alcyone-labs/zod-to-json-schema` so schemas never drift.

Consequential tools are annotated with full `readOnlyHint`/`destructiveHint`/`idempotentHint`/`openWorldHint` (all 4 per ToolAnnotations, `openWorldHint:false` for all local-DB tools) and instructed in their descriptions to only run after a
human has approved the action in conversation. The actual security boundary is server-side validation in
`inventory.server.ts` (session-derived `decidedBy`, `db.transaction` for `receiveShipment`) — WebMCP annotations are a hint to the agent, not an access-control mechanism.

### Agent Activity panel

`src/lib/agent-activity-store.ts` is a small in-memory store that every tool call writes to (`beginActivity` /
`completeActivity` / `failActivity`). `AgentActivityPanel.tsx` renders it live via `useStore` — note the selector
argument to `useStore` is required, not optional. Every tool call is also persisted to the `agent_tool_calls`
table so there's a durable audit log, shown on the dashboard separately from the live panel.

### File-Based Routing (TanStack Router)

Routes are defined by files in `src/routes/`. `products.$productId.tsx` maps to `/products/:productId`.

### Database

Schema changes go through `db/schema.ts` + `npx drizzle-kit generate --name <name>`, never hand-edited SQL for
schema. Migrations live in `netlify/database/migrations/` and are applied automatically by the Netlify platform
at deploy time — never apply them manually (`drizzle-kit migrate`/`push` and raw DDL against the DB are both off
limits; see the `netlify-database` skill for details).

## Development Commands

```bash
npm install
netlify dev      # local dev server, wired to the Netlify Database preview branch
```

## Conventions

### Naming
- Components: PascalCase
- Utilities/hooks: camelCase
- Routes: TanStack Router file-based conventions (dot-separated segments, `$param` for dynamic segments)

### TypeScript
- Strict mode enabled, `noUnusedLocals`/`noUnusedParameters` on
- `.js` extensions on relative imports of `.ts`/`.tsx` files (required by `moduleResolution: bundler` + ESM)
- Zod schemas as the `inputValidator` for every server function

### Styling
- Tailwind CSS 4 utility classes, no separate design-token layer
