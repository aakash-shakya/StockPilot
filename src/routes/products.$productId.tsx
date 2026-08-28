import { useState, type FormEvent, type ReactNode } from 'react'
import { createFileRoute, Link, useRouter } from '@tanstack/react-router'
import { ArrowLeft, Sliders } from 'lucide-react'
import { compareSuppliersFn, getProductDetailsFn, recommendReorderFn, createPurchaseOrderFn, updateStockFn } from '../server/inventory.functions.js'
import { formatMoney } from '../server/format.js'
import { RiskBadge, TrendLabel } from '../components/badges.js'

export const Route = createFileRoute('/products/$productId')({
  component: ProductDetail,
  loader: async ({ params }) => {
    const product = await getProductDetailsFn({ data: { productId: Number(params.productId) } })
    return { product }
  },
})

type MovementType = 'adjustment' | 'transfer_in' | 'transfer_out' | 'restock'

function ProductDetail() {
  const { product } = Route.useLoaderData()
  const router = useRouter()
  const [recommendation, setRecommendation] = useState<any>(null)
  const [recommending, setRecommending] = useState(false)
  const [creatingPo, setCreatingPo] = useState(false)
  const [adjustQty, setAdjustQty] = useState('')
  const [adjustType, setAdjustType] = useState<MovementType>('adjustment')
  const [adjustNote, setAdjustNote] = useState('')
  const [adjusting, setAdjusting] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [comparison, setComparison] = useState<Awaited<ReturnType<typeof compareSuppliersFn>> | null>(null)
  const [comparing, setComparing] = useState(false)

  if (!product) {
    return <div className="max-w-3xl mx-auto px-4 py-8 text-gray-500">Product not found.</div>
  }

  async function handleRecommend() {
    setRecommending(true)
    try {
      const [rec] = await recommendReorderFn({ data: { productIds: [product.productId] } })
      setRecommendation(rec ?? null)
    } finally {
      setRecommending(false)
    }
  }

  async function handleCreatePo() {
    if (!recommendation || recommendation.suggestedQuantity <= 0) return
    setCreatingPo(true)
    try {
      const po = await createPurchaseOrderFn({
        data: {
          supplierId: product.supplierId,
          items: [{ productId: product.productId, quantity: recommendation.suggestedQuantity }],
          notes: `Reorder for ${product.name}`,
          createdBy: 'human',
        },
      })
      setMessage(`Created draft ${po?.poNumber} for ${recommendation.suggestedQuantity} units.`)
      setRecommendation(null)
      await router.invalidate()
    } finally {
      setCreatingPo(false)
    }
  }

  async function handleAdjust(e: FormEvent) {
    e.preventDefault()
    const delta = Number(adjustQty)
    if (!delta) return
    setAdjusting(true)
    try {
      await updateStockFn({
        data: { productId: product.productId, quantityDelta: delta, type: adjustType, note: adjustNote || undefined, actor: 'human' },
      })
      setAdjustQty('')
      setAdjustNote('')
      setMessage(`Stock updated by ${delta > 0 ? '+' : ''}${delta}.`)
      await router.invalidate()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to update stock')
    } finally {
      setAdjusting(false)
    }
  }

  async function handleCompare() {
    setComparing(true)
    try {
      const result = await compareSuppliersFn({ data: { productId: product.productId } })
      setComparison(result)
    } finally {
      setComparing(false)
    }
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-24">
      {/* Header */}
      <div className="mb-6">
        <Link to="/products" className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 mb-3">
          <ArrowLeft className="w-3 h-3" /> Products
        </Link>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{product.name}</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {product.sku} · {product.category} · {product.supplierName}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              to="/simulator"
              search={{ productId: product.productId }}
              className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900"
            >
              <Sliders className="w-4 h-4" />
              Simulate
            </Link>
            <RiskBadge level={product.riskLevel} />
          </div>
        </div>
      </div>

      {message && (
        <div className="mb-6 text-sm bg-blue-50 text-blue-700 px-4 py-2.5 rounded-lg border border-blue-100">{message}</div>
      )}

      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        <Stat label="In stock" value={String(product.quantity)} />
        <Stat label="Reorder at" value={String(product.reorderThreshold)} />
        <Stat label="Coverage" value={product.coverageDays !== null ? `${product.coverageDays}d` : '—'} />
        <Stat label="Projected stockout" value={product.projectedStockoutDate ?? '—'} />
        <Stat label="Recent velocity" value={`${product.recentDailyVelocity}/day`} extra={<TrendLabel trend={product.trend} />} />
        <Stat label="Baseline velocity" value={`${product.baselineDailyVelocity}/day`} />
        <Stat label="Lead time" value={`${product.leadTimeDays}d${product.delayDays ? ` (+${product.delayDays}d delay)` : ''}`} />
        <Stat label="Cost / Price" value={`${formatMoney(product.costCents)} / ${formatMoney(product.priceCents)}`} />
      </div>

      {product.delayNote && (
        <div className="mb-8 text-sm bg-amber-50 text-amber-700 px-4 py-2.5 rounded-lg border border-amber-100">{product.delayNote}</div>
      )}

      {/* Action cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
        <div className="panel panel-shadow p-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">Reorder recommendation</h2>
          {!recommendation ? (
            <button
              onClick={handleRecommend}
              disabled={recommending}
              className="px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 disabled:opacity-50"
            >
              {recommending ? 'Calculating…' : 'Get recommendation'}
            </button>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-gray-600">
                Suggested: <span className="font-semibold text-gray-900">{recommendation.suggestedQuantity} units</span> (
                {formatMoney(recommendation.estimatedCostCents)}).
              </p>
              <div className="flex gap-2">
                <button
                  onClick={handleCreatePo}
                  disabled={creatingPo || recommendation.suggestedQuantity <= 0}
                  className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {creatingPo ? 'Creating…' : 'Create draft PO'}
                </button>
                <button onClick={() => setRecommendation(null)} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700">
                  Dismiss
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="panel panel-shadow p-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">Manual stock adjustment</h2>
          <form onSubmit={handleAdjust} className="space-y-3">
            <div className="flex gap-2">
              <input
                type="number"
                value={adjustQty}
                onChange={(e) => setAdjustQty(e.target.value)}
                placeholder="e.g. -3 or 10"
                className="input flex-1"
              />
              <select
                value={adjustType}
                onChange={(e) => setAdjustType(e.target.value as MovementType)}
                className="input w-auto min-w-[130px]"
              >
                <option value="adjustment">Adjustment</option>
                <option value="restock">Restock</option>
                <option value="transfer_in">Transfer in</option>
                <option value="transfer_out">Transfer out</option>
              </select>
            </div>
            <input
              value={adjustNote}
              onChange={(e) => setAdjustNote(e.target.value)}
              placeholder="Reason (optional)"
              className="input"
            />
            <button
              type="submit"
              disabled={adjusting || !adjustQty}
              className="px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 disabled:opacity-50"
            >
              {adjusting ? 'Saving…' : 'Apply adjustment'}
            </button>
          </form>
        </div>
      </div>

      {/* Compare suppliers */}
      <div className="panel panel-shadow p-5 mb-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-900">Compare suppliers</h2>
          {!comparison && (
            <button
              onClick={() => void handleCompare()}
              disabled={comparing}
              className="px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 disabled:opacity-50"
            >
              {comparing ? 'Comparing…' : 'Compare suppliers'}
            </button>
          )}
        </div>
        {comparing && <p className="text-sm text-gray-400">Comparing…</p>}
        {comparison && !comparing && (
          <div>
            {comparison.recommendationReason && (
              <p className="text-sm bg-blue-50 text-blue-700 px-4 py-2.5 rounded-lg mb-4 border border-blue-100">{comparison.recommendationReason}</p>
            )}
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider border-b border-gray-100">
                  <th className="py-2.5 pr-2">Supplier</th>
                  <th className="py-2.5 pr-2">Unit cost</th>
                  <th className="py-2.5 pr-2">Lead time (+ delay)</th>
                  <th className="py-2.5 pr-2">Reliability</th>
                  <th className="py-2.5 pr-2"></th>
                </tr>
              </thead>
              <tbody>
                {comparison.options.map((o) => (
                  <tr key={o.supplierId} className="border-b border-gray-50 last:border-0">
                    <td className="py-2.5 pr-2 font-medium text-gray-900">
                      {o.supplierName}
                      {o.isPrimary && <span className="text-xs text-gray-400 ml-1">(primary)</span>}
                    </td>
                    <td className="py-2.5 pr-2 text-gray-600">{formatMoney(o.unitCostCents)}</td>
                    <td className="py-2.5 pr-2 text-gray-600">{o.totalLeadDays}d</td>
                    <td className="py-2.5 pr-2 text-gray-600">{o.reliabilityScore !== null ? `${o.reliabilityScore}/100` : 'n/a'}</td>
                    <td className="py-2.5 pr-2">
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

      {/* Recent movements */}
      <div className="panel panel-shadow overflow-hidden">
        <h2 className="text-sm font-semibold text-gray-900 px-5 pt-5 pb-3">Recent movements</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider border-b border-gray-100">
              <th className="px-5 py-2.5">Date</th>
              <th className="px-5 py-2.5">Type</th>
              <th className="px-5 py-2.5">Change</th>
              <th className="px-5 py-2.5">Actor</th>
              <th className="px-5 py-2.5">Note</th>
            </tr>
          </thead>
          <tbody>
            {product.recentMovements.map((m: any) => (
              <tr key={m.id} className="border-b border-gray-50 last:border-0">
                <td className="px-5 py-2.5 text-gray-400 text-xs font-mono">{new Date(m.createdAt).toLocaleDateString()}</td>
                <td className="px-5 py-2.5 capitalize text-gray-600">{m.type}</td>
                <td className={`px-5 py-2.5 font-medium ${m.quantityDelta < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                  {m.quantityDelta > 0 ? '+' : ''}{m.quantityDelta}
                </td>
                <td className="px-5 py-2.5 text-gray-500 capitalize">{m.actor}</td>
                <td className="px-5 py-2.5 text-gray-400 text-xs">{m.note ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function Stat({ label, value, extra }: { label: string; value: string; extra?: ReactNode }) {
  return (
    <div className="panel p-3.5">
      <p className="text-[11px] text-gray-400 font-medium uppercase tracking-wider">{label}</p>
      <p className="text-base font-semibold text-gray-900 mt-0.5">{value}</p>
      {extra}
    </div>
  )
}
