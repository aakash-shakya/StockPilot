import { createFileRoute, Link } from '@tanstack/react-router'
import { AlertOctagon, PackageX } from 'lucide-react'
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
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Inventory Health</h1>
        <p className="text-sm text-gray-500">{worryAbout.summary}</p>
      </div>

      {/* Severity stats */}
      <div className="grid grid-cols-3 gap-3 mb-8">
        <div className="panel panel-shadow p-4">
          <p className="text-[11px] text-gray-400 font-medium uppercase tracking-wider">High severity</p>
          <p className="text-2xl font-bold text-red-600 mt-1">{health.highSeverityCount}</p>
        </div>
        <div className="panel panel-shadow p-4">
          <p className="text-[11px] text-gray-400 font-medium uppercase tracking-wider">Medium severity</p>
          <p className="text-2xl font-bold text-orange-600 mt-1">{health.mediumSeverityCount}</p>
        </div>
        <div className="panel panel-shadow p-4">
          <p className="text-[11px] text-gray-400 font-medium uppercase tracking-wider">Low severity</p>
          <p className="text-2xl font-bold text-amber-600 mt-1">{health.lowSeverityCount}</p>
        </div>
      </div>

      {/* What to worry about */}
      <h2 className="text-sm font-semibold text-gray-900 mb-3">What needs attention</h2>
      <div className="space-y-2 mb-8">
        {worryAbout.items.map((item, idx) => (
          <div key={idx} className="panel panel-shadow p-4 flex items-center justify-between gap-4">
            <div className="flex items-start gap-3 min-w-0">
              <span className="text-xs font-mono text-gray-400 mt-0.5 w-5 shrink-0">{idx + 1}</span>
              <div className="min-w-0">
                <p className="text-sm text-gray-900">{item.description}</p>
                <p className="text-xs text-gray-400 mt-0.5">{item.recommendation}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <SeverityBadge severity={item.severity} />
              {item.productId && (
                <Link to="/products/$productId" params={{ productId: String(item.productId) }} className="text-xs text-blue-600 hover:text-blue-700 font-medium">
                  View
                </Link>
              )}
            </div>
          </div>
        ))}
        {worryAbout.items.length === 0 && (
          <div className="panel panel-shadow p-8 text-center">
            <p className="text-sm text-gray-400">Inventory is healthy — nothing to worry about.</p>
          </div>
        )}
      </div>

      {/* All issues */}
      <h2 className="text-sm font-semibold text-gray-900 mb-3">All issues ({health.totalIssues})</h2>
      <div className="panel panel-shadow overflow-hidden mb-8">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider border-b border-gray-100">
              <th className="px-5 py-3">Type</th>
              <th className="px-5 py-3">Severity</th>
              <th className="px-5 py-3">Description</th>
              <th className="px-5 py-3">Recommendation</th>
            </tr>
          </thead>
          <tbody>
            {health.issues.map((issue, idx) => (
              <tr key={idx} className="border-b border-gray-50 last:border-0">
                <td className="px-5 py-3 text-gray-500 capitalize whitespace-nowrap text-xs font-medium">{issue.type.replace(/_/g, ' ')}</td>
                <td className="px-5 py-3">
                  <SeverityBadge severity={issue.severity} />
                </td>
                <td className="px-5 py-3 text-gray-700">{issue.description}</td>
                <td className="px-5 py-3 text-gray-500 text-xs">{issue.recommendation}</td>
              </tr>
            ))}
            {health.issues.length === 0 && (
              <tr>
                <td colSpan={4} className="py-12 text-center text-gray-400">
                  No issues found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Dead stock */}
      <div className="flex items-center gap-2 mb-3">
        <PackageX className="w-4 h-4 text-gray-400" />
        <h2 className="text-sm font-semibold text-gray-900">Dead Stock</h2>
        {totalDeadCapitalCents > 0 && (
          <span className="text-xs text-gray-400">— {formatMoney(totalDeadCapitalCents)} tied up</span>
        )}
      </div>
      <div className="panel panel-shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider border-b border-gray-100">
              <th className="px-5 py-3">Product</th>
              <th className="px-5 py-3">Category</th>
              <th className="px-5 py-3">Quantity</th>
              <th className="px-5 py-3">Days stale</th>
              <th className="px-5 py-3 text-right">Capital tied up</th>
            </tr>
          </thead>
          <tbody>
            {deadStock.map((d) => (
              <tr key={d.productId} className="border-b border-gray-50 last:border-0">
                <td className="px-5 py-3">
                  <Link to="/products/$productId" params={{ productId: String(d.productId) }} className="font-medium text-gray-900 hover:text-blue-600">
                    {d.name}
                  </Link>
                  <div className="text-xs text-gray-400 font-mono">{d.sku}</div>
                </td>
                <td className="px-5 py-3 text-gray-500">{d.category}</td>
                <td className="px-5 py-3 text-gray-500">{d.quantity}</td>
                <td className="px-5 py-3 text-gray-500">{d.daysStale}d+</td>
                <td className="px-5 py-3 text-right font-medium text-gray-900">{formatMoney(d.capitalTiedUpCents)}</td>
              </tr>
            ))}
            {deadStock.length === 0 && (
              <tr>
                <td colSpan={5} className="py-12 text-center text-gray-400">
                  No dead stock detected.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
