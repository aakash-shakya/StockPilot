import { useState, useRef } from 'react'
import { createFileRoute, Link, Outlet, useMatches, useRouter } from '@tanstack/react-router'
import { Search, Upload, X } from 'lucide-react'
import Papa from 'papaparse'
import { getInventorySummaryFn, searchProductsFn, bulkCreateProductsFn } from '../server/inventory.functions.js'
import { formatMoney } from '../server/format.js'
import { Card } from '../components/ui/Card.js'
import { Badge } from '../components/ui/Badge.js'
import { Button } from '../components/ui/Button.js'

export const Route = createFileRoute('/products')({
  component: ProductsLayout,
  loader: async () => {
    const [products, summary] = await Promise.all([searchProductsFn({ data: {} }), getInventorySummaryFn()])
    return { products, categories: summary.categories }
  },
})

function ProductsLayout() {
  const matches = useMatches()
  const isChild = matches.some((m) => m.routeId === '/products/new' || m.routeId === '/products/$productId')
  if (isChild) return <Outlet />
  return <ProductsList />
}

function ProductsList() {
  const { products: initialProducts, categories } = Route.useLoaderData()
  const [products, setProducts] = useState(initialProducts)
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('')
  const [loading, setLoading] = useState(false)
  const [importOpen, setImportOpen] = useState(false)

  async function runSearch(nextQuery: string, nextCategory: string) {
    setLoading(true)
    try {
      const results = await searchProductsFn({
        data: { query: nextQuery || undefined, category: nextCategory || undefined },
      })
      setProducts(results)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-0px)]">
      {/* Filter bar */}
      <div className="px-4 sm:px-6 lg:px-8 pt-8 pb-4 flex-shrink-0">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 mb-0.5 tracking-tight" style={{ fontFamily: 'var(--font-heading)' }}>Products</h1>
              <p className="text-sm text-slate-500">{products.length} products in inventory</p>
            </div>
            <Button variant="secondary" size="sm" onClick={() => setImportOpen(true)} icon={<Upload className="w-4 h-4" />}>
              Import CSV
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-64 max-w-md">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value)
                  void runSearch(e.target.value, category)
                }}
                placeholder="Search by name or SKU..."
                className="input pl-10"
                style={{ fontFamily: 'var(--font-body)' }}
              />
            </div>
            <select
              value={category}
              onChange={(e) => {
                setCategory(e.target.value)
                void runSearch(query, e.target.value)
              }}
              className="input w-auto min-w-[160px]"
              style={{ fontFamily: 'var(--font-body)' }}
            >
              <option value="">All categories</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
      </div>
      <CsvImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onComplete={() => setImportOpen(false)}
      />
    </div>
      </div>

      {/* Scrollable table */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 pb-8 min-h-0">
        <div className="max-w-7xl mx-auto">
          <Card className={`overflow-hidden transition-opacity duration-200 ${loading ? 'opacity-60' : ''}`}>
            <div className="overflow-y-auto max-h-[calc(100vh-220px)] scrollbar-none">
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10">
                  <tr className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-[var(--color-border)]" style={{ backgroundColor: 'var(--color-surface-sunken)' }}>
                    <th className="px-5 py-3 whitespace-nowrap">SKU</th>
                    <th className="px-5 py-3 whitespace-nowrap">Name</th>
                    <th className="px-5 py-3 whitespace-nowrap">Category</th>
                    <th className="px-5 py-3 whitespace-nowrap">Supplier</th>
                    <th className="px-5 py-3 whitespace-nowrap">Stock</th>
                    <th className="px-5 py-3 whitespace-nowrap">Reorder at</th>
                    <th className="px-5 py-3 text-right whitespace-nowrap">Price</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((p) => (
                    <tr key={p.id} data-product-id={p.id} className="border-b border-[var(--color-border)] last:border-0 hover:bg-slate-50/50 transition-all duration-300">
                      <td className="px-5 py-3.5 text-slate-400 font-mono text-xs whitespace-nowrap">{p.sku}</td>
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <Link to="/products/$productId" params={{ productId: String(p.id) }} className="font-medium text-slate-900 hover:text-blue-600">
                          {p.name}
                        </Link>
                      </td>
                      <td className="px-5 py-3.5 text-slate-500 whitespace-nowrap"><Badge>{p.category}</Badge></td>
                      <td className="px-5 py-3.5 text-slate-500 whitespace-nowrap">{p.supplierName}</td>
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <Badge className={p.quantity <= p.reorderThreshold ? 'bg-amber-50 text-amber-700 border-amber-200' : ''}>
                          {p.quantity}
                        </Badge>
                      </td>
                      <td className="px-5 py-3.5 text-slate-400 whitespace-nowrap">{p.reorderThreshold}</td>
                      <td className="px-5 py-3.5 text-right font-semibold text-slate-900 whitespace-nowrap">{formatMoney(p.priceCents)}</td>
                    </tr>
                  ))}
                  {products.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400">
                        No products match your search.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}

function CsvImportModal({
  open,
  onClose,
  onComplete,
}: {
  open: boolean
  onClose: () => void
  onComplete: () => void
}) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<{ inserted: number } | null>(null)
  const [importError, setImportError] = useState<string | null>(null)

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImporting(true)
    setImportError(null)
    setImportResult(null)

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          const rows = results.data as Record<string, string>[]
          const items = rows.map((row) => ({
            sku: row.sku || row.SKU || '',
            name: row.name || row.Name || '',
            category: row.category || row.Category || 'Uncategorized',
            supplierId: parseInt(row.supplierId || row.supplier_id || row['Supplier ID'] || '1', 10),
            costCents: Math.round(parseFloat(row.costCents || row.cost_cents || row['Cost'] || '0') * 100) || 0,
            priceCents: Math.round(parseFloat(row.priceCents || row.price_cents || row['Price'] || '0') * 100) || 0,
            quantity: parseInt(row.quantity || row.stock || row.Quantity || '0', 10),
            reorderThreshold: parseInt(row.reorderThreshold || row.reorder_threshold || row['Reorder At'] || '5', 10),
          })).filter((item) => item.sku && item.name)

          if (items.length === 0) {
            setImportError('No valid rows found. Ensure your CSV has sku, name, category, and price columns.')
            setImporting(false)
            return
          }

          const result = await bulkCreateProductsFn({ data: items })
          setImportResult(result)
          await router.invalidate()
          onComplete()
        } catch (err) {
          setImportError(err instanceof Error ? err.message : 'Import failed')
        } finally {
          setImporting(false)
        }
      },
      error: (err) => {
        setImportError(err.message || 'Failed to parse CSV')
        setImporting(false)
      },
    })
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-slate-900" style={{ fontFamily: 'var(--font-heading)' }}>Import Products from CSV</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100 transition-colors">
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>

        <div className="text-sm text-slate-500 mb-4">
          <p className="mb-2">Your CSV should have columns: <code className="bg-slate-100 px-1 rounded">sku</code>, <code className="bg-slate-100 px-1 rounded">name</code>, <code className="bg-slate-100 px-1 rounded">category</code>, <code className="bg-slate-100 px-1 rounded">price</code>, <code className="bg-slate-100 px-1 rounded">cost</code>, <code className="bg-slate-100 px-1 rounded">quantity</code>, <code className="bg-slate-100 px-1 rounded">supplier_id</code>.</p>
          <p>Optional: <code className="bg-slate-100 px-1 rounded">reorder_threshold</code> (default 5).</p>
        </div>

        {importResult ? (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 mb-4">
            <p className="text-sm font-medium text-emerald-700">Successfully imported {importResult.inserted} product(s).</p>
          </div>
        ) : importError ? (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4">
            <p className="text-sm font-medium text-red-700">{importError}</p>
          </div>
        ) : null}

        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          onChange={handleFileChange}
          className="hidden"
        />

        <div className="flex gap-3">
          <Button variant="ghost" size="sm" onClick={onClose} className="flex-1">
            {importResult ? 'Done' : 'Cancel'}
          </Button>
          {!importResult && (
            <Button
              variant="primary"
              size="sm"
              className="flex-1"
              disabled={importing}
              onClick={() => fileInputRef.current?.click()}
            >
              {importing ? 'Importing…' : 'Choose CSV File'}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
