import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { compareSuppliersFn, getSupplierIntelligenceFn, searchProductsFn } from '../server/inventory.functions.js'
import { formatMoney } from '../server/format.js'
import { Badge } from '../components/ui/Badge.js'

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
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 mb-1 tracking-tight" style={{ fontFamily: 'var(--font-heading)' }}>Suppliers</h1>
        <p className="text-sm text-slate-500">Reliability metrics from real purchase order history — never estimated.</p>
      </div>

      <div className="panel panel-shadow overflow-hidden mb-8">
        <div className="card-header-slate px-5 py-3 flex items-center justify-between">
          <h2 className="text-xs font-semibold text-slate-700 uppercase tracking-wider" style={{ fontFamily: 'var(--font-heading)' }}>Supplier intelligence</h2>
          <Badge variant="default">{intelligence.length} suppliers</Badge>
        </div>
        <div className="overflow-x-auto scrollbar-none">
          <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-[var(--color-border)] bg-slate-50/60">
              <th className="px-5 py-3">Supplier</th>
              <th className="px-5 py-3">Lead time</th>
              <th className="px-5 py-3">Delay</th>
              <th className="px-5 py-3">On-time %</th>
              <th className="px-5 py-3">Avg delay</th>
              <th className="px-5 py-3">Active orders</th>
              <th className="px-5 py-3">Avg cost</th>
              <th className="px-5 py-3">Reliability</th>
            </tr>
          </thead>
          <tbody>
            {intelligence.map((s) => (
              <tr key={s.supplierId} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/40">
                <td className="px-5 py-3.5 font-semibold text-slate-900">{s.name}</td>
                <td className="px-5 py-3.5 text-slate-600">{s.leadTimeDays}d</td>
                <td className="px-5 py-3.5 text-slate-600">{s.delayDays > 0 ? `+${s.delayDays}d` : '—'}</td>
                <td className="px-5 py-3.5 text-slate-600">{s.onTimePct !== null ? `${s.onTimePct}%` : 'n/a'}</td>
                <td className="px-5 py-3.5 text-slate-600">{s.avgDelayDays !== null ? `${s.avgDelayDays}d` : '—'}</td>
                <td className="px-5 py-3.5 text-slate-600"><Badge variant="default">{s.activeOrders}</Badge></td>
                <td className="px-5 py-3.5 text-slate-600">{s.avgCostCents !== null ? formatMoney(s.avgCostCents) : '—'}</td>
                <td className="px-5 py-3.5">
                  {s.reliabilityScore !== null ? (
                    <Badge variant={s.reliabilityScore >= 70 ? 'emerald' : s.reliabilityScore >= 40 ? 'amber' : 'red'}>
                      {s.reliabilityScore}/100
                    </Badge>
                  ) : (
                    <span className="text-slate-400 text-xs">no history</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
          </table>
        </div>
      </div>

      <div className="panel panel-shadow overflow-hidden">
        <div className="card-header-violet px-5 py-4">
          <h2 className="text-sm font-semibold text-slate-900" style={{ fontFamily: 'var(--font-heading)' }}>Compare suppliers</h2>
          <p className="text-xs text-slate-500">Side-by-side cost, lead time, and reliability for a specific product.</p>
        </div>
        <div className="p-5">
        <select
          value={productId}
          onChange={(e) => void handleSelect(e.target.value)}
          className="input max-w-md mb-4"
          style={{ fontFamily: 'var(--font-body)' }}
        >
          <option value="">Select a product…</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} ({p.sku})
            </option>
          ))}
        </select>

        {loading && <p className="text-sm text-slate-400">Comparing…</p>}

        {comparison && !loading && (
          <div>
            {comparison.recommendationReason && (
              <p className="text-sm bg-blue-50 text-blue-800 px-4 py-3 rounded-xl mb-4 border border-blue-200">{comparison.recommendationReason}</p>
            )}
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-[var(--color-border)]">
                  <th className="py-2.5 pr-2">Supplier</th>
                  <th className="py-2.5 pr-2">Unit cost</th>
                  <th className="py-2.5 pr-2">Lead time (+ delay)</th>
                  <th className="py-2.5 pr-2">Reliability</th>
                  <th className="py-2.5 pr-2"></th>
                </tr>
              </thead>
              <tbody>
                {comparison.options.map((o) => (
                  <tr key={o.supplierId} className="border-b border-slate-50 last:border-0">
                    <td className="py-3 pr-2 font-medium text-slate-900">
                      {o.supplierName}
                      {o.isPrimary && <span className="text-xs text-slate-400 ml-1">(primary)</span>}
                    </td>
                    <td className="py-3 pr-2 text-slate-600">{formatMoney(o.unitCostCents)}</td>
                    <td className="py-3 pr-2 text-slate-600">{o.totalLeadDays}d</td>
                    <td className="py-3 pr-2 text-slate-600">{o.reliabilityScore !== null ? `${o.reliabilityScore}/100` : 'n/a'}</td>
                    <td className="py-3 pr-2">
                      {o.supplierId === comparison.recommendedSupplierId && (
                        <Badge variant="emerald">Recommended</Badge>
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
    </div>
  )
}
