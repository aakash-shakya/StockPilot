import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { simulateInventoryFn, searchProductsFn } from '../server/inventory.functions.js'

export const Route = createFileRoute('/simulator')({
  component: SimulatorPage,
  validateSearch: z.object({ productId: z.number().optional() }),
  loader: async () => ({ products: await searchProductsFn({ data: {} }) }),
})

function SimulatorPage() {
  const { products } = Route.useLoaderData()
  const { productId: initialProductId } = Route.useSearch()
  const [productId, setProductId] = useState<number | ''>(initialProductId ?? '')
  const [demandChangePct, setDemandChangePct] = useState('0')
  const [leadTimeChangeDays, setLeadTimeChangeDays] = useState('0')
  const [horizonDays, setHorizonDays] = useState('30')
  const [result, setResult] = useState<Awaited<ReturnType<typeof simulateInventoryFn>> | null>(null)
  const [loading, setLoading] = useState(false)

  async function runSimulation() {
    if (!productId) return
    setLoading(true)
    try {
      const data = await simulateInventoryFn({
        data: {
          productId,
          demandChangePct: Number(demandChangePct) || 0,
          leadTimeChangeDays: Number(leadTimeChangeDays) || 0,
          horizonDays: Math.min(Math.max(Number(horizonDays) || 30, 1), 90),
        },
      })
      setResult(data)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-24">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Simulator</h1>
        <p className="text-sm text-gray-500">Test demand or lead-time changes against the current baseline.</p>
      </div>

      <div className="panel panel-shadow p-5 mb-8">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 mb-4">
          <select
            value={productId}
            onChange={(e) => setProductId(e.target.value ? Number(e.target.value) : '')}
            className="sm:col-span-2 input"
          >
            <option value="">Select a product…</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.sku})
              </option>
            ))}
          </select>
          <div>
            <label className="text-[11px] text-gray-400 font-medium uppercase tracking-wider block mb-1">Demand change %</label>
            <input
              type="number"
              value={demandChangePct}
              onChange={(e) => setDemandChangePct(e.target.value)}
              className="input"
            />
          </div>
          <div>
            <label className="text-[11px] text-gray-400 font-medium uppercase tracking-wider block mb-1">Lead time change (days)</label>
            <input
              type="number"
              value={leadTimeChangeDays}
              onChange={(e) => setLeadTimeChangeDays(e.target.value)}
              className="input"
            />
          </div>
        </div>
        <button
          onClick={() => void runSimulation()}
          disabled={loading || !productId}
          className="px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 disabled:opacity-50"
        >
          {loading ? 'Simulating…' : 'Run simulation'}
        </button>
      </div>

      {result && (
        <div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
            <div className="panel panel-shadow p-4">
              <h3 className="text-xs text-gray-400 font-medium uppercase tracking-wider mb-2">Baseline</h3>
              <div className="space-y-1">
                <p className="text-sm text-gray-600">Velocity: <span className="font-medium text-gray-900">{result.assumptions.baselineDailyVelocity}/day</span></p>
                <p className="text-sm text-gray-600">Coverage: <span className="font-medium text-gray-900">{result.baseline.coverageDays ?? 'n/a'} days</span></p>
                <p className="text-sm text-gray-600">Stockout: <span className="font-medium text-gray-900">{result.baseline.projectedStockoutDate ?? 'none'}</span></p>
              </div>
            </div>
            <div className="panel panel-shadow p-4">
              <h3 className="text-xs text-gray-400 font-medium uppercase tracking-wider mb-2">Simulated</h3>
              <div className="space-y-1">
                <p className="text-sm text-gray-600">Velocity: <span className="font-medium text-gray-900">{result.assumptions.simulatedDailyVelocity}/day</span></p>
                <p className="text-sm text-gray-600">Coverage: <span className="font-medium text-gray-900">{result.simulated.coverageDays ?? 'n/a'} days</span></p>
                <p className="text-sm text-gray-600">Stockout: <span className="font-medium text-gray-900">{result.simulated.projectedStockoutDate ?? 'none'}</span></p>
                <p className="text-sm text-gray-600">Reorder: <span className="font-semibold text-gray-900">{result.simulated.suggestedReorderQuantity} units</span></p>
              </div>
            </div>
          </div>

          <div className="panel panel-shadow p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-900">Projected stock, {result.assumptions.horizonDays} days</h3>
              <div className="flex items-center gap-4 text-xs text-gray-500">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: 'var(--series-blue)' }} />
                  Baseline
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: 'var(--series-orange)' }} />
                  Simulated
                </span>
              </div>
            </div>
            <TimelineChart timeline={result.timeline} />
          </div>
        </div>
      )}
    </div>
  )
}

function TimelineChart({ timeline }: { timeline: Array<{ day: number; baselineQuantity: number; simulatedQuantity: number }> }) {
  const width = 720
  const height = 220
  const padding = 32
  const maxQuantity = Math.max(1, ...timeline.map((t) => Math.max(t.baselineQuantity, t.simulatedQuantity)))
  const maxDay = Math.max(1, timeline.length - 1)

  const x = (day: number) => padding + (day / maxDay) * (width - padding * 2)
  const y = (qty: number) => height - padding - (qty / maxQuantity) * (height - padding * 2)

  const linePath = (key: 'baselineQuantity' | 'simulatedQuantity') =>
    timeline.map((t, idx) => `${idx === 0 ? 'M' : 'L'} ${x(t.day)} ${y(t[key])}`).join(' ')

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" role="img" aria-label="Projected stock over time, baseline vs simulated">
      <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="#e5e7eb" strokeWidth={1} />
      <line x1={padding} y1={padding} x2={padding} y2={height - padding} stroke="#e5e7eb" strokeWidth={1} />
      <text x={padding} y={padding - 10} fontSize={11} fill="#a1a1aa">
        {maxQuantity} units
      </text>
      <text x={padding} y={height - padding + 16} fontSize={11} fill="#a1a1aa">
        Day 0
      </text>
      <text x={width - padding} y={height - padding + 16} fontSize={11} fill="#a1a1aa" textAnchor="end">
        Day {maxDay}
      </text>
      <path d={linePath('baselineQuantity')} fill="none" stroke="var(--series-blue)" strokeWidth={2} />
      <path d={linePath('simulatedQuantity')} fill="none" stroke="var(--series-orange)" strokeWidth={2} />
    </svg>
  )
}
