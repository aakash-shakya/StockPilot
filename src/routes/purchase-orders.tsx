import { useState } from 'react'
import { createFileRoute, useRouter } from '@tanstack/react-router'
import { approvePurchaseOrderFn, getPurchaseOrdersFn, receiveShipmentFn } from '../server/inventory.functions.js'
import { formatMoney } from '../server/format.js'
import { PoStatusBadge } from '../components/badges.js'
import { Button } from '../components/ui/Button.js'
import { Badge } from '../components/ui/Badge.js'

export const Route = createFileRoute('/purchase-orders')({
  component: PurchaseOrdersList,
  loader: async () => ({ purchaseOrders: await getPurchaseOrdersFn() }),
})

function PurchaseOrdersList() {
  const { purchaseOrders } = Route.useLoaderData()
  const router = useRouter()
  const [busyId, setBusyId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function approve(id: number) {
    setBusyId(id)
    setError(null)
    try {
      await approvePurchaseOrderFn({ data: { purchaseOrderId: id } })
      await router.invalidate()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to approve order')
    } finally {
      setBusyId(null)
    }
  }

  async function receive(id: number) {
    setBusyId(id)
    setError(null)
    try {
      await receiveShipmentFn({ data: { purchaseOrderId: id, actor: 'human' } })
      await router.invalidate()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to receive shipment')
    } finally {
      setBusyId(null)
    }
  }

  const draftCount = purchaseOrders.filter((po) => po.status === 'draft').length
  const approvedCount = purchaseOrders.filter((po) => po.status === 'approved').length
  const receivedCount = purchaseOrders.filter((po) => po.status === 'received').length

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-1" style={{ fontFamily: 'var(--font-heading)' }}>Purchase Orders</h1>
        <p className="text-sm text-gray-500">
          {purchaseOrders.length} orders total · {draftCount} draft · {approvedCount} approved · {receivedCount} received
        </p>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 text-red-700 text-sm px-4 py-3 rounded-xl border border-red-100 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600 ml-2 text-xs font-medium">Dismiss</button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {purchaseOrders.map((po) => (
          <div
            key={po.id}
            className="panel overflow-hidden flex flex-col"
          >
            {/* Header */}
            <div className="px-5 py-4 border-b border-[var(--color-border)]">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="font-semibold text-gray-900 text-sm" style={{ fontFamily: 'var(--font-heading)' }}>{po.poNumber}</h2>
                    <PoStatusBadge status={po.status} />
                    {po.createdBy === 'agent' && (
                      <Badge variant="violet">agent-created</Badge>
                    )}
                  </div>
                  <p className="text-sm text-gray-500 mt-0.5">{po.supplierName}</p>
                  {po.notes && <p className="text-xs text-gray-400 mt-1 line-clamp-2">{po.notes}</p>}
                </div>
                <p className="font-semibold text-gray-900 text-sm whitespace-nowrap">{formatMoney(po.totalCostCents)}</p>
              </div>
            </div>

            {/* Items */}
            <div className="flex-1 px-5 py-3">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[11px] text-gray-400 uppercase tracking-wider">
                    <th className="text-left pb-1.5 font-medium">Product</th>
                    <th className="text-right pb-1.5 font-medium w-20">Qty</th>
                    <th className="text-right pb-1.5 font-medium w-24">Unit cost</th>
                  </tr>
                </thead>
                <tbody>
                  {po.items.map((item) => (
                    <tr key={item.productId} className="border-t border-gray-50">
                      <td className="py-2 text-gray-700">{item.productName}</td>
                      <td className="py-2 text-gray-400 text-right font-mono text-xs">×{item.quantity}</td>
                      <td className="py-2 text-gray-500 text-right">{formatMoney(item.unitCostCents)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Actions */}
            <div className="px-5 py-3 border-t border-[var(--color-border)] flex justify-end gap-2">
              {po.status === 'draft' && (
                <Button
                  variant="accent"
                  size="sm"
                  onClick={() => approve(po.id)}
                  disabled={busyId === po.id}
                >
                  {busyId === po.id ? 'Approving…' : 'Approve'}
                </Button>
              )}
              {po.status === 'approved' && (
                <Button
                  variant="success"
                  size="sm"
                  onClick={() => receive(po.id)}
                  disabled={busyId === po.id}
                >
                  {busyId === po.id ? 'Receiving…' : 'Mark received'}
                </Button>
              )}
            </div>
          </div>
        ))}
        {purchaseOrders.length === 0 && (
          <div className="col-span-full panel panel-shadow p-12 text-center">
            <p className="text-gray-400">No purchase orders yet.</p>
          </div>
        )}
      </div>
    </div>
  )
}
