import { useState } from 'react'
import { createFileRoute, useRouter } from '@tanstack/react-router'
import { approvePurchaseOrderFn, getPurchaseOrdersFn, receiveShipmentFn } from '../server/inventory.functions.js'
import { formatMoney } from '../server/format.js'
import { PoStatusBadge } from '../components/badges.js'

export const Route = createFileRoute('/purchase-orders')({
  component: PurchaseOrdersList,
  loader: async () => ({ purchaseOrders: await getPurchaseOrdersFn() }),
})

function PurchaseOrdersList() {
  const { purchaseOrders } = Route.useLoaderData()
  const router = useRouter()
  const [busyId, setBusyId] = useState<number | null>(null)

  async function approve(id: number) {
    setBusyId(id)
    try {
      await approvePurchaseOrderFn({ data: { purchaseOrderId: id } })
      await router.invalidate()
    } finally {
      setBusyId(null)
    }
  }

  async function receive(id: number) {
    setBusyId(id)
    try {
      await receiveShipmentFn({ data: { purchaseOrderId: id, actor: 'human' } })
      await router.invalidate()
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-24">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Purchase Orders</h1>

      <div className="space-y-4">
        {purchaseOrders.map((po) => (
          <div key={po.id} className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-semibold text-gray-900">{po.poNumber}</h2>
                  <PoStatusBadge status={po.status} />
                  {po.createdBy === 'agent' && (
                    <span className="text-xs text-violet-600 bg-violet-50 px-2 py-0.5 rounded-full">created by agent</span>
                  )}
                </div>
                <p className="text-sm text-gray-500">{po.supplierName}</p>
                {po.notes && <p className="text-xs text-gray-400 mt-0.5">{po.notes}</p>}
              </div>
              <div className="text-right">
                <p className="font-semibold text-gray-900">{formatMoney(po.totalCostCents)}</p>
                <div className="mt-2 flex gap-2 justify-end">
                  {po.status === 'draft' && (
                    <button
                      onClick={() => approve(po.id)}
                      disabled={busyId === po.id}
                      className="px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
                    >
                      {busyId === po.id ? 'Approving…' : 'Approve'}
                    </button>
                  )}
                  {po.status === 'approved' && (
                    <button
                      onClick={() => receive(po.id)}
                      disabled={busyId === po.id}
                      className="px-3 py-1.5 bg-emerald-600 text-white text-xs font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-50"
                    >
                      {busyId === po.id ? 'Receiving…' : 'Mark received'}
                    </button>
                  )}
                </div>
              </div>
            </div>
            <table className="w-full text-sm">
              <tbody>
                {po.items.map((item) => (
                  <tr key={item.productId} className="border-t">
                    <td className="py-2 text-gray-700">{item.productName}</td>
                    <td className="py-2 text-gray-500 text-right w-24">×{item.quantity}</td>
                    <td className="py-2 text-gray-500 text-right w-28">{formatMoney(item.unitCostCents)} ea</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
        {purchaseOrders.length === 0 && <p className="text-gray-500">No purchase orders yet.</p>}
      </div>
    </div>
  )
}
