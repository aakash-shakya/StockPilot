# Plan: WebMCP Minimal Spec + Safety — Eng Review Locked

**Branch:** feature/high-contrast-ui  
**Design doc:** `docs/designs/webmcp-minimal-fix.md`  
**Mode:** Startup, pre-product, warehouse/procurement manager  
**Date:** 2026-08-28  
**Status:** DRAFT → awaiting lock

## Goal

Ship Approach A this week so the 6am `what_should_i_worry_about → build_replenishment_plan → propose_replenishment → approve_agent_action` YES-button is **spec-correct, safe, and directory-listable** without breaking the 32-tool surface (token debt acknowledged, B/C deferred).

Success = `getTools()` returns 32 with 4 annotations + strict schemas, `isError:true` on invalid IDs, `decideAgentAction` impersonation closed, `receiveShipment` atomic, build green, `AGENTS.md:72` count fixed.

## Scope In / Out

**In (this plan):**
- `src/lib/webmcp/tools.ts` — schema code-gen, 4 annotations, error contract, docs count
- `src/lib/webmcp/WebMcpProvider.tsx` — feature-detect, abort robustness
- `src/server/inventory.server.ts` — transaction, human gate
- `src/server/inventory.functions.ts` — session-derived decidedBy plumbing
- Docs `AGENTS.md:72` / `README.md:10` count fix + `docs/designs/webmcp-minimal-fix.md` xref

**Out (deferred to B):**
- Collapse 32→7, prompts/resources/elicitation, pagination/cursors, idempotencyKey UNIQUE, declarative `<form tool*>`, push subscriptions, token-budget resource_links. Documented as backlog, not deleted.

## Architecture — Single Source of Truth, Two Entry Points (locked)

```
TanStack Start server functions (Zod)  <-- single Zod definition
        | inventory.functions.ts       |
        +--> UI loaders/handlers <--+
        |                            |
        +--> WebMCP tools (register)  +--> shared domain logic
                 | inventory.server.ts  <-- transactions, validation
                 +--> Drizzle + Netlify DB (Postgres)
```

WebMCP remains **progressive enhancement** (`if('modelContext' in document)`). No Tab/Extension transport config changes; `allowedOrigins:['*']` stays (docs note Chromium-only OT 149-156, `Permissions-Policy: tools` for iframe).

## Data Flow (mermaid)

```mermaid
flowchart TD
  A[Browser tab agent] -- getTools --> M[document.modelContext]
  M -- executeTool(json) --> P[WebMCP Provider registerInventoryWebMCPTools]
  P -- tool.run --> F[ServerFn (Zod validate)]
  F --> S[inventory.server.ts]
  S --> DB[(Drizzle Postgres)]
  S --> LOG[agent_tool_calls + agentActivityStore]
  LOG --> Panel[AgentActivityPanel + /agent-tools]
  UI[Dashboard loaders] --> F
```

`ToolDef.run` → `{summary,payload}` → `toolResult` → `structuredContent` (new) + text fallback; errors → `isError:true`.

## Decisions from Eng Review (locked)

| D | Choice | File:line | Why |
|---|--------|-----------|-----|
| D1 | **Code-gen via `zod-to-json-schema`** | `tools.ts:59` + `inventory.functions.ts:7` | Eliminates drift (float IDs, unbounded days). One dep `zod-to-json-schema@3.23` ~15KB. |
| D2 | **Emit all 4 annotations** | `tools.ts:688` | `READ: true/false/true/false`, `CREATE draft: false/false/false/false`, `MUTATE: false/true/false/false`, `openWorld:false` for all. Unlocks Connector directory. |
| D3 | **Throw + isError mapping with codes** | `tools.ts:689-706` | Map Zod/`Unknown product` → `INVALID_INPUT/NOT_FOUND/CONFLICT/PRECONDITION_FAILED/LIMIT_EXCEEDED` with hint. Host shows red, agent can self-correct. |
| D4 | **Server derives `decidedBy` from session** | `inventory.server.ts:964` + `inventory.functions.ts:decideAgentActionFn` | Ignore client string; call `getCurrentUserFn()` server-side, validate `pending` + budget hint. Closes impersonation. |
| D5 | **Fix `db.transaction` now, defer idempotency** | `inventory.server.ts:418` + `1039` | Wrap `receiveShipment` + `createReplenishmentProposals`; idempotency `UNIQUE` column deferred to B with dispatch. |

## Detailed Changes

### 1. `src/lib/webmcp/tools.ts`
- **Imports:** add `import { zodToJsonSchema } from 'zod-to-json-schema'`; import each `*Fn`'s `inputValidator` or share Zod objects from `inventory.functions.ts` (export them). Helper `inputSchemaFor(z)` → JSON Schema with `additionalProperties:false`.
- **Per-tool:** replace hand-written `inputSchema` object with `zodToJsonSchema(schema, {target:'jsonSchema7', $refStrategy:'none', withDates:true})`; verify `type:integer` for IDs, `minimum:1`, `maximum:90` for days, `required` present, `description` per param kept, `additionalProperties:false`.
- **Annotations:** 
  ```ts
  annotations: {
    readOnlyHint: tool.readOnly,
    destructiveHint: !tool.readOnly && ['update_stock','receive_shipment','revert_movement','approve_agent_action','reject_agent_action'].includes(tool.name) || tool.name==='create_product_from_draft' ? false : !tool.readOnly,
    idempotentHint: tool.readOnly, // reads idempotent true, writes false (except generate_sku true)
    openWorldHint: false, // all local DB
    title: tool.title,
  }
  // Precise map: READ 8 → true/false/true/false, CREATE draft 2 → false/false/false/false, MUTATE 4 + COLLABORATE approve/reject → false/true/false/false
  ```
  Actually per table above: `generate_sku/generate_product` `idempotent true`, others false.
- **Error contract:** 
  ```ts
  catch (e) {
    const { code, message, hint } = mapError(e); // 5 codes
    failActivity(...);
    void logAgentToolCallFn(...);
    return { content:[{type:'text', text: `${code}: ${message}. Hint: ${hint}`}], isError:true, structuredContent:{code, hint} } as any;
  }
  ```
  `mapError` inspects `e instanceof z.ZodError` → `INVALID_INPUT`, `e.message.includes('Unknown')` → `NOT_FOUND`, `already approved` → `CONFLICT`, `must be approved` → `PRECONDITION_FAILED`, etc.
- **Docs sync:** update comment header count 12→32, add deprecation note “7 core, 25 aliases (deprecation window 2 milestones)”.

### 2. `src/lib/webmcp/WebMcpProvider.tsx`
- Feature-detect:
  ```ts
  if (typeof document === 'undefined' || !(('modelContext' in document) || ('modelContext' in navigator))) return () => {};
  try { await import('@mcp-b/global'); } catch { console.warn(...); return () => {}; }
  const ctx = (document as any).modelContext ?? (navigator as any).modelContext;
  if (!ctx?.registerTool) return () => {};
  ```
- Per-tool AbortController map (optional for A — keep single but reset on failure):
  ```ts
  let registered = false;
  try { for (const tool of TOOLS) await ctx.registerTool(...); registered = true; } catch (e) { registered = false; throw e; }
  ```
  On `useEffect` cleanup abort *and* `isMounted` flag to avoid leak if unmount races import.

### 3. `src/server/inventory.server.ts`
- **Transaction:**
  ```ts
  await db.transaction(async (tx) => {
    for (const item of items) {
      await tx.update(products)...;
      await tx.insert(inventoryMovements)...;
    }
    await tx.update(purchaseOrders)...;
  });
  ```
  Apply to `receiveShipment` and `createReplenishmentProposals` loop (1039-1067 similar).
- **Human gate:**
  ```ts
  export async function decideAgentAction(input: {actionId:number; decision:'approved'|'rejected'}) {
    const user = await getCurrentUserFn(); // throws if unauth
    const [action] = await db.select()...;
    if (action.status !== 'pending') throw new Error(...);
    await db.update(...).set({ decidedBy: user?.name ?? 'human', decidedAt: new Date(), status: input.decision });
    ...
  }
  ```
  Remove `decidedBy` from client input type.

### 4. `src/server/inventory.functions.ts`
- Change `decideAgentActionFn` inputValidator to `z.object({actionId:z.number().int().positive(), decision:z.enum(['approved','rejected'])})` (drop `decidedBy`). Handler calls `inventory.decideAgentAction({actionId, decision})` without forwarding client string.
- Export Zod schemas as named exports for `zod-to-json-schema` reuse (e.g., `export const searchProductsSchema = z.object(...)`).

### 5. Docs
- `AGENTS.md:72` 12→32 with table categories, `README.md:10` same.
- Add section `## WebMCP: Minimal Spec` with origin-trial note and `zod-to-json-schema` mention.

## Edge Cases & Failure Modes

- **Polyfill not loaded / insecure context:** Provider no-ops, UI fully functional; `AgentActivityPanel` shows “No activity yet” correctly (already handles).
- **Invalid productId float / extra keys:** Zod now returns `INVALID_INPUT` with hint, `isError:true` → host retries correctly.
- **Concurrent approve:** `decideAgentAction` checks `status !== 'pending'` inside transaction → second caller gets `CONFLICT Already approved` not duplicate execution.
- **Half-received PO:** transaction ensures atomic; on throw `purchaseOrders.status` stays `approved`, `products.quantity` unchanged.
- **Tool rename drift in future:** B will keep aliases; A keeps all names stable so no break.

## Testing Strategy

- **Schema snapshots:** `tools.test.ts` → `expect(zodToJsonSchema(schema)).toMatchInlineSnapshot()` for each of 32, asserts `additionalProperties:false` + `required` + `integer`.
- **Annotations audit:** `expect(annotations).toMatchObject({readOnlyHint: expect.any(Boolean)})` and host token measurement script (`measureTokens.ts` via `kansei-link` approach).
- **Error contract:** call each consequential with `productId: -1` → assert `isError:true` + `code:NOT_FOUND` + hint contains `search_products`.
- **Human gate:** unit `decideAgentAction` with mocked `getCurrentUserFn` → assert `decidedBy` equals mocked user, not client string; second call → `CONFLICT`.
- **Transaction:** mock `tx.update` failure mid-loop → assert DB unchanged via `db.select`.
- **Provider robustness:** `jsdom` test with `document.modelContext = undefined` → no throw; with mocked `registerTool` that throws on third tool → `registered` resets, retry succeeds.

## Performance & Token Budget

- Measure before/after: run helper counting `JSON.stringify(tool.inputSchema).length` tokens (~4 chars/token) aiming <3k for filtered 7 core. 32-tool full remains ~10k but now honest and annotated — lazy loading note in `/agent-tools`.
- Keep `logAgentToolCallFn` `input` truncation to 2k chars + `...truncated` flag (already noted gap) — do in B if not in A.

## Migration & Rollout

- No DB migration in A except docs. `zod-to-json-schema` added to `dependencies` (or `devDependencies` if build-only).
- Deploy via existing `vite build` → `.netlify/v1/functions/server.mjs` → Netlify auto.
- Origin Trial token: add `<meta http-equiv="Origin-Trial" content="TOKEN">` in `__root.tsx` head when available; else `chrome://flags/#enable-webmcp-testing` for local.
- Sunset note in `/agent-tools:44` UI: “32 tools (7 core, 25 deprecated aliases — sunset in 2 milestones)”.

## Open Risks Carried to B

- No pagination/cursor on 6 list tools — large `get_inventory_movements limit 50` could still bloat; B adds cursor.
- No idempotency key — duplicate draft PO on retry possible; documented, B adds `UNIQUE`.
- Elicitation still prose — agent could mis-infer approval; B adds `elicitation/create`.

## Verification Checklist (what eng review will check)

- `npm run build` green, `document.modelContext.getTools()` returns 32 with 4 annotations each, `inputSchema.additionalProperties===false`, `outputSchema` on 1+ tool, `isError` on `productId: -1`.
- `approve_agent_action` without auth → 403, not impersonated.
- `receiveShipment` half-failure impossible (transaction).
- `AGENTS.md`/`README` count 32.

## Next Steps if Locked

Implement in 2 commits: (1) `feat(webmcp): code-gen schemas + 4 annotations + isError contract` (2) `fix(inventory): server gate + transactions + provider robustness + docs 12→32`. Then run `/qa-only` on Chrome 149 flag + `/ship`.

