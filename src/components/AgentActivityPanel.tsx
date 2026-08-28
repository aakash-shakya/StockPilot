import { useState } from 'react'
import { useStore } from '@tanstack/react-store'
import { Bot, ChevronDown, ChevronUp, Loader2, ShieldAlert, CheckCircle2, XCircle } from 'lucide-react'
import { agentActivityStore } from '../lib/agent-activity-store.js'

function timeAgo(ts: number) {
  const seconds = Math.max(0, Math.round((Date.now() - ts) / 1000))
  if (seconds < 5) return 'just now'
  if (seconds < 60) return `${seconds}s ago`
  return `${Math.round(seconds / 60)}m ago`
}

export function AgentActivityPanel() {
  const entries = useStore(agentActivityStore, (state) => state)
  const [open, setOpen] = useState(true)
  const running = entries.filter((e) => e.status === 'running').length

  return (
    <div className="fixed bottom-4 right-4 z-50 w-80 max-w-[calc(100vw-2rem)]">
      <div className="bg-white border border-gray-200/80 rounded-xl shadow-lg overflow-hidden">
        <button
          onClick={() => setOpen((v) => !v)}
          className="w-full flex items-center justify-between px-4 py-2.5 bg-gray-900 text-white"
        >
          <span className="flex items-center gap-2 font-medium text-sm">
            <Bot className="w-4 h-4 text-gray-400" />
            Agent Activity
            {running > 0 && (
              <span className="inline-flex items-center gap-1 text-[11px] bg-blue-500/20 text-blue-300 px-1.5 py-0.5 rounded-full font-medium">
                <Loader2 className="w-3 h-3 animate-spin" /> {running}
              </span>
            )}
          </span>
          {open ? <ChevronDown className="w-4 h-4 text-gray-500" /> : <ChevronUp className="w-4 h-4 text-gray-500" />}
        </button>

        {open && (
          <div className="max-h-80 overflow-y-auto">
            {entries.length === 0 && (
              <p className="px-4 py-8 text-sm text-gray-400 text-center">
                No activity yet. Connect a WebMCP agent to see tool calls here.
              </p>
            )}
            {entries.map((e) => (
              <div key={e.id} className="px-4 py-2.5 text-sm border-b border-gray-100 last:border-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-gray-900 truncate">{e.title}</span>
                  {e.status === 'running' && <Loader2 className="w-3.5 h-3.5 text-blue-500 animate-spin shrink-0" />}
                  {e.status === 'done' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />}
                  {e.status === 'error' && <XCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />}
                </div>
                <div className="flex items-center gap-1.5 mt-0.5 text-xs text-gray-400">
                  {e.consequential && (
                    <span className="inline-flex items-center gap-0.5 text-amber-600 font-medium">
                      <ShieldAlert className="w-3 h-3" /> consequential
                    </span>
                  )}
                  <span>{timeAgo(e.createdAt)}</span>
                </div>
                {e.detail && <p className="mt-1 text-xs text-gray-500 break-words">{e.detail}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
