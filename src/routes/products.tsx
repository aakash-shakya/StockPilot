import { useState } from 'react'
import { createFileRoute, Link, Outlet, useMatches } from '@tanstack/react-router'
import { Search } from 'lucide-react'
import { getInventorySummaryFn, searchProductsFn } from '../server/inventory.functions.js'
import { formatMoney } from '../server/format.js'
import { Card } from '../components/ui/Card.js'
import { Badge } from '../components/ui/Badge.js'

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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-24">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 mb-1 tracking-tight" style={{ fontFamily: 'var(--font-heading)' }}>Products</h1>
        <p className="text-sm text-slate-500">{products.length} products in inventory • searchable and filterable</p>
      </div>

      <div className="flex flex-wrap gap-3 mb-6">
        <div className="relative flex-1 min-w-64">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              void runSearch(e.target.value, category)
            }}
            placeholder="Search by name or SKU..."
            className="input pl-9"
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

      <Card className={`overflow-hidden transition-opacity duration-200 ${loading ? 'opacity-60' : ''}`}>
        <div className="px-5 py-3.5 card-header-slate flex items-center justify-between">
          <p className="text-xs font-semibold text-slate-700 uppercase tracking-wider">Catalog</p>
          <Badge className="text-xs">{products.length} items</Badge>
        </div>
        <div className="overflow-x-auto scrollbar-none">
          <table className="w-full text-sm">
            <thead>
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
  )
}
