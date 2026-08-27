import { useState } from 'react'
import { createFileRoute, Link, useRouter } from '@tanstack/react-router'
import { Sparkles } from 'lucide-react'
import { createReplenishmentProposalsFn, decideAgentActionFn, listAgentActionsFn } from '../server/inventory.functions.js'
import { formatMoney } from '../server/format.js'
import { ActionStatusBadge, ImpactBadge } from '../components/badges.js'

export const Route = createFileRoute('/agent-actions')({
  component: AgentActionsPage,
  loader: async () => ({ actions: await listAgentActionsFn({ data: {} }) }),
})

function AgentActionsPage() {
  const { actions } = Route.useLoaderData()
  const router = useRouter()
  const [busyId, setBusyId] = useState<number | null>(null)
  const [runningReplenishment, setRunningReplenishment] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const pending = actions.filter((a) => a.status === 'pending')
  const decided = actions.filter((a) => a.status !== 'pending')

  async function decide(actionId: number, decision: 'approved' | 'rejected') {
    setBusyId(actionId)
    try {
      await decideAgentActionFn({ data: { actionId, decision, decidedBy: 'human' } })
      await router.invalidate()
    } finally {
      setBusyId(null)
    }
  }

  async function runReplenishment() {
    setRunningReplenishment(true)
    setMessage(null)
    try {
      const proposals = await createReplenishmentProposalsFn({ data: {} })
      setMessage(
        proposals.length
          ? `Filed ${proposals.length} replenishment proposal(s) for approval.`
          : 'Nothing to replenish right now — no products are at risk within the look-ahead window.',
      )
      await router.invalidate()
    } finally {
      setRunningReplenishment(false)
    }
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-24">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Agent Action Center</h1>
          <p className="text-gray-500 mt-1">
            Every consequential action an agent proposes lands here first. Nothing executes until it's approved.
          </p>
        </div>
        <button
          onClick={runReplenishment}
          disabled={runningReplenishment}
          className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 disabled:opacity-50 shrink-0"
        >
          <Sparkles className="w-4 h-4" />
          {runningReplenishment ? 'Building plan…' : 'Run Smart Replenishment'}
        </button>
      </div>

      {message && <div className="mb-6 text-sm bg-blue-50 text-blue-700 px-4 py-2 rounded-lg">{message}</div>}

      <h2 className="text-lg font-semibold text-gray-900 mb-3">Pending approval ({pending.length})</h2>
      {pending.length === 0 ? (
        <p className="text-sm text-gray-500 mb-8">Nothing waiting on you right now.</p>
      ) : (
        <div className="space-y-4 mb-8">
          {pending.map((action) => (
            <div key={action.id} className="panel panel-shadow p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-gray-900">{action.title}</h3>
                    <ImpactBadge impact={action.impact} />
                    {action.estimatedCostCents != null && (
                      <span className="text-xs text-gray-400">{formatMoney(action.estimatedCostCents)}</span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600">{action.reasoning}</p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => decide(action.id, 'approved')}
                    disabled={busyId === action.id}
                    className="px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => decide(action.id, 'rejected')}
                    disabled={busyId === action.id}
                    className="px-3 py-1.5 bg-gray-100 text-gray-700 text-xs font-medium rounded-lg hover:bg-gray-200 disabled:opacity-50"
                  >
                    Reject
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <h2 className="text-lg font-semibold text-gray-900 mb-3">History</h2>
      {decided.length === 0 ? (
        <p className="text-sm text-gray-500">No decided actions yet.</p>
      ) : (
        <div className="panel panel-shadow overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b bg-gray-50">
                <th className="py-2.5 px-4">Title</th>
                <th className="py-2.5 px-4">Status</th>
                <th className="py-2.5 px-4">Impact</th>
                <th className="py-2.5 px-4">Result</th>
                <th className="py-2.5 px-4">Decided</th>
              </tr>
            </thead>
            <tbody>
              {decided.map((action) => (
                <tr key={action.id} className="border-b last:border-0">
                  <td className="py-2.5 px-4 text-gray-900">{action.title}</td>
                  <td className="py-2.5 px-4">
                    <ActionStatusBadge status={action.status} />
                  </td>
                  <td className="py-2.5 px-4">
                    <ImpactBadge impact={action.impact} />
                  </td>
                  <td className="py-2.5 px-4 text-gray-500">{action.resultSummary ?? '—'}</td>
                  <td className="py-2.5 px-4 text-gray-400">
                    {action.decidedAt ? new Date(action.decidedAt).toLocaleString() : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-sm text-gray-400 mt-6">
        Looking for the full raw call log instead of proposals? See{' '}
        <Link to="/agent-tools" className="text-blue-600 hover:underline">
          Agent Tools
        </Link>
        .
      </p>
    </div>
  )
}
