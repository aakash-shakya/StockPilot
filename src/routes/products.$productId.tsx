import { useState, type FormEvent } from 'react'
import { createFileRoute, Link, useRouter } from '@tanstack/react-router'
import { ArrowLeft, Sliders } from 'lucide-react'
import { compareSuppliersFn, getProductDetailsFn, recommendReorderFn, createPurchaseOrderFn, updateStockFn } from '../server/inventory.functions.js'
import { formatMoney } from '../server/format.js'
import { RiskBadge, TrendLabel } from '../components/badges.js'
import { Button } from '../components/ui/Button.js'
import { Card } from '../components/ui/Card.js'
import { Badge } from '../components/ui/Badge.js'

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
      const [rec] = await recommendReorderFn({ data: { productIds: [product!.productId] } })
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
          supplierId: product!.supplierId,
          items: [{ productId: product!.productId, quantity: recommendation.suggestedQuantity }],
          notes: `Reorder for ${product!.name}`,
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
        data: { productId: product!.productId, quantityDelta: delta, type: adjustType, note: adjustNote || undefined, actor: 'human' },
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
      const result = await compareSuppliersFn({ data: { productId: product!.productId } })
      setComparison(result)
    } finally {
      setComparing(false)
    }
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-8">
      {/* Header */}
      <div className="mb-6">
        <Link to="/products" className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 mb-3">
          <ArrowLeft className="w-3 h-3" /> Products
        </Link>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900" style={{ fontFamily: 'var(--font-heading)' }}>{product.name}</h1>
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

      {/* Metrics sheet — dense, no card mosaic */}
      <Card className="overflow-hidden mb-8">
        <div className="grid grid-cols-2 lg:grid-cols-4 divide-x divide-y" style={{ borderColor: 'var(--color-border)' }}>
          <div className="px-4 py-3.5">
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">In stock</p>
            <p className="text-base font-semibold text-slate-900 mt-1 tabular-nums">{product.quantity}</p>
          </div>
          <div className="px-4 py-3.5">
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Reorder at</p>
            <p className="text-base font-semibold text-slate-900 mt-1 tabular-nums">{product.reorderThreshold}</p>
          </div>
          <div className="px-4 py-3.5">
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Coverage</p>
            <p className="text-base font-semibold text-slate-900 mt-1 tabular-nums">{product.coverageDays !== null ? `${product.coverageDays}d` : '—'}</p>
          </div>
          <div className="px-4 py-3.5">
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Projected stockout</p>
            <p className="text-sm font-semibold text-slate-900 mt-1">{product.projectedStockoutDate ?? '—'}</p>
          </div>
          <div className="px-4 py-3.5">
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Recent velocity</p>
            <p className="text-base font-semibold text-slate-900 mt-1 tabular-nums">{product.recentDailyVelocity}/day</p>
            <div className="mt-0.5"><TrendLabel trend={product.trend} /></div>
          </div>
          <div className="px-4 py-3.5">
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Baseline velocity</p>
            <p className="text-base font-semibold text-slate-900 mt-1 tabular-nums">{product.baselineDailyVelocity}/day</p>
          </div>
          <div className="px-4 py-3.5">
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Lead time</p>
            <p className="text-base font-semibold text-slate-900 mt-1 tabular-nums">{product.leadTimeDays}d{product.delayDays ? ` (+${product.delayDays}d)` : ''}</p>
          </div>
          <div className="px-4 py-3.5">
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Cost / Price</p>
            <p className="text-sm font-semibold text-slate-900 mt-1 tabular-nums">{formatMoney(product.costCents)}{(product as any).priceCents ? ` / ${formatMoney((product as any).priceCents)}` : ''}</p>
          </div>
        </div>
      </Card>

      {product.delayNote && (
        <div className="mb-8 text-sm bg-amber-50 text-amber-700 px-4 py-2.5 rounded-lg border border-amber-100">{product.delayNote}</div>
      )}

      {/* Action cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
        <Card className="overflow-hidden">
          <div className="card-header-blue px-5 py-3">
            <h2 className="text-sm font-semibold text-slate-900" style={{ fontFamily: 'var(--font-heading)' }}>Reorder recommendation</h2>
          </div>
          <div className="p-5">
          {!recommendation ? (
            <Button
              onClick={handleRecommend}
              disabled={recommending}
            >
              {recommending ? 'Calculating…' : 'Get recommendation'}
            </Button>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-gray-600">
                Suggested: <span className="font-semibold text-gray-900">{recommendation.suggestedQuantity} units</span> (
                {formatMoney(recommendation.estimatedCostCents)}).
              </p>
              <div className="flex gap-2">
                <Button
                  onClick={handleCreatePo}
                  disabled={creatingPo || recommendation.suggestedQuantity <= 0}
                >
                  {creatingPo ? 'Creating…' : 'Create draft PO'}
                </Button>
                <button onClick={() => setRecommendation(null)} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700">
                  Dismiss
                </button>
              </div>
            </div>
          )}
          </div>
        </Card>

        <Card className="overflow-hidden">
          <div className="card-header-emerald px-5 py-3">
            <h2 className="text-sm font-semibold text-slate-900" style={{ fontFamily: 'var(--font-heading)' }}>Manual stock adjustment</h2>
          </div>
          <div className="p-5">
            <form onSubmit={handleAdjust} className="space-y-3">
            <div className="flex gap-2">
              <input
                type="number"
                value={adjustQty}
                onChange={(e) => setAdjustQty(e.target.value)}
                placeholder="e.g. -3 or 10"
                className="input flex-1"
                style={{ fontFamily: 'var(--font-body)' }}
              />
              <select
                value={adjustType}
                onChange={(e) => setAdjustType(e.target.value as MovementType)}
                className="input w-auto min-w-[130px]"
                style={{ fontFamily: 'var(--font-body)' }}
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
              style={{ fontFamily: 'var(--font-body)' }}
            />
            <Button
              type="submit"
              disabled={adjusting || !adjustQty}
            >
              {adjusting ? 'Saving…' : 'Apply adjustment'}
            </Button>
          </form>
          </div>
        </Card>
      </div>

      {/* Compare suppliers */}
      <Card className="overflow-hidden mb-8">
        <div className="card-header-violet px-5 py-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900" style={{ fontFamily: 'var(--font-heading)' }}>Compare suppliers</h2>
          {!comparison && (
            <Button
              onClick={() => void handleCompare()}
              disabled={comparing}
            >
              {comparing ? 'Comparing…' : 'Compare suppliers'}
            </Button>
          )}
        </div>
        <div className="p-5">
        {comparing && <p className="text-sm text-gray-400">Comparing…</p>}
        {comparison && !comparing && (
          <div>
            {comparison.recommendationReason && (
              <p className="text-sm bg-blue-50 text-blue-700 px-4 py-2.5 rounded-lg mb-4 border border-blue-100">{comparison.recommendationReason}</p>
            )}
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider border-b border-[var(--color-border)]">
                  <th className="py-2.5 pr-2">Supplier</th>
                  <th className="py-2.5 pr-2">Unit cost</th>
                  <th className="py-2.5 pr-2">Lead time (+ delay)</th>
                  <th className="py-2.5 pr-2">Reliability</th>
                  <th className="py-2.5 pr-2"></th>
                </tr>
              </thead>
              <tbody>
                {comparison.options.map((o) => (
                  <tr key={o.supplierId} className="border-b border-[var(--color-border)] last:border-0">
                    <td className="py-2.5 pr-2 font-medium text-gray-900">
                      {o.supplierName}
                      {o.isPrimary && <span className="text-xs text-gray-400 ml-1">(primary)</span>}
                    </td>
                    <td className="py-2.5 pr-2 text-gray-600">{formatMoney(o.unitCostCents)}</td>
                    <td className="py-2.5 pr-2 text-gray-600">{o.totalLeadDays}d</td>
                    <td className="py-2.5 pr-2 text-gray-600">{o.reliabilityScore !== null ? `${o.reliabilityScore}/100` : 'n/a'}</td>
                    <td className="py-2.5 pr-2">
                      {o.supplierId === comparison.recommendedSupplierId && (
                        <Badge className="text-xs bg-emerald-50 text-emerald-700">Recommended</Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        </div>
      </Card>

      {/* Recent movements */}
      <Card className="overflow-hidden">
        <div className="card-header-slate px-5 py-3">
          <h2 className="text-sm font-semibold text-slate-900" style={{ fontFamily: 'var(--font-heading)' }}>Recent movements</h2>
        </div>
        <div className="overflow-x-auto scrollbar-none">
          <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider border-b border-[var(--color-border)]">
              <th className="px-5 py-2.5">Date</th>
              <th className="px-5 py-2.5">Type</th>
              <th className="px-5 py-2.5">Change</th>
              <th className="px-5 py-2.5">Actor</th>
              <th className="px-5 py-2.5">Note</th>
            </tr>
          </thead>
          <tbody>
            {product.recentMovements.map((m: any) => (
              <tr key={m.id} className="border-b border-[var(--color-border)] last:border-0">
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
      </Card>
    </div>
  )
}
