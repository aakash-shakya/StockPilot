import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { compareSuppliersFn, getSupplierIntelligenceFn, searchProductsFn } from '../server/inventory.functions.js'
import { formatMoney } from '../server/format.js'

export const Route = createFileRoute('/suppliers')({
  component: SuppliersPage,
  loader: async () => {
    const [intelligence, products] = await Promise.all([getSupplierIntelligenceFn(), searchProductsFn({ data: {} })])
    return { intelligence, products }
  },
})

function SuppliersPage() {
  const { intelligence, products } = Route.useLoaderData()
  const [productId, setProductId] = useState<number | ''>('')
  const [comparison, setComparison] = useState<Awaited<ReturnType<typeof compareSuppliersFn>> | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSelect(id: string) {
    if (!id) {
      setProductId('')
      setComparison(null)
      return
    }
    const pid = Number(id)
    setProductId(pid)
    setLoading(true)
    try {
      const result = await compareSuppliersFn({ data: { productId: pid } })
      setComparison(result)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-24">
      <h1 className="text-3xl font-bold text-gray-900 mb-1">Supplier Intelligence</h1>
      <p className="text-gray-500 mb-8">Reliability metrics computed from real purchase order history — never estimated.</p>

      <div className="panel panel-shadow overflow-hidden mb-8">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 border-b bg-gray-50">
              <th className="py-2.5 px-4">Supplier</th>
              <th className="py-2.5 px-4">Lead time</th>
              <th className="py-2.5 px-4">Delay</th>
              <th className="py-2.5 px-4">On-time %</th>
              <th className="py-2.5 px-4">Avg delay</th>
              <th className="py-2.5 px-4">Active orders</th>
              <th className="py-2.5 px-4">Avg cost</th>
              <th className="py-2.5 px-4">Reliability</th>
            </tr>
          </thead>
          <tbody>
            {intelligence.map((s) => (
              <tr key={s.supplierId} className="border-b last:border-0">
                <td className="py-2.5 px-4 font-medium text-gray-900">{s.name}</td>
                <td className="py-2.5 px-4 text-gray-500">{s.leadTimeDays}d</td>
                <td className="py-2.5 px-4 text-gray-500">{s.delayDays > 0 ? `+${s.delayDays}d` : '—'}</td>
                <td className="py-2.5 px-4 text-gray-500">{s.onTimePct !== null ? `${s.onTimePct}%` : 'n/a'}</td>
                <td className="py-2.5 px-4 text-gray-500">{s.avgDelayDays !== null ? `${s.avgDelayDays}d` : '—'}</td>
                <td className="py-2.5 px-4 text-gray-500">{s.activeOrders}</td>
                <td className="py-2.5 px-4 text-gray-500">{s.avgCostCents !== null ? formatMoney(s.avgCostCents) : '—'}</td>
                <td className="py-2.5 px-4">
                  {s.reliabilityScore !== null ? (
                    <span
                      className={`font-medium ${s.reliabilityScore >= 70 ? 'text-emerald-600' : s.reliabilityScore >= 40 ? 'text-amber-600' : 'text-red-600'}`}
                    >
                      {s.reliabilityScore}/100
                    </span>
                  ) : (
                    <span className="text-gray-400">no history</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="panel panel-shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Compare suppliers for a product</h2>
        <p className="text-sm text-gray-500 mb-4">Useful before drafting an urgent order — see cost, lead time, and reliability side by side.</p>
        <select
          value={productId}
          onChange={(e) => void handleSelect(e.target.value)}
          className="w-full max-w-md px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
        >
          <option value="">Select a product…</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} ({p.sku})
            </option>
          ))}
        </select>

        {loading && <p className="text-sm text-gray-400">Comparing…</p>}

        {comparison && !loading && (
          <div>
            {comparison.recommendationReason && (
              <p className="text-sm bg-blue-50 text-blue-700 px-4 py-2 rounded-lg mb-4">{comparison.recommendationReason}</p>
            )}
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b">
                  <th className="py-2 pr-2">Supplier</th>
                  <th className="py-2 pr-2">Unit cost</th>
                  <th className="py-2 pr-2">Lead time (+ delay)</th>
                  <th className="py-2 pr-2">Reliability</th>
                  <th className="py-2 pr-2"></th>
                </tr>
              </thead>
              <tbody>
                {comparison.options.map((o) => (
                  <tr key={o.supplierId} className="border-b last:border-0">
                    <td className="py-2 pr-2 font-medium text-gray-900">
                      {o.supplierName}
                      {o.isPrimary && <span className="text-xs text-gray-400 ml-1">(primary)</span>}
                    </td>
                    <td className="py-2 pr-2 text-gray-600">{formatMoney(o.unitCostCents)}</td>
                    <td className="py-2 pr-2 text-gray-600">{o.totalLeadDays}d</td>
                    <td className="py-2 pr-2 text-gray-600">{o.reliabilityScore !== null ? `${o.reliabilityScore}/100` : 'n/a'}</td>
                    <td className="py-2 pr-2">
                      {o.supplierId === comparison.recommendedSupplierId && (
                        <span className="text-xs text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">Recommended</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
