import { createFileRoute, Link } from '@tanstack/react-router'
import { ArrowRight, Boxes, HeartPulse, ShieldCheck, Trophy } from 'lucide-react'
import {
  findLowStockFn,
  getInventorySummaryFn,
  getMissionStatusFn,
  getPurchaseOrdersFn,
  getRecentAgentActivityFn,
  listAgentActionsFn,
  whatShouldIWorryAboutFn,
} from '../server/inventory.functions.js'
import { formatMoney } from '../server/format.js'
import { RiskBadge, TrendLabel, PoStatusBadge, SeverityBadge } from '../components/badges.js'

export const Route = createFileRoute('/')({
  component: Dashboard,
  loader: async () => {
    const [summary, atRisk, purchaseOrders, recentActivity, worryAbout, pendingActions, mission] = await Promise.all([
      getInventorySummaryFn(),
      findLowStockFn({ data: { days: 7 } }),
      getPurchaseOrdersFn(),
      getRecentAgentActivityFn({ data: { limit: 8 } }),
      whatShouldIWorryAboutFn(),
      listAgentActionsFn({ data: { status: 'pending' } }),
      getMissionStatusFn(),
    ])
    return { summary, atRisk, purchaseOrders, recentActivity, worryAbout, pendingActions, mission }
  },
})

function Dashboard() {
  const { summary, atRisk, purchaseOrders, recentActivity, worryAbout, pendingActions, mission } = Route.useLoaderData()
  const actionable = purchaseOrders.filter((po) => po.status !== 'received').slice(0, 5)

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-24">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900 mb-1 tracking-tight">Inventory overview</h1>
        <p className="text-sm text-slate-500">
          Real-time data shared with WebMCP tools — agents and this dashboard read and write the same state.
        </p>
      </div>

      {/* KPI bar — single row, no card mosaic */}
      <div className="panel overflow-hidden mb-8 divide-y-0">
        <div className="grid grid-cols-2 lg:grid-cols-4 divide-x divide-slate-200">
          <div className="px-5 py-4">
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Products</p>
            <p className="text-2xl font-bold text-slate-900 tracking-tight mt-1 tabular-nums">{summary.totalProducts}</p>
            <p className="text-[11px] text-slate-500 mt-0.5">{summary.totalUnits} units on hand</p>
          </div>
          <div className="px-5 py-4">
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-red-500" /> Critical
            </p>
            <p className="text-2xl font-bold text-red-600 tracking-tight mt-1 tabular-nums">{summary.criticalCount}</p>
            <p className="text-[11px] text-slate-500 mt-0.5">≤2 days of stock left</p>
          </div>
          <div className="px-5 py-4">
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-500" /> Warning
            </p>
            <p className="text-2xl font-bold text-amber-600 tracking-tight mt-1 tabular-nums">{summary.warningCount}</p>
            <p className="text-[11px] text-slate-500 mt-0.5">below reorder point</p>
          </div>
          <div className="px-5 py-4">
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Avg. Coverage</p>
            <p className="text-2xl font-bold text-slate-900 tracking-tight mt-1 tabular-nums">
              {summary.avgCoverageDays !== null ? `${summary.avgCoverageDays}d` : '—'}
            </p>
            <p className="text-[11px] text-slate-500 mt-0.5">across all products</p>
          </div>
        </div>
      </div>

      {/* Main content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Worry about - elevated with header */}
        <div className="lg:col-span-2 panel panel-shadow overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 card-header-red">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-red-500 flex items-center justify-center shadow-sm ring-1 ring-red-600/20">
                <HeartPulse className="w-4 h-4 text-white" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-slate-900">What needs attention</h2>
                <p className="text-xs text-slate-500">{worryAbout.summary}</p>
              </div>
            </div>
            <Link to="/health" className="text-xs font-medium text-blue-600 hover:text-blue-700 flex items-center gap-1 bg-white px-2.5 py-1.5 rounded-lg border border-slate-200 hover:border-blue-200 shadow-sm">
              Full check <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="p-4">
            {worryAbout.items.length === 0 ? (
              <div className="text-center py-10">
                <div className="w-10 h-10 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-2">
                  <span className="text-emerald-600 text-lg">✓</span>
                </div>
                <p className="text-sm text-slate-500">All clear — nothing to worry about.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {worryAbout.items.slice(0, 4).map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between gap-3 text-sm py-2.5 px-3 rounded-xl border border-transparent hover:border-slate-200 hover:bg-slate-50/70">
                    <p className="text-slate-700">{item.description}</p>
                    <SeverityBadge severity={item.severity} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Agent Actions + Mission */}
        <div className="space-y-4">
          <div className="panel panel-shadow overflow-hidden">
            <div className="px-5 py-3.5 card-header-blue flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center shadow-sm ring-1 ring-blue-700/15">
                  <ShieldCheck className="w-4 h-4 text-white" />
                </div>
                <h2 className="text-sm font-semibold text-slate-900">Agent Actions</h2>
              </div>
              <Link to="/agent-actions" className="text-xs font-semibold text-blue-600 hover:text-blue-700 bg-white px-2.5 py-1 rounded-lg border border-blue-200 hover:border-blue-300 shadow-sm">
                Review →
              </Link>
            </div>
            <div className="p-5 bg-gradient-to-br from-blue-50/20 to-white">
              <p className="text-3xl font-bold text-slate-900 mb-1 tracking-tight">{pendingActions.length}</p>
              <p className="text-xs text-slate-500 font-medium">pending your approval</p>
            </div>
          </div>

          <div className="panel panel-shadow overflow-hidden">
            <div className="p-5 bg-gradient-to-br from-violet-50/60 to-white">
              <div className="flex items-center gap-3 mb-3.5">
                <div className="w-8 h-8 rounded-xl bg-violet-600 flex items-center justify-center shadow-sm ring-1 ring-violet-700/15">
                  <Trophy className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">{mission.title}</h2>
                  <p className="text-xs text-slate-500">{mission.completedCount}/{mission.totalCount} complete</p>
                </div>
              </div>
              <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden ring-1 ring-inset ring-slate-200/50">
                <div
                  className="h-full bg-gradient-to-r from-violet-600 to-indigo-600 rounded-full transition-all duration-500"
                  style={{ width: `${mission.percentComplete}%` }}
                />
              </div>
              <p className="text-xs text-violet-700 font-semibold mt-2.5">{mission.percentComplete}% complete</p>
            </div>
          </div>
        </div>
      </div>

      {/* At risk + Purchase orders */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 panel panel-shadow overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 card-header-amber">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">At risk of stocking out</h2>
              <p className="text-xs text-slate-500 mt-0.5">Within 7 days based on current velocity</p>
            </div>
            <Link to="/products" className="text-xs font-medium text-slate-600 hover:text-slate-900 flex items-center gap-1 bg-white px-2.5 py-1 rounded-lg border border-slate-200">
              All products <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          {atRisk.length === 0 ? (
            <div className="px-5 py-12 text-center">
              <div className="w-12 h-12 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-3">
                <span className="text-emerald-600 text-lg">✓</span>
              </div>
              <p className="text-sm text-slate-500">Everything looks healthy for the next 7 days.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-100 bg-slate-50/40">
                  <th className="px-5 py-3">Product</th>
                  <th className="px-5 py-3">Stock</th>
                  <th className="px-5 py-3">Coverage</th>
                  <th className="px-5 py-3">Trend</th>
                  <th className="px-5 py-3">Risk</th>
                </tr>
              </thead>
              <tbody>
                {atRisk.map((p) => (
                  <tr key={p.productId} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50">
                    <td className="px-5 py-3.5">
                      <Link to="/products/$productId" params={{ productId: String(p.productId) }} className="font-medium text-slate-900 hover:text-blue-600">
                        {p.name}
                      </Link>
                      <div className="text-xs text-slate-400 font-mono">{p.sku}</div>
                    </td>
                    <td className="px-5 py-3.5 font-semibold text-slate-900">{p.quantity}</td>
                    <td className="px-5 py-3.5 text-slate-600">{p.coverageDays !== null ? `${p.coverageDays}d` : '—'}</td>
                    <td className="px-5 py-3.5">
                      <TrendLabel trend={p.trend} />
                    </td>
                    <td className="px-5 py-3.5">
                      <RiskBadge level={p.riskLevel} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="panel panel-shadow overflow-hidden">
          <div className="px-5 py-4 card-header-slate flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">Purchase orders</h2>
            <Link to="/purchase-orders" className="text-xs font-semibold text-blue-600 hover:text-blue-700 bg-white px-2.5 py-1 rounded-lg border border-slate-200 hover:border-blue-200 shadow-sm">
              View all →
            </Link>
          </div>
          <div className="p-4">
            {actionable.length === 0 ? (
              <p className="text-sm text-slate-400 py-4 text-center">No open purchase orders.</p>
            ) : (
              <div className="space-y-1">
                {actionable.map((po) => (
                  <div key={po.id} className="flex items-center justify-between py-3 px-3 rounded-xl hover:bg-slate-50 border border-transparent hover:border-slate-100">
                    <div>
                      <div className="text-sm font-medium text-slate-900">{po.poNumber}</div>
                      <div className="text-xs text-slate-500">{po.supplierName}</div>
                    </div>
                    <div className="text-right">
                      <PoStatusBadge status={po.status} />
                      <div className="text-xs text-slate-500 mt-0.5 font-mono">{formatMoney(po.totalCostCents)}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* WebMCP info */}
      <div className="mt-6 panel panel-shadow p-4 flex items-start gap-3 bg-gradient-to-r from-blue-50/40 to-violet-50/30 border-blue-200/60">
        <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center shrink-0 shadow-sm">
          <Boxes className="w-4 h-4 text-slate-500" />
        </div>
        <p className="text-xs text-slate-600 leading-relaxed">
          Every metric here comes from the same server functions exposed as WebMCP tools. Connect a capable agent to
          this tab to check stockout risk, create purchase orders, and adjust inventory — calls appear in the activity
          panel live.
        </p>
      </div>

      {/* Recent agent activity */}
      {recentActivity.length > 0 && (
        <div className="mt-6 panel panel-shadow overflow-hidden">
          <div className="px-5 py-3.5 card-header-blue flex items-center gap-2">
            <Boxes className="w-4 h-4 text-blue-600" />
            <h2 className="text-sm font-semibold text-slate-900">Recent agent activity</h2>
            <span className="ml-auto text-xs bg-white border border-slate-200 text-slate-600 px-2 py-0.5 rounded-full font-medium">{recentActivity.length}</span>
          </div>
          <div className="p-2">
            {recentActivity.map((entry) => (
              <div key={entry.id} className="flex items-center justify-between text-sm py-2.5 px-3 rounded-lg hover:bg-slate-50">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-mono text-[11px] text-slate-600 shrink-0 bg-white border border-slate-200 px-1.5 py-0.5 rounded">{entry.toolName}</span>
                  <span className="text-slate-700 truncate">{entry.summary}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-4">
                  {entry.consequential && (
                    <span className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full font-medium">consequential</span>
                  )}
                  <span className="text-xs text-slate-400">
                    {entry.createdAt ? new Date(entry.createdAt).toLocaleString() : ''}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}


