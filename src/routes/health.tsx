import { createFileRoute, Link } from '@tanstack/react-router'
import { PackageX } from 'lucide-react'
import { findDeadStockFn, getInventoryHealthCheckFn, whatShouldIWorryAboutFn } from '../server/inventory.functions.js'
import { formatMoney } from '../server/format.js'
import { SeverityBadge } from '../components/badges.js'

export const Route = createFileRoute('/health')({
  component: HealthPage,
  loader: async () => {
    const [health, worryAbout, deadStock] = await Promise.all([
      getInventoryHealthCheckFn(),
      whatShouldIWorryAboutFn(),
      findDeadStockFn({ data: {} }),
    ])
    return { health, worryAbout, deadStock }
  },
})

function HealthPage() {
  const { health, worryAbout, deadStock } = Route.useLoaderData()
  const totalDeadCapitalCents = deadStock.reduce((sum, d) => sum + d.capitalTiedUpCents, 0)

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-24">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 mb-1 tracking-tight">Inventory Health</h1>
        <p className="text-sm text-slate-500">{worryAbout.summary}</p>
      </div>

      {/* Severity KPI bar */}
      <div className="panel overflow-hidden mb-8">
        <div className="grid grid-cols-3 divide-x divide-slate-200">
          <div className="px-5 py-4">
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-red-500" /> High severity
            </p>
            <p className="text-3xl font-bold text-red-600 mt-1 tabular-nums">{health.highSeverityCount}</p>
            <p className="text-xs text-slate-500 mt-0.5">immediate action</p>
          </div>
          <div className="px-5 py-4">
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-orange-500" /> Medium severity
            </p>
            <p className="text-3xl font-bold text-orange-600 mt-1 tabular-nums">{health.mediumSeverityCount}</p>
            <p className="text-xs text-slate-500 mt-0.5">plan soon</p>
          </div>
          <div className="px-5 py-4">
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-500" /> Low severity
            </p>
            <p className="text-3xl font-bold text-amber-600 mt-1 tabular-nums">{health.lowSeverityCount}</p>
            <p className="text-xs text-slate-500 mt-0.5">monitor</p>
          </div>
        </div>
      </div>

      {/* What to worry about */}
      <div className="flex items-center gap-2 mb-3">
        <div className="w-1 h-5 bg-red-500 rounded-full" />
        <h2 className="text-sm font-semibold text-slate-900">What needs attention</h2>
        <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{worryAbout.items.length}</span>
      </div>
      <div className="space-y-2 mb-8">
        {worryAbout.items.map((item, idx) => (
          <div
            key={idx}
            data-product-id={item.productId}
            className="panel p-4 flex items-center justify-between gap-4 transition-all duration-300"
          >
            <div className="flex items-start gap-3 min-w-0">
              <span className="text-xs font-mono bg-slate-100 text-slate-600 w-6 h-6 rounded-full flex items-center justify-center shrink-0">{idx + 1}</span>
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-900">{item.description}</p>
                <p className="text-xs text-slate-500 mt-1">{item.recommendation}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <SeverityBadge severity={item.severity} />
              {item.productId && (
                <Link to="/products/$productId" params={{ productId: String(item.productId) }} className="text-xs bg-blue-600 text-white px-2.5 py-1 rounded-lg hover:bg-blue-700">
                  View
                </Link>
              )}
            </div>
          </div>
        ))}
        {worryAbout.items.length === 0 && (
          <div className="panel p-8 text-center bg-emerald-50/30 border-emerald-200/50">
            <p className="text-sm text-emerald-700 font-medium">Inventory is healthy — nothing to worry about.</p>
          </div>
        )}
      </div>

      {/* All issues */}
      <div className="flex items-center gap-2 mb-3">
        <div className="w-1 h-5 bg-slate-700 rounded-full" />
        <h2 className="text-sm font-semibold text-slate-900">All issues</h2>
        <span className="text-xs bg-slate-900 text-white px-2 py-0.5 rounded-full">{health.totalIssues}</span>
      </div>
      <div className="panel panel-shadow overflow-hidden mb-8">
        <div className="card-header-slate px-5 py-3">
          <p className="text-xs font-semibold text-slate-700 uppercase tracking-wider">Issues requiring attention</p>
        </div>
        <div className="overflow-x-auto scrollbar-none">
          <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-100 bg-slate-50/40">
              <th className="px-5 py-3">Type</th>
              <th className="px-5 py-3">Severity</th>
              <th className="px-5 py-3">Description</th>
              <th className="px-5 py-3">Recommendation</th>
            </tr>
          </thead>
          <tbody>
            {health.issues.map((issue, idx) => (
              <tr key={idx} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50">
                <td className="px-5 py-3 text-slate-600 capitalize whitespace-nowrap text-xs font-semibold bg-slate-50/30">{issue.type.replace(/_/g, ' ')}</td>
                <td className="px-5 py-3">
                  <SeverityBadge severity={issue.severity} />
                </td>
                <td className="px-5 py-3 text-slate-700">{issue.description}</td>
                <td className="px-5 py-3 text-slate-500 text-xs">{issue.recommendation}</td>
              </tr>
            ))}
            {health.issues.length === 0 && (
              <tr>
                <td colSpan={4} className="py-12 text-center text-slate-400">
                  No issues found.
                </td>
              </tr>
            )}
          </tbody>
          </table>
        </div>
      </div>

      {/* Dead stock */}
      <div className="flex items-center gap-2 mb-3">
        <PackageX className="w-4 h-4 text-slate-400" />
        <h2 className="text-sm font-semibold text-slate-900">Dead Stock</h2>
        {totalDeadCapitalCents > 0 && (
          <span className="text-xs bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full font-medium">{formatMoney(totalDeadCapitalCents)} tied up</span>
        )}
      </div>
      <div className="panel panel-shadow overflow-hidden">
        <div className="card-header-amber px-5 py-3 flex items-center gap-2">
          <PackageX className="w-4 h-4 text-amber-600" />
          <p className="text-xs font-semibold text-slate-700 uppercase tracking-wider">Dead stock — capital tied up</p>
        </div>
        <div className="overflow-x-auto scrollbar-none">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200 bg-amber-50/30">
              <th className="px-5 py-3">Product</th>
              <th className="px-5 py-3">Category</th>
              <th className="px-5 py-3">Quantity</th>
              <th className="px-5 py-3">Days stale</th>
              <th className="px-5 py-3 text-right">Capital tied up</th>
            </tr>
          </thead>
          <tbody>
            {deadStock.map((d) => (
              <tr key={d.productId} data-product-id={d.productId} className="border-b border-slate-50 last:border-0 hover:bg-amber-50/20 transition-all duration-300">
                <td className="px-5 py-3">
                  <Link to="/products/$productId" params={{ productId: String(d.productId) }} className="font-medium text-slate-900 hover:text-blue-600">
                    {d.name}
                  </Link>
                  <div className="text-xs text-slate-400 font-mono">{d.sku}</div>
                </td>
                <td className="px-5 py-3 text-slate-500">{d.category}</td>
                <td className="px-5 py-3 text-slate-600 font-medium">{d.quantity}</td>
                <td className="px-5 py-3 text-amber-700 font-medium">{d.daysStale}d+</td>
                <td className="px-5 py-3 text-right font-semibold text-slate-900">{formatMoney(d.capitalTiedUpCents)}</td>
              </tr>
            ))}
            {deadStock.length === 0 && (
              <tr>
                <td colSpan={5} className="py-12 text-center text-slate-400">
                  No dead stock detected.
                </td>
              </tr>
            )}
          </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
