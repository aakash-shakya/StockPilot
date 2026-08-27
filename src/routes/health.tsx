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
      <h1 className="text-3xl font-bold text-gray-900 mb-1">Inventory Health Check</h1>
      <p className="text-gray-500 mb-8">{worryAbout.summary}</p>

      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="panel panel-shadow p-4">
          <p className="text-xs text-gray-500">High severity</p>
          <p className="text-2xl font-bold text-red-600">{health.highSeverityCount}</p>
        </div>
        <div className="panel panel-shadow p-4">
          <p className="text-xs text-gray-500">Medium severity</p>
          <p className="text-2xl font-bold text-orange-600">{health.mediumSeverityCount}</p>
        </div>
        <div className="panel panel-shadow p-4">
          <p className="text-xs text-gray-500">Low severity</p>
          <p className="text-2xl font-bold text-amber-600">{health.lowSeverityCount}</p>
        </div>
      </div>

      <h2 className="text-lg font-semibold text-gray-900 mb-3">What should I worry about today?</h2>
      <div className="space-y-2 mb-8">
        {worryAbout.items.map((item, idx) => (
          <div key={idx} className="panel panel-shadow p-4 flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <span className="text-xs font-mono text-gray-400 mt-0.5 w-4 shrink-0">{idx + 1}</span>
              <div>
                <p className="text-sm text-gray-900">{item.description}</p>
                <p className="text-xs text-gray-500 mt-0.5">{item.recommendation}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <SeverityBadge severity={item.severity} />
              {item.productId && (
                <Link to="/products/$productId" params={{ productId: String(item.productId) }} className="text-xs text-blue-600 hover:underline">
                  View
                </Link>
              )}
            </div>
          </div>
        ))}
        {worryAbout.items.length === 0 && <p className="text-sm text-gray-500">Nothing to worry about — inventory is healthy.</p>}
      </div>

      <h2 className="text-lg font-semibold text-gray-900 mb-3">All issues ({health.totalIssues})</h2>
      <div className="panel panel-shadow overflow-hidden mb-8">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 border-b bg-gray-50">
              <th className="py-2.5 px-4">Type</th>
              <th className="py-2.5 px-4">Severity</th>
              <th className="py-2.5 px-4">Description</th>
              <th className="py-2.5 px-4">Recommendation</th>
            </tr>
          </thead>
          <tbody>
            {health.issues.map((issue, idx) => (
              <tr key={idx} className="border-b last:border-0">
                <td className="py-2.5 px-4 text-gray-500 capitalize whitespace-nowrap">{issue.type.replace(/_/g, ' ')}</td>
                <td className="py-2.5 px-4">
                  <SeverityBadge severity={issue.severity} />
                </td>
                <td className="py-2.5 px-4 text-gray-700">{issue.description}</td>
                <td className="py-2.5 px-4 text-gray-500">{issue.recommendation}</td>
              </tr>
            ))}
            {health.issues.length === 0 && (
              <tr>
                <td colSpan={4} className="py-8 text-center text-gray-400">
                  No issues found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center gap-2 mb-3">
        <PackageX className="w-5 h-5 text-gray-400" />
        <h2 className="text-lg font-semibold text-gray-900">Dead Stock Hunter</h2>
        <span className="text-sm text-gray-400">— {formatMoney(totalDeadCapitalCents)} tied up</span>
      </div>
      <div className="panel panel-shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 border-b bg-gray-50">
              <th className="py-2.5 px-4">Product</th>
              <th className="py-2.5 px-4">Category</th>
              <th className="py-2.5 px-4">Quantity</th>
              <th className="py-2.5 px-4">Days stale</th>
              <th className="py-2.5 px-4">Capital tied up</th>
            </tr>
          </thead>
          <tbody>
            {deadStock.map((d) => (
              <tr key={d.productId} className="border-b last:border-0">
                <td className="py-2.5 px-4">
                  <Link to="/products/$productId" params={{ productId: String(d.productId) }} className="font-medium text-gray-900 hover:text-blue-600">
                    {d.name}
                  </Link>
                  <div className="text-xs text-gray-400">{d.sku}</div>
                </td>
                <td className="py-2.5 px-4 text-gray-500">{d.category}</td>
                <td className="py-2.5 px-4 text-gray-500">{d.quantity}</td>
                <td className="py-2.5 px-4 text-gray-500">{d.daysStale}d+</td>
                <td className="py-2.5 px-4 font-medium text-gray-900">{formatMoney(d.capitalTiedUpCents)}</td>
              </tr>
            ))}
            {deadStock.length === 0 && (
              <tr>
                <td colSpan={5} className="py-8 text-center text-gray-400">
                  <AlertOctagon className="w-5 h-5 mx-auto mb-1 text-gray-300" />
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
