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
      await decideAgentActionFn({ data: { actionId, decision } })
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
          <h1 className="text-2xl font-bold text-gray-900">Agent Actions</h1>
          <p className="text-sm text-gray-500 mt-1">
            Consequential actions proposed by agents. Nothing executes until approved.
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

      {message && (
        <div className="mb-6 text-sm bg-blue-50 text-blue-700 px-4 py-2.5 rounded-lg border border-blue-100">{message}</div>
      )}

      <h2 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
        <span className="w-1 h-4 bg-amber-500 rounded-full" />
        Pending <span className="bg-amber-500 text-white px-2 py-0.5 rounded-full text-xs font-bold">{pending.length}</span>
      </h2>
      {pending.length === 0 ? (
        <p className="text-sm text-gray-400 mb-8">Nothing waiting on you.</p>
      ) : (
        <div className="space-y-3 mb-8">
          {pending.map((action) => (
            <div
              key={action.id}
              className="panel p-5"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-gray-900 text-sm">{action.title}</h3>
                    <ImpactBadge impact={action.impact} />
                    {action.estimatedCostCents != null && (
                      <span className="text-xs text-gray-400">{formatMoney(action.estimatedCostCents)}</span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500">{action.reasoning}</p>
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

      <h2 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
        <span className="w-1 h-4 bg-slate-700 rounded-full" />
        History <span className="bg-slate-900 text-white px-2 py-0.5 rounded-full text-xs font-bold">{decided.length}</span>
      </h2>
      {decided.length === 0 ? (
        <p className="text-sm text-gray-400">No decided actions yet.</p>
      ) : (
        <div className="panel panel-shadow overflow-hidden">
          <div className="card-header-slate px-5 py-3">
            <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Action history</p>
          </div>
          <div className="overflow-x-auto scrollbar-none">
            <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider border-b border-gray-100">
                <th className="px-5 py-3">Title</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Impact</th>
                <th className="px-5 py-3">Result</th>
                <th className="px-5 py-3">Decided</th>
              </tr>
            </thead>
            <tbody>
              {decided.map((action) => (
                <tr key={action.id} className="border-b border-gray-50 last:border-0">
                  <td className="px-5 py-3 font-medium text-gray-900">{action.title}</td>
                  <td className="px-5 py-3">
                    <ActionStatusBadge status={action.status} />
                  </td>
                  <td className="px-5 py-3">
                    <ImpactBadge impact={action.impact} />
                  </td>
                  <td className="px-5 py-3 text-gray-500 text-xs">{action.resultSummary ?? '—'}</td>
                  <td className="px-5 py-3 text-gray-400 text-xs">
                    {action.decidedAt ? new Date(action.decidedAt).toLocaleString() : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
            </table>
          </div>
        </div>
      )}

      <p className="text-xs text-gray-400 mt-6">
        See{' '}
        <Link to="/agent-tools" className="text-blue-600 hover:text-blue-700">
          Agent Tools
        </Link>{' '}
        for the full raw call log.
      </p>
    </div>
  )
}
