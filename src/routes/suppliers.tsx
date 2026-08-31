import { useState } from 'react'
import { createFileRoute, useRouter } from '@tanstack/react-router'
import { Plus, X } from 'lucide-react'
import { compareSuppliersFn, createSupplierFn, getSupplierIntelligenceFn, searchProductsFn } from '../server/inventory.functions.js'
import { formatMoney } from '../server/format.js'
import { Badge } from '../components/ui/Badge.js'
import { Button } from '../components/ui/Button.js'
import { Card } from '../components/ui/Card.js'

export const Route = createFileRoute('/suppliers')({
  component: SuppliersPage,
  loader: async () => {
    const [intelligence, products] = await Promise.all([getSupplierIntelligenceFn(), searchProductsFn({ data: {} })])
    return { intelligence, products }
  },
})

function SuppliersPage() {
  const { intelligence, products } = Route.useLoaderData()
  const router = useRouter()
  const [productId, setProductId] = useState<number | ''>('')
  const [comparison, setComparison] = useState<Awaited<ReturnType<typeof compareSuppliersFn>> | null>(null)
  const [loading, setLoading] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)
  const [addForm, setAddForm] = useState({ name: '', contactEmail: '', leadTimeDays: '7', delayDays: '0', delayNote: '' })
  const [addLoading, setAddLoading] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)

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

  async function handleAddSupplier(e: React.FormEvent) {
    e.preventDefault()
    setAddError(null)
    setAddLoading(true)
    try {
      await createSupplierFn({
        data: {
          name: addForm.name,
          contactEmail: addForm.contactEmail,
          leadTimeDays: Number(addForm.leadTimeDays) || 7,
          delayDays: Number(addForm.delayDays) || 0,
          delayNote: addForm.delayNote || undefined,
        },
      })
      setShowAddModal(false)
      setAddForm({ name: '', contactEmail: '', leadTimeDays: '7', delayDays: '0', delayNote: '' })
      await router.invalidate()
    } catch (err) {
      setAddError(err instanceof Error ? err.message : 'Failed to add supplier')
    } finally {
      setAddLoading(false)
    }
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 mb-1 tracking-tight" style={{ fontFamily: 'var(--font-heading)' }}>Suppliers</h1>
        <p className="text-sm text-slate-500">Reliability metrics from real purchase order history — never estimated.</p>
      </div>

      <div className="panel panel-shadow overflow-hidden mb-8">
        <div className="card-header-slate px-5 py-3 flex items-center justify-between">
          <h2 className="text-xs font-semibold text-slate-700 uppercase tracking-wider" style={{ fontFamily: 'var(--font-heading)' }}>Supplier intelligence</h2>
          <div className="flex items-center gap-3">
            <Badge variant="default">{intelligence.length} suppliers</Badge>
            <Button variant="accent" size="sm" onClick={() => setShowAddModal(true)} icon={<Plus className="w-3.5 h-3.5" />}>
              Add Supplier
            </Button>
          </div>
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

      {/* Add Supplier Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowAddModal(false)} />
          <Card className="relative w-full max-w-lg mx-4 p-0 shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--color-border)]">
              <h3 className="text-base font-semibold text-slate-900" style={{ fontFamily: 'var(--font-heading)' }}>Add Supplier</h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleAddSupplier} className="p-5 space-y-4">
              {addError && (
                <div className="text-sm bg-red-50 text-red-700 px-3 py-2.5 rounded-lg border border-red-100">{addError}</div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="text-xs font-medium block mb-1 text-slate-600">Supplier name *</label>
                  <input
                    type="text"
                    value={addForm.name}
                    onChange={(e) => setAddForm((f) => ({ ...f, name: e.target.value }))}
                    placeholder="Acme Supplies"
                    className="input"
                    required
                  />
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-medium block mb-1 text-slate-600">Contact email *</label>
                  <input
                    type="email"
                    value={addForm.contactEmail}
                    onChange={(e) => setAddForm((f) => ({ ...f, contactEmail: e.target.value }))}
                    placeholder="sales@acme.com"
                    className="input"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-medium block mb-1 text-slate-600">Lead time (days)</label>
                  <input
                    type="number"
                    value={addForm.leadTimeDays}
                    onChange={(e) => setAddForm((f) => ({ ...f, leadTimeDays: e.target.value }))}
                    min={1}
                    className="input"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium block mb-1 text-slate-600">Delay (days)</label>
                  <input
                    type="number"
                    value={addForm.delayDays}
                    onChange={(e) => setAddForm((f) => ({ ...f, delayDays: e.target.value }))}
                    min={0}
                    className="input"
                  />
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-medium block mb-1 text-slate-600">Delay note (optional)</label>
                  <textarea
                    value={addForm.delayNote}
                    onChange={(e) => setAddForm((f) => ({ ...f, delayNote: e.target.value }))}
                    placeholder="e.g. Known seasonal delays in Q4"
                    className="input min-h-[60px] resize-y"
                    rows={2}
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="ghost" onClick={() => setShowAddModal(false)}>Cancel</Button>
                <Button type="submit" variant="primary" disabled={addLoading}>
                  {addLoading ? 'Adding…' : 'Add supplier'}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  )
}
