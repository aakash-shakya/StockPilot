import { useStore } from '@tanstack/react-store'
import { AnimatePresence, motion } from 'framer-motion'
import { Bot, Loader2, ShieldAlert, CheckCircle2, XCircle, ChevronDown, ChevronUp } from 'lucide-react'
import { agentActivityStore } from '../lib/agent-activity-store.js'

function timeAgo(ts: number) {
  const seconds = Math.max(0, Math.round((Date.now() - ts) / 1000))
  if (seconds < 5) return 'just now'
  if (seconds < 60) return `${seconds}s ago`
  return `${Math.round(seconds / 60)}m ago`
}

function statusIcon(status: string) {
  if (status === 'running') return <Loader2 className="w-3.5 h-3.5 text-blue-400 animate-spin shrink-0" />
  if (status === 'done') return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
  return <XCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
}

interface AgentActivityDrawerProps {
  open: boolean
  onToggle: () => void
}

export function AgentActivityDrawer({ open, onToggle }: AgentActivityDrawerProps) {
  const entries = useStore(agentActivityStore, (state) => state)
  const running = entries.filter((e) => e.status === 'running').length

  return (
    <div
      className="border-t flex flex-col"
      style={{
        backgroundColor: 'var(--color-surface)',
        borderColor: 'var(--color-border)',
        height: open ? '280px' : '40px',
        transition: 'height 0.2s ease',
        minHeight: '40px',
      }}
    >
      {/* Handle / Header */}
      <button
        onClick={onToggle}
        className="flex items-center justify-between px-4 h-10 shrink-0 hover:bg-slate-50 transition-colors"
      >
        <span className="flex items-center gap-2 text-[13px] font-semibold text-slate-700" style={{ fontFamily: 'var(--font-heading)' }}>
          <Bot className="w-4 h-4 text-slate-500" />
          Agent Activity
          {running > 0 && (
            <motion.span
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="inline-flex items-center gap-1 text-[11px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-medium"
            >
              <Loader2 className="w-3 h-3 animate-spin" /> {running}
            </motion.span>
          )}
        </span>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-slate-400">{entries.length} calls</span>
          {open ? (
            <ChevronDown className="w-4 h-4 text-slate-400" />
          ) : (
            <ChevronUp className="w-4 h-4 text-slate-400" />
          )}
        </div>
      </button>

      {/* Activity list */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="flex-1 overflow-y-auto min-h-0"
          >
            {entries.length === 0 && (
              <p className="px-4 py-6 text-sm text-slate-400 text-center" style={{ fontFamily: 'var(--font-body)' }}>
                No activity yet. Connect a WebMCP agent to see tool calls here.
              </p>
            )}
            <div className="divide-y divide-slate-100">
              {entries.map((e) => (
                <div
                  key={e.id}
                  className="px-4 py-2.5 text-sm hover:bg-slate-50/50 transition-colors"
                  style={{ fontFamily: 'var(--font-body)' }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-slate-900 truncate" style={{ fontFamily: 'var(--font-heading)' }}>
                      {e.title}
                    </span>
                    {statusIcon(e.status)}
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    {e.consequential && (
                      <span className="inline-flex items-center gap-0.5 text-[11px] text-amber-600 font-medium">
                        <ShieldAlert className="w-3 h-3" /> consequential
                      </span>
                    )}
                    <span className="text-[11px] text-slate-400">{timeAgo(e.createdAt)}</span>
                  </div>
                  {e.detail && (
                    <p className="mt-1 text-xs text-slate-500 break-words leading-relaxed">{e.detail}</p>
                  )}
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
