import { createFileRoute, Link } from '@tanstack/react-router'
import { AlertTriangle, Boxes, Package, TimerReset } from 'lucide-react'
import { findLowStockFn, getInventorySummaryFn, getPurchaseOrdersFn, getRecentAgentActivityFn } from '../server/inventory.functions.js'
import { formatMoney } from '../server/format.js'
import { RiskBadge, TrendLabel, PoStatusBadge } from '../components/badges.js'

export const Route = createFileRoute('/')({
  component: Dashboard,
  loader: async () => {
    const [summary, atRisk, purchaseOrders, recentActivity] = await Promise.all([
      getInventorySummaryFn(),
      findLowStockFn({ data: { days: 7 } }),
      getPurchaseOrdersFn(),
      getRecentAgentActivityFn({ data: { limit: 8 } }),
    ])
    return { summary, atRisk, purchaseOrders, recentActivity }
  },
})

function Dashboard() {
  const { summary, atRisk, purchaseOrders, recentActivity } = Route.useLoaderData()
  const actionable = purchaseOrders.filter((po) => po.status !== 'received').slice(0, 5)

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-24">
      <h1 className="text-3xl font-bold text-gray-900 mb-1">Inventory Health</h1>
      <p className="text-gray-500 mb-8">
        Shared with the WebMCP tools below — this dashboard and any connected agent read and write the same
        data.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard icon={Package} color="bg-blue-500" title="Products" value={String(summary.totalProducts)} sub={`${summary.totalUnits} units on hand`} />
        <StatCard icon={AlertTriangle} color="bg-red-500" title="Critical" value={String(summary.criticalCount)} sub="≤2 days of stock left" />
        <StatCard icon={AlertTriangle} color="bg-amber-500" title="Warning" value={String(summary.warningCount)} sub="at or below reorder point" />
        <StatCard
          icon={TimerReset}
          color="bg-violet-500"
          title="Avg. Coverage"
          value={summary.avgCoverageDays !== null ? `${summary.avgCoverageDays}d` : '—'}
          sub="across all products"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">At risk of stocking out</h2>
            <Link to="/products" className="text-sm text-blue-600 hover:underline">
              View all products
            </Link>
          </div>
          {atRisk.length === 0 ? (
            <p className="text-sm text-gray-500">Nothing at risk within 7 days. Everything is healthy.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b">
                  <th className="py-2 pr-2">Product</th>
                  <th className="py-2 pr-2">Stock</th>
                  <th className="py-2 pr-2">Coverage</th>
                  <th className="py-2 pr-2">Trend</th>
                  <th className="py-2 pr-2">Risk</th>
                </tr>
              </thead>
              <tbody>
                {atRisk.map((p) => (
                  <tr key={p.productId} className="border-b last:border-0">
                    <td className="py-2 pr-2">
                      <Link to="/products/$productId" params={{ productId: String(p.productId) }} className="font-medium text-gray-900 hover:text-blue-600">
                        {p.name}
                      </Link>
                      <div className="text-xs text-gray-400">{p.sku}</div>
                    </td>
                    <td className="py-2 pr-2">{p.quantity}</td>
                    <td className="py-2 pr-2">{p.coverageDays !== null ? `${p.coverageDays}d` : '—'}</td>
                    <td className="py-2 pr-2">
                      <TrendLabel trend={p.trend} />
                    </td>
                    <td className="py-2 pr-2">
                      <RiskBadge level={p.riskLevel} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Purchase orders</h2>
            <Link to="/purchase-orders" className="text-sm text-blue-600 hover:underline">
              View all
            </Link>
          </div>
          {actionable.length === 0 ? (
            <p className="text-sm text-gray-500">No open purchase orders.</p>
          ) : (
            <div className="space-y-3">
              {actionable.map((po) => (
                <div key={po.id} className="flex items-center justify-between text-sm">
                  <div>
                    <div className="font-medium text-gray-900">{po.poNumber}</div>
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

      <div className="mt-6 bg-white rounded-xl shadow-sm p-6 flex items-start gap-3">
        <Boxes className="w-5 h-5 text-gray-400 shrink-0 mt-0.5" />
        <p className="text-sm text-gray-500">
          Every number here comes from the same server functions StockPilot exposes as WebMCP tools
          (<code className="text-xs bg-gray-100 px-1 rounded">find_low_stock</code>,{' '}
          <code className="text-xs bg-gray-100 px-1 rounded">analyze_stock_risk</code>,{' '}
          <code className="text-xs bg-gray-100 px-1 rounded">recommend_reorder</code>). Connect a WebMCP-capable
          agent to this tab and ask it to check for stockout risk — its tool calls will show up in the Agent
          Activity panel and this page will update live as it acts.
        </p>
      </div>

      {recentActivity.length > 0 && (
        <div className="mt-6 bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Recent agent activity (persisted)</h2>
          <div className="space-y-2">
            {recentActivity.map((entry) => (
              <div key={entry.id} className="flex items-center justify-between text-sm border-b last:border-0 pb-2 last:pb-0">
                <div>
                  <span className="font-mono text-xs text-gray-400 mr-2">{entry.toolName}</span>
                  <span className="text-gray-700">{entry.summary}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {entry.consequential && (
                    <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">consequential</span>
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
  title,
  value,
  sub,
}: {
  icon: typeof Package
  color: string
  title: string
  value: string
  sub: string
}) {
  return (
    <div className="bg-white rounded-xl shadow-sm p-6 flex items-center gap-4">
      <div className={`${color} p-3 rounded-lg`}>
        <Icon className="w-6 h-6 text-white" />
      </div>
      <div>
        <p className="text-sm text-gray-500">{title}</p>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
        <p className="text-xs text-gray-400">{sub}</p>
      </div>
    </div>
  )
}
