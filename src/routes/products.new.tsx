import { useState, type ReactNode } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { ArrowLeft, CheckCircle2, Sparkles } from 'lucide-react'
import { createProductFromDraftFn, draftProductFn, getSuppliersFn, getInventorySummaryFn } from '../server/inventory.functions.js'
import { formatMoney } from '../server/format.js'

export const Route = createFileRoute('/products/new')({
  component: NewProductPage,
  loader: async () => {
    const [suppliers, summary] = await Promise.all([getSuppliersFn(), getInventorySummaryFn()])
    return { suppliers, categories: summary.categories }
  },
})

function NewProductPage() {
  const { suppliers, categories } = Route.useLoaderData()
  const [name, setName] = useState('')
  const [category, setCategory] = useState('')
  const [brand, setBrand] = useState('')
  const [model, setModel] = useState('')
  const [variant, setVariant] = useState('')
  const [supplierId, setSupplierId] = useState<number | ''>('')
  const [cost, setCost] = useState('')
  const [price, setPrice] = useState('')
  const [initialQuantity, setInitialQuantity] = useState('0')

  const [draft, setDraft] = useState<Awaited<ReturnType<typeof draftProductFn>> | null>(null)
  const [drafting, setDrafting] = useState(false)
  const [creating, setCreating] = useState(false)
  const [created, setCreated] = useState<Awaited<ReturnType<typeof createProductFromDraftFn>> | null>(null)
  const [error, setError] = useState<string | null>(null)

  const canDraft = name && category && brand && model && supplierId && cost && price

  async function handleDraft() {
    if (!canDraft || !supplierId) return
    setError(null)
    setDrafting(true)
    try {
      const result = await draftProductFn({
        data: {
          name,
          category,
          brand,
          model,
          variant: variant || undefined,
          supplierId,
          costCents: Math.round(Number(cost) * 100),
          priceCents: Math.round(Number(price) * 100),
          initialQuantity: Number(initialQuantity) || 0,
        },
      })
      setDraft(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to draft product')
    } finally {
      setDrafting(false)
    }
  }

  async function handleConfirm() {
    if (!draft) return
    setCreating(true)
    setError(null)
    try {
      const product = await createProductFromDraftFn({
        data: {
          sku: draft.sku,
          name: draft.name,
          category: draft.category,
          supplierId: draft.supplierId,
          costCents: draft.costCents,
          priceCents: draft.priceCents,
          quantity: draft.quantity,
          reorderThreshold: draft.reorderThreshold,
          targetCoverageDays: draft.targetCoverageDays,
        },
      })
      setCreated(product)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create product')
    } finally {
      setCreating(false)
    }
  }

  if (created) {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
        <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto mb-3" />
        <h1 className="text-2xl font-bold text-gray-900 mb-1">{created.name} created</h1>
        <p className="text-sm text-gray-500 mb-6">SKU {created.sku} is now live in the catalog.</p>
        <Link to="/products/$productId" params={{ productId: String(created.id) }} className="text-sm font-medium text-blue-600 hover:text-blue-700">
          View product →
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-24">
      <Link to="/products" className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 mb-3">
        <ArrowLeft className="w-3 h-3" /> Products
      </Link>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">New Product</h1>
        <p className="text-sm text-gray-500">SKU is generated deterministically from category, brand, model, and variant.</p>
      </div>

      {error && (
        <div className="mb-6 text-sm bg-red-50 text-red-700 px-4 py-2.5 rounded-lg border border-red-100">{error}</div>
      )}

      {!draft ? (
        <div className="panel panel-shadow p-5 space-y-4">
          <Field label="Product name">
            <input value={name} onChange={(e) => setName(e.target.value)} className="input" placeholder="Wireless Mouse Pro" />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Category">
              <input value={category} onChange={(e) => setCategory(e.target.value)} className="input" list="category-options" placeholder="Electronics" />
              <datalist id="category-options">
                {categories.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </Field>
            <Field label="Brand">
              <input value={brand} onChange={(e) => setBrand(e.target.value)} className="input" placeholder="Logitech" />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Model">
              <input value={model} onChange={(e) => setModel(e.target.value)} className="input" placeholder="MX4" />
            </Field>
            <Field label="Variant (optional)">
              <input value={variant} onChange={(e) => setVariant(e.target.value)} className="input" placeholder="Black" />
            </Field>
          </div>
          <Field label="Supplier">
            <select value={supplierId} onChange={(e) => setSupplierId(e.target.value ? Number(e.target.value) : '')} className="input">
              <option value="">Select a supplier…</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </Field>
          <div className="grid grid-cols-3 gap-4">
            <Field label="Cost ($)">
              <input type="number" min="0" step="0.01" value={cost} onChange={(e) => setCost(e.target.value)} className="input" />
            </Field>
            <Field label="Price ($)">
              <input type="number" min="0" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} className="input" />
            </Field>
            <Field label="Initial quantity">
              <input type="number" min="0" value={initialQuantity} onChange={(e) => setInitialQuantity(e.target.value)} className="input" />
            </Field>
          </div>
          <button
            onClick={() => void handleDraft()}
            disabled={!canDraft || drafting}
            className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 disabled:opacity-50"
          >
            <Sparkles className="w-4 h-4" />
            {drafting ? 'Generating…' : 'Generate SKU & preview'}
          </button>
        </div>
      ) : (
        <div className="panel panel-shadow p-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-1">Review before creating</h2>
          <p className="text-xs text-gray-400 mb-4">Nothing has been saved yet.</p>
          <dl className="grid grid-cols-2 gap-y-2.5 text-sm mb-6">
            <dt className="text-gray-400 text-xs">SKU</dt>
            <dd className="font-mono text-gray-900 text-xs">{draft.sku}</dd>
            <dt className="text-gray-400 text-xs">Name</dt>
            <dd className="text-gray-900">{draft.name}</dd>
            <dt className="text-gray-400 text-xs">Category</dt>
            <dd className="text-gray-900">{draft.category}</dd>
            <dt className="text-gray-400 text-xs">Supplier</dt>
            <dd className="text-gray-900">{draft.supplierName}</dd>
            <dt className="text-gray-400 text-xs">Cost / Price</dt>
            <dd className="text-gray-900">{formatMoney(draft.costCents)} / {formatMoney(draft.priceCents)}</dd>
            <dt className="text-gray-400 text-xs">Initial quantity</dt>
            <dd className="text-gray-900">{draft.quantity}</dd>
            <dt className="text-gray-400 text-xs">Reorder threshold</dt>
            <dd className="text-gray-900">{draft.reorderThreshold}</dd>
          </dl>
          <div className="flex gap-2">
            <button
              onClick={() => void handleConfirm()}
              disabled={creating}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {creating ? 'Creating…' : 'Confirm & create'}
            </button>
            <button onClick={() => setDraft(null)} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700">
              Edit
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="text-[11px] text-gray-400 font-medium uppercase tracking-wider block mb-1">{label}</span>
      {children}
    </label>
  )
}
