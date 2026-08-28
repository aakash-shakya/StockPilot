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

  const draftCount = purchaseOrders.filter((po) => po.status === 'draft').length
  const approvedCount = purchaseOrders.filter((po) => po.status === 'approved').length
  const receivedCount = purchaseOrders.filter((po) => po.status === 'received').length

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-24">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Purchase Orders</h1>
        <p className="text-sm text-gray-500">
          {purchaseOrders.length} orders total · {draftCount} draft · {approvedCount} approved · {receivedCount} received
        </p>
      </div>

      <div className="space-y-3">
        {purchaseOrders.map((po) => (
          <div
            key={po.id}
            className={`panel panel-shadow overflow-hidden ${
              po.status === 'draft'
                ? 'border-l-4 border-l-slate-400'
                : po.status === 'approved'
                  ? 'border-l-4 border-l-blue-500'
                  : 'border-l-4 border-l-emerald-500'
            }`}
          >
            <div className="p-5">
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-semibold text-gray-900 text-sm">{po.poNumber}</h2>
                  <PoStatusBadge status={po.status} />
                  {po.createdBy === 'agent' && (
                    <span className="text-[11px] text-violet-600 bg-violet-50 px-1.5 py-0.5 rounded-full font-medium">agent-created</span>
                  )}
                </div>
                <p className="text-sm text-gray-500 mt-0.5">{po.supplierName}</p>
                {po.notes && <p className="text-xs text-gray-400 mt-0.5">{po.notes}</p>}
              </div>
              <div className="text-right">
                <p className="font-semibold text-gray-900 text-sm">{formatMoney(po.totalCostCents)}</p>
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
                  <tr key={item.productId} className="border-t border-gray-50">
                    <td className="py-2 text-gray-700">{item.productName}</td>
                    <td className="py-2 text-gray-400 text-right w-24 font-mono text-xs">×{item.quantity}</td>
                    <td className="py-2 text-gray-500 text-right w-28">{formatMoney(item.unitCostCents)} ea</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
        ))}
        {purchaseOrders.length === 0 && (
          <div className="panel panel-shadow p-12 text-center">
            <p className="text-gray-400">No purchase orders yet.</p>
          </div>
        )}
      </div>
    </div>
  )
}
