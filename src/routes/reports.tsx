import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { Download, FileBarChart } from 'lucide-react'
import { generateReportCsvFn, generateReportFn, getInventorySummaryFn } from '../server/inventory.functions.js'

export const Route = createFileRoute('/reports')({
  component: ReportsPage,
  loader: async () => {
    const summary = await getInventorySummaryFn()
    return { categories: summary.categories }
  },
})

const EXAMPLE_QUERIES = [
  'monthly inventory report',
  'which products have declining sales',
  'supplier performance report',
  'how much cash is tied up in dead stock',
]

function ReportsPage() {
  const { categories } = Route.useLoaderData()
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('')
  const [report, setReport] = useState<Awaited<ReturnType<typeof generateReportFn>> | null>(null)
  const [loading, setLoading] = useState(false)
  const [exporting, setExporting] = useState(false)

  async function runReport(q: string) {
    if (!q.trim()) return
    setLoading(true)
    try {
      const result = await generateReportFn({ data: { query: q, category: category || undefined } })
      setReport(result)
    } finally {
      setLoading(false)
    }
  }

  async function exportCsv() {
    if (!query.trim()) return
    setExporting(true)
    try {
      const { title, csv } = await generateReportCsvFn({ data: { query, category: category || undefined } })
      const blob = new Blob([csv], { type: 'text/csv' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${title.toLowerCase().replace(/\s+/g, '-')}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setExporting(false)
    }
  }

  const columns = report && report.rows.length > 0 ? Object.keys(report.rows[0] as Record<string, unknown>) : []

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-24">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Reports</h1>
        <p className="text-sm text-gray-500">Describe what you want in plain English. Deterministic parsing.</p>
      </div>

      <div className="panel panel-shadow overflow-hidden mb-8">
        <div className="card-header-blue px-5 py-3">
          <p className="text-xs font-semibold text-slate-700 uppercase tracking-wider">Generate a report</p>
        </div>
        <div className="p-5">
        <div className="flex flex-wrap gap-3 mb-3">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void runReport(query)}
            placeholder='e.g. "monthly inventory report" or "which suppliers are underperforming"'
            className="input flex-1 min-w-64"
          />
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="input w-auto min-w-[140px]"
          >
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <button
            onClick={() => void runReport(query)}
            disabled={loading || !query.trim()}
            className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 disabled:opacity-50"
          >
            <FileBarChart className="w-4 h-4" />
            {loading ? 'Generating…' : 'Generate'}
          </button>
        </div>
        <div className="flex gap-2 flex-wrap">
          {EXAMPLE_QUERIES.map((example) => (
            <button
              key={example}
              onClick={() => {
                setQuery(example)
                void runReport(example)
              }}
              className="text-xs text-gray-500 bg-gray-100 hover:bg-gray-200 px-2.5 py-1 rounded-full transition-colors"
            >
              {example}
            </button>
          ))}
        </div>
        </div>
      </div>

      {report && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">{report.title}</h2>
              <p className="text-xs text-gray-400">Generated {new Date(report.generatedAt).toLocaleString()}</p>
            </div>
            <button
              onClick={exportCsv}
              disabled={exporting || report.rows.length === 0}
              className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              {exporting ? 'Exporting…' : 'CSV'}
            </button>
          </div>

          <div className="panel overflow-hidden mb-6">
            <div className="grid grid-cols-2 lg:grid-cols-4 divide-x divide-y divide-slate-200">
              {report.kpis.map((kpi, idx) => (
                <div key={idx} className="px-5 py-4">
                  <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">{kpi.label}</p>
                  <p className="text-xl font-bold text-slate-900 mt-1 tabular-nums">{kpi.value ?? '—'}</p>
                </div>
              ))}
            </div>
          </div>

          {(report.findings.length > 0 || report.recommendations.length > 0) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
              <div className="panel panel-shadow p-4">
                <h3 className="text-sm font-semibold text-gray-900 mb-2">Findings</h3>
                {report.findings.length === 0 ? (
                  <p className="text-sm text-gray-400">None.</p>
                ) : (
                  <ul className="text-sm text-gray-600 space-y-1.5 list-disc list-inside">
                    {report.findings.map((f, idx) => (
                      <li key={idx}>{f}</li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="panel panel-shadow p-4">
                <h3 className="text-sm font-semibold text-gray-900 mb-2">Recommendations</h3>
                {report.recommendations.length === 0 ? (
                  <p className="text-sm text-gray-400">None.</p>
                ) : (
                  <ul className="text-sm text-gray-600 space-y-1.5 list-disc list-inside">
                    {report.recommendations.map((r, idx) => (
                      <li key={idx}>{r}</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}

          <div className="panel panel-shadow overflow-hidden">
            <div className="overflow-x-auto scrollbar-none">
              <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider border-b border-gray-100">
                  {columns.map((col) => (
                    <th key={col} className="px-5 py-3 whitespace-nowrap">
                      {col.replace(/([A-Z])/g, ' $1')}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {report.rows.map((row, idx) => (
                  <tr key={idx} className="border-b border-gray-50 last:border-0">
                    {columns.map((col) => (
                      <td key={col} className="px-5 py-2.5 text-gray-600 whitespace-nowrap text-xs">
                        {String((row as Record<string, unknown>)[col] ?? '—')}
                      </td>
                    ))}
                  </tr>
                ))}
                {report.rows.length === 0 && (
                  <tr>
                    <td className="py-12 text-center text-gray-400">No rows for this report.</td>
                  </tr>
                )}
              </tbody>
            </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
