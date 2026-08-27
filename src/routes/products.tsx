import { useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { Search } from 'lucide-react'
import { getInventorySummaryFn, searchProductsFn } from '../server/inventory.functions.js'
import { formatMoney } from '../server/format.js'

export const Route = createFileRoute('/products')({
  component: ProductsList,
  loader: async () => {
    const [products, summary] = await Promise.all([searchProductsFn({ data: {} }), getInventorySummaryFn()])
    return { products, categories: summary.categories }
  },
})

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
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Products</h1>

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
            className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <select
          value={category}
          onChange={(e) => {
            setCategory(e.target.value)
            void runSearch(query, e.target.value)
          }}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      <div className={`bg-white rounded-xl shadow-sm overflow-hidden ${loading ? 'opacity-60' : ''}`}>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 border-b bg-gray-50">
              <th className="py-2.5 px-4">SKU</th>
              <th className="py-2.5 px-4">Name</th>
              <th className="py-2.5 px-4">Category</th>
              <th className="py-2.5 px-4">Supplier</th>
              <th className="py-2.5 px-4">Stock</th>
              <th className="py-2.5 px-4">Reorder at</th>
              <th className="py-2.5 px-4">Price</th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.id} className="border-b last:border-0 hover:bg-gray-50">
                <td className="py-2.5 px-4 text-gray-400">{p.sku}</td>
                <td className="py-2.5 px-4">
                  <Link to="/products/$productId" params={{ productId: String(p.id) }} className="font-medium text-gray-900 hover:text-blue-600">
                    {p.name}
                  </Link>
                </td>
                <td className="py-2.5 px-4 text-gray-500">{p.category}</td>
                <td className="py-2.5 px-4 text-gray-500">{p.supplierName}</td>
                <td className="py-2.5 px-4">
                  <span className={p.quantity <= p.reorderThreshold ? 'text-amber-600 font-medium' : ''}>{p.quantity}</span>
                </td>
                <td className="py-2.5 px-4 text-gray-400">{p.reorderThreshold}</td>
                <td className="py-2.5 px-4">{formatMoney(p.priceCents)}</td>
              </tr>
            ))}
            {products.length === 0 && (
              <tr>
                <td colSpan={7} className="py-8 text-center text-gray-400">
                  No products match.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
