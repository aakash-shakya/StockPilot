import { useState, type FormEvent, type ReactNode } from 'react'
import { createFileRoute, useRouter } from '@tanstack/react-router'
import { getProductDetailsFn, recommendReorderFn, createPurchaseOrderFn, updateStockFn } from '../server/inventory.functions.js'
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

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-24">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{product.name}</h1>
          <p className="text-gray-500">
            {product.sku} · {product.category} · supplied by {product.supplierName}
          </p>
        </div>
        <RiskBadge level={product.riskLevel} />
      </div>

      {message && <div className="mb-6 text-sm bg-blue-50 text-blue-700 px-4 py-2 rounded-lg">{message}</div>}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
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
        <div className="mb-8 text-sm bg-amber-50 text-amber-700 px-4 py-2 rounded-lg">{product.delayNote}</div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Reorder recommendation</h2>
          {!recommendation ? (
            <button
              onClick={handleRecommend}
              disabled={recommending}
              className="px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 disabled:opacity-50"
            >
              {recommending ? 'Calculating…' : 'Recommend reorder quantity'}
            </button>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-gray-600">
                Suggested: <span className="font-semibold text-gray-900">{recommendation.suggestedQuantity} units</span> (
                {formatMoney(recommendation.estimatedCostCents)}) to cover target coverage plus supplier lead time and any
                known delay.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={handleCreatePo}
                  disabled={creatingPo || recommendation.suggestedQuantity <= 0}
                  className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {creatingPo ? 'Creating…' : 'Create draft purchase order'}
                </button>
                <button onClick={() => setRecommendation(null)} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700">
                  Dismiss
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Manual stock adjustment</h2>
          <form onSubmit={handleAdjust} className="space-y-3">
            <div className="flex gap-2">
              <input
                type="number"
                value={adjustQty}
                onChange={(e) => setAdjustQty(e.target.value)}
                placeholder="e.g. -3 or 10"
                className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <select
                value={adjustType}
                onChange={(e) => setAdjustType(e.target.value as MovementType)}
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <h2 className="text-lg font-semibold text-gray-900 px-6 pt-6 pb-3">Recent movements</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 border-b bg-gray-50">
              <th className="py-2.5 px-6">Date</th>
              <th className="py-2.5 px-4">Type</th>
              <th className="py-2.5 px-4">Change</th>
              <th className="py-2.5 px-4">Actor</th>
              <th className="py-2.5 px-4">Note</th>
            </tr>
          </thead>
          <tbody>
            {product.recentMovements.map((m: any) => (
              <tr key={m.id} className="border-b last:border-0">
                <td className="py-2.5 px-6 text-gray-400">{new Date(m.createdAt).toLocaleDateString()}</td>
                <td className="py-2.5 px-4 capitalize">{m.type}</td>
                <td className={`py-2.5 px-4 font-medium ${m.quantityDelta < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                  {m.quantityDelta > 0 ? '+' : ''}
                  {m.quantityDelta}
                </td>
                <td className="py-2.5 px-4 text-gray-500 capitalize">{m.actor}</td>
                <td className="py-2.5 px-4 text-gray-400">{m.note ?? '—'}</td>
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
    <div className="bg-white rounded-xl shadow-sm p-4">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-lg font-semibold text-gray-900">{value}</p>
      {extra}
    </div>
  )
}
