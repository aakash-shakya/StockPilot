import { createFileRoute } from '@tanstack/react-router'
import { getRecentAgentActivityFn } from '../server/inventory.functions.js'
import { TOOL_CATALOG } from '../lib/webmcp/tools.js'
import { Badge } from '../components/ui/Badge.js'

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
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-8">
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <h1 className="text-2xl font-bold text-gray-900" style={{ fontFamily: 'var(--font-heading)' }}>Agent Tools</h1>
          <Badge variant="default">developer</Badge>
        </div>
        <p className="text-sm text-gray-500">WebMCP tools registered on this page with live call log.</p>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-8">
        <div className="panel panel-shadow p-4">
          <p className="text-[11px] text-gray-400 font-medium uppercase tracking-wider">Tools registered</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{TOOL_CATALOG.reduce((sum, g) => sum + g.tools.length, 0)}</p>
        </div>
        <div className="panel panel-shadow p-4">
          <p className="text-[11px] text-gray-400 font-medium uppercase tracking-wider">Calls logged</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{activity.length}</p>
        </div>
        <div className="panel panel-shadow p-4">
          <p className="text-[11px] text-gray-400 font-medium uppercase tracking-wider">Success rate</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{successRate !== null ? `${successRate}%` : '—'}</p>
        </div>
      </div>

      <h2 className="text-sm font-semibold text-gray-900 mb-3" style={{ fontFamily: 'var(--font-heading)' }}>Tool catalog</h2>
      <div className="space-y-4 mb-10">
        {TOOL_CATALOG.map((group) => (
          <div key={group.category} className="panel panel-shadow overflow-hidden">
            <div className="px-5 py-3 border-b border-[var(--color-border)] flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{group.category}</span>
              <span className="text-[11px] text-gray-400">{group.tools.length} tool(s)</span>
            </div>
            <div>
              {group.tools.map((tool) => (
                <div key={tool.name} className="px-5 py-3 flex items-start justify-between gap-4 border-b border-gray-50 last:border-0">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <code className="text-xs font-mono text-gray-900 bg-gray-100 px-1.5 py-0.5 rounded">{tool.name}</code>
                      <span className="text-[11px] text-gray-400">{callsByTool.get(tool.name) ?? 0} calls</span>
                    </div>
                    <p className="text-sm text-gray-500 mt-1">{tool.description}</p>
                  </div>
                  <Badge variant={tool.readOnly ? 'default' : 'amber'}>
                    {tool.readOnly ? 'read-only' : 'consequential'}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <h2 className="text-sm font-semibold text-gray-900 mb-3" style={{ fontFamily: 'var(--font-heading)' }}>Recent calls</h2>
      <div className="panel panel-shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider border-b border-[var(--color-border)]">
              <th className="px-5 py-3">Tool</th>
              <th className="px-5 py-3">Summary</th>
              <th className="px-5 py-3">Type</th>
              <th className="px-5 py-3">When</th>
            </tr>
          </thead>
          <tbody>
            {activity.slice(0, 50).map((a) => (
              <tr key={a.id} className="border-b border-gray-50 last:border-0">
                <td className="px-5 py-2.5 font-mono text-xs text-gray-500">{a.toolName}</td>
                <td className={`px-5 py-2.5 text-xs ${a.summary.startsWith('Failed:') ? 'text-red-600' : 'text-gray-600'}`}>{a.summary}</td>
                <td className="px-5 py-2.5">
                  <Badge variant={a.consequential ? 'amber' : 'default'}>
                    {a.consequential ? 'consequential' : 'read-only'}
                  </Badge>
                </td>
                <td className="px-5 py-2.5 text-gray-400 text-xs">{a.createdAt ? new Date(a.createdAt).toLocaleString() : ''}</td>
              </tr>
            ))}
            {activity.length === 0 && (
              <tr>
                <td colSpan={4} className="py-12 text-center text-gray-400 text-sm">
                  No tool calls logged yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
