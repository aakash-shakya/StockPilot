import { useState } from 'react'
import { createFileRoute, useRouter } from '@tanstack/react-router'
import { ArrowLeft, ArrowRight, DollarSign, ShoppingCart, User } from 'lucide-react'
import { getSalesHistoryFn } from '../server/inventory.functions.js'
import { Badge } from '../components/ui/Badge.js'

export const Route = createFileRoute('/sales')({
  component: SalesHistoryPage,
  loader: async () => ({
    data: await getSalesHistoryFn({ data: { limit: 25, offset: 0 } }),
  }),
})

function SalesHistoryPage() {
  const { data: initial } = Route.useLoaderData()
  const router = useRouter()
  const [page, setPage] = useState(0)
  const [sales, setSales] = useState(initial.sales)
  const [total, setTotal] = useState(initial.total)
  const [loading, setLoading] = useState(false)
  const pageSize = 25

  async function loadPage(newPage: number) {
    setLoading(true)
    try {
      const result = await getSalesHistoryFn({ data: { limit: pageSize, offset: newPage * pageSize } })
      setSales(result.sales)
      setTotal(result.total)
      setPage(newPage)
    } finally {
      setLoading(false)
      await router.invalidate()
    }
  }

  const totalPages = Math.ceil(total / pageSize)

  function formatDate(ts: number | null) {
    if (!ts) return '—'
    const d = new Date(ts * 1000)
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  function formatTime(ts: number | null) {
    if (!ts) return ''
    const d = new Date(ts * 1000)
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[var(--color-ink)] mb-1 tracking-tight" style={{ fontFamily: 'var(--font-heading)' }}>Sales History</h1>
        <p className="text-sm text-[var(--color-ink-muted)]">
          {total} total sale{total !== 1 ? 's' : ''} recorded
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="panel panel-shadow p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[var(--color-accent-light)] flex items-center justify-center">
              <ShoppingCart className="w-5 h-5 text-[var(--color-accent)]" />
            </div>
            <div>
              <div className="text-xs text-[var(--color-ink-muted)]">Total transactions</div>
              <div className="text-lg font-bold text-[var(--color-ink)]" style={{ fontFamily: 'var(--font-heading)' }}>{total}</div>
            </div>
          </div>
        </div>
        <div className="panel panel-shadow p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <div className="text-xs text-[var(--color-ink-muted)]">Items sold</div>
              <div className="text-lg font-bold text-[var(--color-ink)]" style={{ fontFamily: 'var(--font-heading)' }}>
                {sales.reduce((sum, s) => sum + s.quantity, 0)}
              </div>
            </div>
          </div>
        </div>
        <div className="panel panel-shadow p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center">
              <User className="w-5 h-5 text-violet-600" />
            </div>
            <div>
              <div className="text-xs text-[var(--color-ink-muted)]">Unique products</div>
              <div className="text-lg font-bold text-[var(--color-ink)]" style={{ fontFamily: 'var(--font-heading)' }}>
                {new Set(sales.map((s) => s.productId)).size}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="panel panel-shadow overflow-hidden">
        <div className="card-header-slate px-5 py-3 flex items-center justify-between">
          <h2 className="text-xs font-semibold text-[var(--color-ink-secondary)] uppercase tracking-wider" style={{ fontFamily: 'var(--font-heading)' }}>Transactions</h2>
          <Badge variant="default">{sales.length} shown</Badge>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs font-semibold text-[var(--color-ink-muted)] uppercase tracking-wider border-b border-[var(--color-border)] bg-[var(--color-surface-sunken)]">
                <th className="px-5 py-3">Date</th>
                <th className="px-5 py-3">Product</th>
                <th className="px-5 py-3">SKU</th>
                <th className="px-5 py-3 text-right">Qty</th>
                <th className="px-5 py-3">Actor</th>
                <th className="px-5 py-3">Note</th>
              </tr>
            </thead>
            <tbody>
              {sales.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-[var(--color-ink-muted)]">
                    No sales recorded yet. Make your first sale at the <a href="/pos" className="text-[var(--color-accent)] hover:underline">Point of Sale</a>.
                  </td>
                </tr>
              ) : (
                sales.map((sale) => (
                  <tr key={sale.id} className="border-b border-slate-50 last:border-0 hover:bg-[var(--color-surface-sunken)]/50">
                    <td className="px-5 py-3">
                      <div className="text-[var(--color-ink)]">{formatDate(sale.createdAt)}</div>
                      <div className="text-xs text-[var(--color-ink-muted)]">{formatTime(sale.createdAt)}</div>
                    </td>
                    <td className="px-5 py-3 font-medium text-[var(--color-ink)]">{sale.productName}</td>
                    <td className="px-5 py-3 font-mono text-xs text-[var(--color-ink-muted)]">{sale.productSku}</td>
                    <td className="px-5 py-3 text-right">
                      <Badge variant="red">-{sale.quantity}</Badge>
                    </td>
                    <td className="px-5 py-3">
                      <Badge variant={sale.actor === 'agent' ? 'blue' : 'default'}>
                        {sale.actor === 'agent' ? 'Agent' : 'Human'}
                      </Badge>
                    </td>
                    <td className="px-5 py-3 text-xs text-[var(--color-ink-muted)] max-w-[200px] truncate">{sale.note}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-5 py-3 border-t border-[var(--color-border)] flex items-center justify-between">
            <span className="text-xs text-[var(--color-ink-muted)]">
              Page {page + 1} of {totalPages}
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => void loadPage(page - 1)}
                disabled={page === 0 || loading}
                className="px-3 py-1.5 text-xs font-medium rounded-lg border border-[var(--color-border)] hover:bg-[var(--color-surface-sunken)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5 inline-block mr-1" /> Prev
              </button>
              <button
                onClick={() => void loadPage(page + 1)}
                disabled={page >= totalPages - 1 || loading}
                className="px-3 py-1.5 text-xs font-medium rounded-lg border border-[var(--color-border)] hover:bg-[var(--color-surface-sunken)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                Next <ArrowRight className="w-3.5 h-3.5 inline-block ml-1" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
