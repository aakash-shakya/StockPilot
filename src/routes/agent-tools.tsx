import { createFileRoute } from '@tanstack/react-router'
import { Terminal } from 'lucide-react'
import { getRecentAgentActivityFn } from '../server/inventory.functions.js'
import { TOOL_CATALOG } from '../lib/webmcp/tools.js'

export const Route = createFileRoute('/agent-tools')({
  component: AgentToolsPage,
  loader: async () => ({ activity: await getRecentAgentActivityFn({ data: { limit: 200 } }) }),
})

function AgentToolsPage() {
  const { activity } = Route.useLoaderData()
  const failed = activity.filter((a) => a.summary.startsWith('Failed:'))
  const successRate = activity.length ? Math.round(((activity.length - failed.length) / activity.length) * 100) : null

  const callsByTool = new Map<string, number>()
  for (const a of activity) callsByTool.set(a.toolName, (callsByTool.get(a.toolName) ?? 0) + 1)

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-24">
      <div className="flex items-center gap-2 mb-1">
        <Terminal className="w-5 h-5 text-gray-400" />
        <h1 className="text-3xl font-bold text-gray-900">Agent Tools</h1>
        <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">developer</span>
      </div>
      <p className="text-gray-500 mb-8">
        Every WebMCP tool registered on this page, grouped the way an agent sees them, plus a live call log.
      </p>

      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="panel panel-shadow p-4">
          <p className="text-xs text-gray-500">Tools registered</p>
          <p className="text-2xl font-bold text-gray-900">{TOOL_CATALOG.reduce((sum, g) => sum + g.tools.length, 0)}</p>
        </div>
        <div className="panel panel-shadow p-4">
          <p className="text-xs text-gray-500">Calls logged (last 200)</p>
          <p className="text-2xl font-bold text-gray-900">{activity.length}</p>
        </div>
        <div className="panel panel-shadow p-4">
          <p className="text-xs text-gray-500">Success rate</p>
          <p className="text-2xl font-bold text-gray-900">{successRate !== null ? `${successRate}%` : '—'}</p>
        </div>
      </div>

      <h2 className="text-lg font-semibold text-gray-900 mb-3">Tool catalog</h2>
      <div className="space-y-6 mb-10">
        {TOOL_CATALOG.map((group) => (
          <div key={group.category} className="panel panel-shadow overflow-hidden">
            <div className="px-4 py-2.5 bg-gray-50 border-b flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-500 tracking-wide">{group.category}</span>
              <span className="text-xs text-gray-400">{group.tools.length} tool(s)</span>
            </div>
            <div className="divide-y">
              {group.tools.map((tool) => (
                <div key={tool.name} className="px-4 py-3 flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <code className="text-xs font-mono text-gray-900 bg-gray-100 px-1.5 py-0.5 rounded">{tool.name}</code>
                      <span className="text-xs text-gray-400">{callsByTool.get(tool.name) ?? 0} call(s)</span>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">{tool.description}</p>
                  </div>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${tool.readOnly ? 'bg-gray-100 text-gray-600' : 'bg-amber-50 text-amber-700'}`}
                  >
                    {tool.readOnly ? 'read-only' : 'consequential'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <h2 className="text-lg font-semibold text-gray-900 mb-3">Recent calls</h2>
      <div className="panel panel-shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 border-b bg-gray-50">
              <th className="py-2.5 px-4">Tool</th>
              <th className="py-2.5 px-4">Summary</th>
              <th className="py-2.5 px-4">Type</th>
              <th className="py-2.5 px-4">When</th>
            </tr>
          </thead>
          <tbody>
            {activity.slice(0, 50).map((a) => (
              <tr key={a.id} className="border-b last:border-0">
                <td className="py-2 px-4 font-mono text-xs text-gray-500">{a.toolName}</td>
                <td className={`py-2 px-4 ${a.summary.startsWith('Failed:') ? 'text-red-600' : 'text-gray-700'}`}>{a.summary}</td>
                <td className="py-2 px-4">
                  {a.consequential ? (
                    <span className="text-xs text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">consequential</span>
                  ) : (
                    <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">read-only</span>
                  )}
                </td>
                <td className="py-2 px-4 text-gray-400">{a.createdAt ? new Date(a.createdAt).toLocaleString() : ''}</td>
              </tr>
            ))}
            {activity.length === 0 && (
              <tr>
                <td colSpan={4} className="py-8 text-center text-gray-400">
                  No tool calls logged yet. Connect a WebMCP-capable agent to this tab to see activity here.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
