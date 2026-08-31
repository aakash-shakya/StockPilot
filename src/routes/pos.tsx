import { useState, useMemo } from 'react'
import { createFileRoute, useRouter } from '@tanstack/react-router'
import { AnimatePresence, motion } from 'framer-motion'
import { Minus, Plus, ShoppingCart, Search, Trash2, Check } from 'lucide-react'
import { searchProductsFn, processSaleFn } from '../server/inventory.functions.js'
import { formatMoney } from '../server/format.js'
import { Button } from '../components/ui/Button.js'
import { Badge } from '../components/ui/Badge.js'

export const Route = createFileRoute('/pos')({
  component: PosPage,
  loader: async () => ({ products: await searchProductsFn({ data: { limit: 100 } }) }),
})

interface CartItem {
  productId: number
  name: string
  sku: string
  quantity: number
  unitPriceCents: number
  maxStock: number
}

function PosPage() {
  const { products } = Route.useLoaderData()
  const router = useRouter()
  const [cart, setCart] = useState<CartItem[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [processing, setProcessing] = useState(false)
  const [receipt, setReceipt] = useState<{ totalCents: number; items: Array<{ name: string; quantity: number; totalCents: number; remainingStock: number }> } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const categories = useMemo(() => {
    const cats = new Set(products.map((p: typeof products[number]) => p.category).filter(Boolean))
    return Array.from(cats).sort() as string[]
  }, [products])

  const filteredProducts = useMemo(() => {
    let list = products
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      list = list.filter((p: typeof products[number]) => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q))
    }
    if (categoryFilter) {
      list = list.filter((p: typeof products[number]) => p.category === categoryFilter)
    }
    return list
  }, [products, searchQuery, categoryFilter])

  const cartTotal = cart.reduce((sum, item) => sum + item.quantity * item.unitPriceCents, 0)
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0)

  function addToCart(product: typeof products[number]) {
    if (product.quantity <= 0) return
    setCart((prev) => {
      const existing = prev.find((c) => c.productId === product.id)
      if (existing) {
        if (existing.quantity >= product.quantity) return prev
        return prev.map((c) =>
          c.productId === product.id ? { ...c, quantity: c.quantity + 1 } : c,
        )
      }
      return [
        ...prev,
        {
          productId: product.id,
          name: product.name,
          sku: product.sku,
          quantity: 1,
          unitPriceCents: product.priceCents,
          maxStock: product.quantity,
        },
      ]
    })
  }

  function updateQty(productId: number, delta: number) {
    setCart((prev) =>
      prev
        .map((c) => {
          if (c.productId !== productId) return c
          const next = c.quantity + delta
          if (next <= 0) return null
          if (next > c.maxStock) return c
          return { ...c, quantity: next }
        })
        .filter(Boolean) as CartItem[],
    )
  }

  function removeFromCart(productId: number) {
    setCart((prev) => prev.filter((c) => c.productId !== productId))
  }

  async function handleCheckout() {
    if (!cart.length) return
    setProcessing(true)
    setError(null)
    try {
      const result = await processSaleFn({
        data: {
          items: cart.map((c) => ({
            productId: c.productId,
            quantity: c.quantity,
            unitPriceCents: c.unitPriceCents,
          })),
        },
      })
      setReceipt(result)
      setCart([])
      await router.invalidate()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sale failed')
    } finally {
      setProcessing(false)
    }
  }

  return (
    <div className="flex h-[calc(100vh-0px)] overflow-hidden">
      {/* Left: Product grid */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Search & filter bar */}
        <div className="px-5 py-3 border-b border-[var(--color-border)] bg-[var(--color-surface)] flex items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-ink-muted)]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search products…"
              className="input pl-9 w-full text-sm"
              style={{ fontFamily: 'var(--font-body)' }}
            />
          </div>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="input text-sm min-w-[140px]"
            style={{ fontFamily: 'var(--font-body)' }}
          >
            <option value="">All categories</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>

        {/* Product grid */}
        <div className="flex-1 overflow-y-auto p-5">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {filteredProducts.map((product: typeof products[number]) => {
              const inCart = cart.find((c) => c.productId === product.id)
              const outOfStock = product.quantity <= 0
              const lowStock = product.quantity > 0 && product.quantity <= (product.reorderThreshold ?? 5)

              return (
                <motion.button
                  key={product.id}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => addToCart(product)}
                  disabled={outOfStock || !!inCart}
                  className={`relative text-left p-4 rounded-xl border transition-all ${
                    outOfStock
                      ? 'border-[var(--color-border)] bg-[var(--color-surface-sunken)] opacity-50 cursor-not-allowed'
                      : inCart
                        ? 'border-[var(--color-accent)] bg-[var(--color-accent-light)] shadow-sm'
                        : 'border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-border-strong)] hover:shadow-[var(--shadow-card-hover)] cursor-pointer'
                  }`}
                >
                  <div className="absolute top-3 right-3">
                    {inCart ? (
                      <Badge variant="blue">×{inCart.quantity}</Badge>
                    ) : outOfStock ? (
                      <Badge variant="red">Out</Badge>
                    ) : lowStock ? (
                      <Badge variant="amber">Low</Badge>
                    ) : null}
                  </div>
                  <div className="font-medium text-sm text-[var(--color-ink)] leading-snug pr-8" style={{ fontFamily: 'var(--font-heading)' }}>
                    {product.name}
                  </div>
                  <div className="text-xs text-[var(--color-ink-muted)] mt-1 font-mono">{product.sku}</div>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-base font-semibold text-[var(--color-ink)]" style={{ fontFamily: 'var(--font-heading)' }}>
                      {formatMoney(product.priceCents)}
                    </span>
                    <span className="text-xs text-[var(--color-ink-muted)]">
                      {product.quantity} in stock
                    </span>
                  </div>
                </motion.button>
              )
            })}
          </div>
        </div>
      </div>

      {/* Right: Cart / receipt */}
      <div className="w-[380px] border-l border-[var(--color-border)] bg-[var(--color-surface)] flex flex-col overflow-hidden">
        {/* Cart header */}
        <div className="px-5 py-4 border-b border-[var(--color-border)] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShoppingCart className="w-4 h-4 text-[var(--color-ink-muted)]" />
            <h2 className="text-sm font-semibold text-[var(--color-ink)]" style={{ fontFamily: 'var(--font-heading)' }}>
              Current Sale
            </h2>
            {cartCount > 0 && (
              <Badge variant="blue">{cartCount}</Badge>
            )}
          </div>
          {cart.length > 0 && (
            <button
              onClick={() => setCart([])}
              className="text-xs text-[var(--color-ink-muted)] hover:text-[var(--color-status-critical)] transition-colors"
            >
              Clear
            </button>
          )}
        </div>

        {/* Cart items */}
        <div className="flex-1 overflow-y-auto">
          <AnimatePresence mode="popLayout">
            {cart.length === 0 && !receipt && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-col items-center justify-center h-full text-center px-8"
              >
                <div className="w-12 h-12 rounded-2xl bg-[var(--color-surface-sunken)] flex items-center justify-center mb-3">
                  <ShoppingCart className="w-5 h-5 text-[var(--color-ink-muted)]" />
                </div>
                <p className="text-sm text-[var(--color-ink-muted)]">Tap a product to add it to the sale</p>
              </motion.div>
            )}

            {cart.map((item) => (
              <motion.div
                key={item.productId}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="px-5 py-3 border-b border-[var(--color-border)] last:border-0"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-[var(--color-ink)] truncate">{item.name}</div>
                    <div className="text-xs text-[var(--color-ink-muted)]">{formatMoney(item.unitPriceCents)} each</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm font-semibold text-[var(--color-ink)]" style={{ fontFamily: 'var(--font-heading)' }}>
                      {formatMoney(item.quantity * item.unitPriceCents)}
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => updateQty(item.productId, -1)}
                      className="w-7 h-7 rounded-lg bg-[var(--color-surface-sunken)] hover:bg-[var(--color-border)] flex items-center justify-center transition-colors"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="w-8 text-center text-sm font-semibold" style={{ fontFamily: 'var(--font-heading)' }}>
                      {item.quantity}
                    </span>
                    <button
                      onClick={() => updateQty(item.productId, 1)}
                      disabled={item.quantity >= item.maxStock}
                      className="w-7 h-7 rounded-lg bg-[var(--color-surface-sunken)] hover:bg-[var(--color-border)] flex items-center justify-center transition-colors disabled:opacity-30"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                  <button
                    onClick={() => removeFromCart(item.productId)}
                    className="text-[var(--color-ink-muted)] hover:text-[var(--color-status-critical)] transition-colors p-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {/* Receipt view */}
          {receipt && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-5"
            >
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center">
                  <Check className="w-4 h-4 text-emerald-600" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-[var(--color-ink)]" style={{ fontFamily: 'var(--font-heading)' }}>Sale complete</div>
                  <div className="text-xs text-[var(--color-ink-muted)]">{receipt.items.length} item(s)</div>
                </div>
              </div>
              <div className="space-y-2 mb-4">
                {receipt.items.map((item, i) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span className="text-[var(--color-ink-secondary)]">{item.name} ×{item.quantity}</span>
                    <span className="text-[var(--color-ink)] font-medium">{formatMoney(item.totalCents)}</span>
                  </div>
                ))}
              </div>
              <div className="border-t border-[var(--color-border)] pt-3 flex justify-between">
                <span className="text-sm font-semibold text-[var(--color-ink)]" style={{ fontFamily: 'var(--font-heading)' }}>Total</span>
                <span className="text-lg font-bold text-[var(--color-ink)]" style={{ fontFamily: 'var(--font-heading)' }}>
                  {formatMoney(receipt.totalCents)}
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="w-full mt-4"
                onClick={() => setReceipt(null)}
              >
                New sale
              </Button>
            </motion.div>
          )}
        </div>

        {/* Checkout footer */}
        {cart.length > 0 && !receipt && (
          <div className="px-5 py-4 border-t border-[var(--color-border)] bg-[var(--color-surface)]">
            {error && (
              <div className="mb-3 text-xs bg-red-50 text-red-700 px-3 py-2 rounded-lg border border-red-100">{error}</div>
            )}
            <div className="flex justify-between mb-3">
              <span className="text-sm text-[var(--color-ink-secondary)]">Total</span>
              <span className="text-lg font-bold text-[var(--color-ink)]" style={{ fontFamily: 'var(--font-heading)' }}>
                {formatMoney(cartTotal)}
              </span>
            </div>
            <Button
              variant="primary"
              size="lg"
              className="w-full"
              disabled={processing}
              onClick={handleCheckout}
              icon={processing ? undefined : <Check className="w-4 h-4" />}
            >
              {processing ? 'Processing…' : 'Complete sale'}
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
