# StockPilot — Hackathon Winning Plan (Final)

**Competition:** WebMCP Challenge  
**Deadline:** September 3, 2026  
**Submission:** Public repo + license, <3 min video, live demo, description  
**Judging (equal):** WebMCP Leverage, Execution, Potential Impact, Creativity & Ambition

---

## What Already Exists vs What's Missing

### ✅ Already Built (solid foundation)

| Feature | File | Status |
|---------|------|--------|
| 32 WebMCP tools (READ 8, ANALYZE 12, CREATE 3, MUTATE 4, COLLABORATE 5) | `tools.ts` | Done |
| Stockout risk + velocity analysis | `inventory.server.ts:105-163` | Done |
| Reorder recommendations | `inventory.server.ts:243-273` | Done |
| Smart replenishment plan + proposals | `inventory.server.ts:990-1074` | Done |
| Purchase order lifecycle (create/approve/receive) | `inventory.server.ts:318-437` | Done |
| Supplier intelligence + comparison | `inventory.server.ts:507-601` | Done |
| Health check with 7 issue types | `inventory.server.ts:645-785` | Done |
| "What should I worry about?" briefing | `inventory.server.ts:1080-1120` | Done |
| Agent activity audit log | `inventory.server.ts:476-492` | Done |
| Agent actions approval queue | `inventory.server.ts:886-984` | Done |
| Mission interface | `inventory.server.ts:1420-1467` | Done |
| Dead stock detection | `inventory.server.ts:608-626` | Done |
| Demand simulation | `inventory.server.ts:1126-1181` | Done |
| Natural language inventory query | `inventory.server.ts:1318-1355` | Done |
| Undo (revert movement) | `inventory.server.ts:1384-1414` | Done |
| Cash-tied-up report | `inventory.server.ts:1249-1266` | Done |
| Agent-first dashboard | `routes/index.tsx` | Done |
| Server-side auth gate (no impersonation) | `inventory.functions.ts:272-278` | Done |
| db.transaction on receiveShipment | `inventory.server.ts:413-433` | Done |
| zod-to-json-schema code-gen | `tools.ts:1` | Done |
| 4 annotations per tool | `tools.ts:134-140` | Done |
| isError + error codes | `tools.ts:102-118` | Done |
| WebMCP feature-detect | `tools.ts:817-821` | Done |
| 50 products across 4 categories | Seed data | Done |
| 5 suppliers with reliability data | Seed data | Done |
| Alternate supplier options | Seed data | Done |
| 30 days of movement history | Seed data | Done |

### ❌ Missing (what needs building)

| # | Feature | Why It Wins | Files to Change | Est. |
|---|---------|-------------|-----------------|------|
| 1 | **Cash-aware replenishment** | Agent says "approve $847 PO" — judges see real budget | `inventory.server.ts` (modify `buildReplenishmentPlan`) | 1.5h |
| 2 | **Morning briefing tool** | One command = full status report | `inventory.server.ts` (new), `inventory.functions.ts`, `tools.ts` | 1h |
| 3 | **Emergency mode** | "Supplier failed" → impact + alternatives | `inventory.server.ts` (new), `inventory.functions.ts`, `tools.ts` | 2h |
| 4 | **Inventory detective** | "Something's wrong" → discrepancy report | `inventory.server.ts` (new), `inventory.functions.ts`, `tools.ts` | 1.5h |
| 5 | **Business policies** | Configurable thresholds, not hardcoded | `db/schema.ts` (new table), `inventory.server.ts`, migration | 1.5h |
| 6 | **Better demo data** | Need anomalies, delays, accelerating demand | New migration | 1h |
| 7 | **Enhanced agent activity** | Agent vs human, before/after, token cost | `inventory.server.ts`, `routes/agent-tools.tsx` | 1h |
| 8 | **Unified demo prompt** | One prompt = full workflow | `tools.ts` or `WebMcpProvider.tsx` | 0.5h |
| 9 | **README rewrite** | Judges read this first | `README.md` | 0.5h |
| 10 | **Video** | 3-min narrative | N/A | 1h |

---

## Execution Plan (4 days)

### Day 1 — Core Intelligence (5h)

**1. Cash-Aware Replenishment** (1.5h)

Modify `buildReplenishmentPlan` in `inventory.server.ts`:

```ts
// Add budget parameter
export async function buildReplenishmentPlan(input: { 
  category?: string; 
  days?: number;
  budgetCents?: number;  // NEW: max spend cap
} = {}) {
  // ... existing logic ...
  
  // If budget provided, prioritize by urgency then fit within budget
  if (input.budgetCents) {
    let remaining = input.budgetCents
    const prioritized = items
      .sort((a, b) => urgencyScore(a) - urgencyScore(b))  // critical first
      .filter(item => {
        if (item.estimatedCostCents <= remaining) {
          remaining -= item.estimatedCostCents
          return true
        }
        return false
      })
    return { ...base, items: prioritized, budgetUsedCents: input.budgetCents - remaining, budgetRemainingCents: remaining }
  }
}
```

Add `urgencyScore` helper: critical=1, warning=2, watch=3.

Add `budgetSummary` to output: `{ total, breakdown: [{sku, qty, unitCost, total}], withinBudget: boolean }`.

**2. Morning Briefing Tool** (1h)

New function in `inventory.server.ts`:

```ts
export async function getMorningBriefing() {
  const [health, plan, pending, deadStock, suppliers] = await Promise.all([
    getInventoryHealthCheck(),
    buildReplenishmentPlan(),
    listAgentActions({ status: 'pending' }),
    findDeadStock(),
    getSupplierIntelligence(),
  ])
  
  return {
    healthScore: computeHealthScore(health),
    urgentIssues: health.issues.filter(i => i.severity === 'high'),
    watchIssues: health.issues.filter(i => i.severity === 'medium'),
    reorderBudget: plan.totalEstimatedCostCents,
    pendingApprovals: pending.length,
    deadStockCapital: deadStock.reduce((s, d) => s + d.capitalTiedUpCents, 0),
    topAction: plan.items[0] ?? null,
    supplierAlerts: suppliers.filter(s => s.onTimePct !== null && s.onTimePct < 70),
  }
}
```

New tool `get_morning_briefing` in `tools.ts`.

**3. Enhance Agent Activity** (1h)

Add to `agentToolCalls` schema (no migration needed — use existing columns):
- `input` already stores tool input JSON
- `summary` already stores result
- Add `consequential` boolean (already exists)

Enhance `getRecentAgentActivity` to include:
- Agent vs human (check if `actor` column exists, else derive from tool name)
- Before/after stock (parse summary for delta)
- Token estimate per tool call (compute from inputSchema size)

**4. Better Demo Data** (1h)

New migration `20260828_improve_demo_data.sql`:
- Add a product with negative stock movement (anomaly)
- Add a product with sudden demand spike (3x in last week)
- Add a product with zero movement (true dead stock)
- Add a supplier with 0% on-time delivery
- Add a PO that's been pending for 14+ days (overdue)
- Add adjustment movements (suspicious activity)

### Day 2 — Emergency + Detective + Policies (5h)

**5. Emergency Mode** (2h)

New function in `inventory.server.ts`:

```ts
export async function getEmergencyImpact(input: { supplierId: number; delayDays?: number }) {
  const delayDays = input.delayDays ?? 14
  const supplierProducts = await db.select().from(products).where(eq(products.supplierId, input.supplierId))
  
  const impacts = []
  for (const product of supplierProducts) {
    const risk = await riskForProducts([product.id])
    if (risk.length === 0) continue
    const r = risk[0]
    
    // Find alternate suppliers
    const alternates = await db.select().from(productSuppliers)
      .innerJoin(suppliers, eq(productSuppliers.supplierId, suppliers.id))
      .where(and(eq(productSuppliers.productId, product.id), not(eq(productSuppliers.supplierId, input.supplierId))))
    
    const daysUntilStockout = r.coverageDays ?? Infinity
    const willStockOut = daysUntilStockout < (r.leadTimeDays + delayDays)
    
    impacts.push({
      productId: product.id,
      sku: product.sku,
      name: product.name,
      currentStock: product.quantity,
      dailyVelocity: r.recentDailyVelocity || r.baselineDailyVelocity,
      daysUntilStockout,
      willStockOut,
      alternateSuppliers: alternates.map(a => ({
        supplierId: a.supplierId,
        name: a.suppliers.name,
        unitCostCents: a.unitCostCents,
        leadTimeDays: a.leadTimeDays,
      })),
      revenueAtRiskCents: willStockOut ? Math.ceil(daysUntilStockout * r.recentDailyVelocity) * product.priceCents : 0,
    })
  }
  
  return {
    supplier: input.supplierId,
    delayDays,
    affectedProducts: impacts.length,
    stockoutRisk: impacts.filter(i => i.willStockOut).length,
    totalRevenueAtRiskCents: impacts.reduce((s, i) => s + i.revenueAtRiskCents, 0),
    products: impacts,
  }
}
```

New tool `get_emergency_impact` in `tools.ts`.

**6. Inventory Detective** (1.5h)

New function in `inventory.server.ts`:

```ts
export async function investigateInventory() {
  const movements = await db.select().from(inventoryMovements).orderBy(desc(inventoryMovements.createdAt)).limit(200)
  const productRows = await db.select().from(products)
  
  const issues = []
  
  // Negative stock check
  for (const p of productRows) {
    if (p.quantity < 0) {
      issues.push({ type: 'negative_stock', severity: 'high', productId: p.id, productName: p.name, 
        description: `${p.name} has ${p.quantity} units (negative)`, recommendation: 'Investigate immediately' })
    }
  }
  
  // Suspicious adjustments (large deltas, no note)
  const adjustments = movements.filter(m => m.type === 'adjustment' && Math.abs(m.quantityDelta) > 10)
  for (const adj of adjustments) {
    issues.push({ type: 'suspicious_adjustment', severity: 'medium', productId: adj.productId,
      description: `Large adjustment: ${adj.quantityDelta} units on product ${adj.productId}${adj.note ? '' : ' (no note)'}`,
      recommendation: adj.note ? 'Verify adjustment reason' : 'Add note explaining this adjustment' })
  }
  
  // Receiving discrepancies (PO quantity vs actual)
  // ... check purchaseOrderItems vs sum of receiving movements
  
  // Duplicate SKUs (shouldn't happen but check)
  // ... group by sku, flag duplicates
  
  return { totalIssues: issues.length, issues }
}
```

New tool `investigate_inventory` in `tools.ts`.

**7. Business Policies** (1.5h)

New table in `db/schema.ts`:

```ts
export const businessPolicies = pgTable('business_policies', {
  id: serial().primaryKey(),
  key: text().notNull().unique(),
  value: text().notNull(), // JSON-encoded
  updatedAt: timestamp('updated_at').defaultNow(),
})
```

Default policies:
- `maxPoWithoutApproval`: 100000 (cents)
- `minMarginPercent`: 18
- `emergencyStockDays`: 7
- `targetCoverageDays`: 30
- `safetyStockPercent`: 15
- `autoApproveThreshold`: 50000 (cents)

New function `getBusinessPolicies`, `updateBusinessPolicy`.
New tool `get_business_policies` in `tools.ts`.

### Day 3 — Polish + Demo (4h)

**8. Unified Demo Prompt** (0.5h)

Create a "golden path" that the agent can execute:

```ts
// In tools.ts or a new prompts.ts
const DEMO_PROMPTS = [{
  name: 'protect_my_inventory',
  title: 'Protect My Inventory',
  description: 'Run a full health check, identify risks, create a replenishment plan, and prepare purchase orders within budget',
  arguments: [{ name: 'budget', description: 'Max purchasing budget in dollars', required: false }],
}]
```

Register via `document.modelContext.registerPrompt()` if available, else as a tool description.

**9. README Rewrite** (0.5h)

Structure:
```
StockPilot — AI Inventory Operations Agent
## What it does (3 sentences)
## The demo (3-min video embed placeholder)
## Architecture (human → agent → WebMCP → tools → business rules → approval → actions)
## WebMCP Tools (32 tools, category table, example tool call)
## Key workflows (morning briefing, emergency response, weekly replenishment)
## Setup (npm install, netlify dev)
## Tech stack
```

**10. Demo Scenario Validation** (1h)

Test the full "protect my inventory" flow:
1. Agent calls `get_morning_briefing` → sees 8 issues
2. Agent calls `build_replenishment_plan` → gets budget-aware plan
3. Agent calls `propose_replenishment` → creates agent actions
4. Human approves via `decide_agent_action`
5. Agent calls `approve_purchase_order` → PO created
6. Agent calls `receive_stock` → stock updated
7. Dashboard reflects changes in real-time

**11. Activity Panel Polish** (1h)

Update `AgentActivityPanel.tsx`:
- Show tool call timestamp with seconds
- Show input summary (what was queried)
- Show result summary (what was found)
- Color-code: green (read), yellow (prepare), red (execute)
- Show token estimate per call

### Day 4 — Video + Submit (2h)

**12. Record Video** (1h)

Script:
```
0:00-0:20  "StockPilot: an inventory agent that shares the same brain as your dashboard"
0:20-0:40  "Keep my inventory healthy for 30 days with $3,000 budget"
0:40-1:30  Agent: morning briefing → health check → reorder plan with costs
1:30-2:10  Agent: proposes POs → human approves → WebMCP executes → dashboard updates
2:10-2:40  Emergency: "Supplier delayed 10 days" → impact → alternatives → emergency plan
2:40-3:00  "Same data. Same logic. Two entry points. The agent is your operations manager."
```

**13. Final Checks** (1h)
- [ ] All 32 tools register without errors
- [ ] `get_morning_briefing` returns budget numbers
- [ ] `get_emergency_impact` finds alternates
- [ ] `investigate_inventory` finds anomalies
- [ ] Dashboard shows agent activity
- [ ] README is accurate
- [ ] License file present
- [ ] Live demo URL works

---

## Tool Count After Changes

| Category | Before | After | Change |
|----------|--------|-------|--------|
| READ | 8 | 8 | — |
| ANALYZE | 12 | 12 | — |
| CREATE | 3 | 3 | — |
| MUTATE | 4 | 4 | — |
| COLLABORATE | 5 | 5 | — |
| **NEW** | — | +4 | `get_morning_briefing`, `get_emergency_impact`, `investigate_inventory`, `get_business_policies` |
| **Total** | **32** | **36** | +4 |

Or: replace 4 low-value tools with these 4 to stay at 32. Your call.

---

## What Wins Each Judging Category

| Category | How we win it |
|----------|---------------|
| **WebMCP Leverage** | 32+ tools with 4 annotations, code-gen schemas, isError contract, resources, prompts, server-side auth gate |
| **Execution** | Real Postgres, db.transaction, server-derived decidedBy, explainable recommendations, audit trail |
| **Potential Impact** | "45 min → 2 min" procurement, $3K budget optimization, emergency response, anomaly detection |
| **Creativity** | Agent-as-colleague (not chatbot), morning briefing, emergency mode, inventory detective, business policies |

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/server/inventory.server.ts` | Add: `getMorningBriefing`, `getEmergencyImpact`, `investigateInventory`, `getBusinessPolicies`, `updateBusinessPolicy`. Modify: `buildReplenishmentPlan` (budget param) |
| `src/server/inventory.functions.ts` | Add: server functions for new tools. Modify: `buildReplenishmentPlanFn` schema |
| `src/lib/webmcp/tools.ts` | Add: 4 new tools. Update: `build_replenishment_plan` description |
| `db/schema.ts` | Add: `businessPolicies` table |
| `netlify/database/migrations/` | New: `20260828_add_business_policies.sql`, `20260828_enhance_demo_data.sql` |
| `src/routes/index.tsx` | Minor: show budget in at-risk section |
| `src/components/AgentActivityPanel.tsx` | Enhance: timestamps, token estimates, color coding |
| `README.md` | Rewrite: lead with story, architecture diagram, tool table |
| `AGENTS.md` | Fix: tool count, add new tools |
