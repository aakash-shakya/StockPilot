import { createFileRoute, Link } from '@tanstack/react-router'
import { AlertTriangle, ArrowRight, Boxes, HeartPulse, Package, ShieldCheck, TimerReset, Trophy } from 'lucide-react'
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
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Inventory overview</h1>
        <p className="text-sm text-gray-500">
          Real-time data shared with WebMCP tools — agents and this dashboard read and write the same state.
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard icon={Package} color="text-blue-600" bg="bg-blue-50" title="Products" value={String(summary.totalProducts)} sub={`${summary.totalUnits} units on hand`} />
        <StatCard icon={AlertTriangle} color="text-red-600" bg="bg-red-50" title="Critical" value={String(summary.criticalCount)} sub="≤2 days of stock left" />
        <StatCard icon={AlertTriangle} color="text-amber-600" bg="bg-amber-50" title="Warning" value={String(summary.warningCount)} sub="below reorder point" />
        <StatCard
          icon={TimerReset}
          color="text-violet-600"
          bg="bg-violet-50"
          title="Avg. Coverage"
          value={summary.avgCoverageDays !== null ? `${summary.avgCoverageDays}d` : '—'}
          sub="across all products"
        />
      </div>

      {/* Main content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Worry about */}
        <div className="lg:col-span-2 panel panel-shadow p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center">
                <HeartPulse className="w-4 h-4 text-red-600" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-gray-900">What needs attention</h2>
                <p className="text-xs text-gray-400">{worryAbout.summary}</p>
              </div>
            </div>
            <Link to="/health" className="text-xs font-medium text-blue-600 hover:text-blue-700 flex items-center gap-1">
              Full check <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          {worryAbout.items.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-sm text-gray-400">All clear — nothing to worry about.</p>
            </div>
          ) : (
            <div className="space-y-1">
              {worryAbout.items.slice(0, 4).map((item, idx) => (
                <div key={idx} className="flex items-center justify-between gap-3 text-sm py-2 px-3 rounded-lg hover:bg-gray-50">
                  <p className="text-gray-700">{item.description}</p>
                  <SeverityBadge severity={item.severity} />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Agent Actions + Mission */}
        <div className="space-y-4">
          <div className="panel panel-shadow p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                  <ShieldCheck className="w-4 h-4 text-blue-600" />
                </div>
                <h2 className="text-sm font-semibold text-gray-900">Agent Actions</h2>
              </div>
              <Link to="/agent-actions" className="text-xs font-medium text-blue-600 hover:text-blue-700">
                Review
              </Link>
            </div>
            <p className="text-3xl font-bold text-gray-900 mb-0.5">{pendingActions.length}</p>
            <p className="text-xs text-gray-400">pending your approval</p>
          </div>

          <div className="panel panel-shadow p-5">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg bg-violet-50 flex items-center justify-center">
                <Trophy className="w-4 h-4 text-violet-600" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-gray-900">{mission.title}</h2>
                <p className="text-xs text-gray-400">{mission.completedCount}/{mission.totalCount} complete</p>
              </div>
            </div>
            <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-violet-500 rounded-full transition-all duration-500"
                style={{ width: `${mission.percentComplete}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* At risk + Purchase orders */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 panel panel-shadow overflow-hidden">
          <div className="flex items-center justify-between px-5 pt-5 pb-3">
            <div>
              <h2 className="text-sm font-semibold text-gray-900">At risk of stocking out</h2>
              <p className="text-xs text-gray-400 mt-0.5">Within 7 days based on current velocity</p>
            </div>
            <Link to="/products" className="text-xs font-medium text-blue-600 hover:text-blue-700 flex items-center gap-1">
              All products <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          {atRisk.length === 0 ? (
            <div className="px-5 pb-5">
              <p className="text-sm text-gray-400">Everything looks healthy for the next 7 days.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider border-b border-gray-100">
                  <th className="px-5 py-2.5">Product</th>
                  <th className="px-5 py-2.5">Stock</th>
                  <th className="px-5 py-2.5">Coverage</th>
                  <th className="px-5 py-2.5">Trend</th>
                  <th className="px-5 py-2.5">Risk</th>
                </tr>
              </thead>
              <tbody>
                {atRisk.map((p) => (
                  <tr key={p.productId} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50">
                    <td className="px-5 py-3">
                      <Link to="/products/$productId" params={{ productId: String(p.productId) }} className="font-medium text-gray-900 hover:text-blue-600">
                        {p.name}
                      </Link>
                      <div className="text-xs text-gray-400 font-mono">{p.sku}</div>
                    </td>
                    <td className="px-5 py-3 font-medium text-gray-900">{p.quantity}</td>
                    <td className="px-5 py-3 text-gray-600">{p.coverageDays !== null ? `${p.coverageDays}d` : '—'}</td>
                    <td className="px-5 py-3">
                      <TrendLabel trend={p.trend} />
                    </td>
                    <td className="px-5 py-3">
                      <RiskBadge level={p.riskLevel} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="panel panel-shadow p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-900">Purchase orders</h2>
            <Link to="/purchase-orders" className="text-xs font-medium text-blue-600 hover:text-blue-700 flex items-center gap-1">
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          {actionable.length === 0 ? (
            <p className="text-sm text-gray-400">No open purchase orders.</p>
          ) : (
            <div className="space-y-3">
              {actionable.map((po) => (
                <div key={po.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0 last:pb-0">
                  <div>
                    <div className="text-sm font-medium text-gray-900">{po.poNumber}</div>
                    <div className="text-xs text-gray-400">{po.supplierName}</div>
                  </div>
                  <div className="text-right">
                    <PoStatusBadge status={po.status} />
                    <div className="text-xs text-gray-400 mt-0.5">{formatMoney(po.totalCostCents)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* WebMCP info */}
      <div className="mt-6 panel panel-shadow p-4 flex items-start gap-3">
        <Boxes className="w-4 h-4 text-gray-300 shrink-0 mt-0.5" />
        <p className="text-xs text-gray-400 leading-relaxed">
          Every metric here comes from the same server functions exposed as WebMCP tools. Connect a capable agent to
          this tab to check stockout risk, create purchase orders, and adjust inventory — calls appear in the activity
          panel live.
        </p>
      </div>

      {/* Recent agent activity */}
      {recentActivity.length > 0 && (
        <div className="mt-6 panel panel-shadow p-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">Recent agent activity</h2>
          <div className="space-y-0">
            {recentActivity.map((entry) => (
              <div key={entry.id} className="flex items-center justify-between text-sm py-2 border-b border-gray-50 last:border-0 last:pb-0">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-mono text-[11px] text-gray-400 shrink-0 bg-gray-50 px-1.5 py-0.5 rounded">{entry.toolName}</span>
                  <span className="text-gray-600 truncate">{entry.summary}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-4">
                  {entry.consequential && (
                    <span className="text-[11px] text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full font-medium">consequential</span>
                  )}
                  <span className="text-xs text-gray-400">
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

function StatCard({
  icon: Icon,
  color,
  bg,
  title,
  value,
  sub,
}: {
  icon: typeof Package
  color: string
  bg: string
  title: string
  value: string
  sub: string
}) {
  return (
    <div className="panel panel-shadow p-4">
      <div className="flex items-center gap-3">
        <div className={`${bg} ${color} p-2.5 rounded-lg`}>
          <Icon className="w-5 h-5" />
        </div>
        <div className="min-w-0">
          <p className="text-xs text-gray-400 font-medium">{title}</p>
          <p className="text-2xl font-bold text-gray-900 leading-tight">{value}</p>
          <p className="text-[11px] text-gray-400 truncate">{sub}</p>
        </div>
      </div>
    </div>
  )
}
