import { useState } from 'react'
import { useStore } from '@tanstack/react-store'
import { AnimatePresence, motion } from 'framer-motion'
import { Bot, ChevronDown, ChevronUp, Loader2, ShieldAlert, CheckCircle2, XCircle } from 'lucide-react'
import { agentActivityStore } from '../lib/agent-activity-store.js'

function timeAgo(ts: number) {
  const seconds = Math.max(0, Math.round((Date.now() - ts) / 1000))
  if (seconds < 5) return 'just now'
  if (seconds < 60) return `${seconds}s ago`
  return `${Math.round(seconds / 60)}m ago`
}

function statusIcon(status: string) {
  if (status === 'running') return <Loader2 className="w-3.5 h-3.5 text-blue-500 animate-spin shrink-0" />
  if (status === 'done') return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
  return <XCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />
}

export function AgentActivityPanel() {
  const entries = useStore(agentActivityStore, (state) => state)
  const [open, setOpen] = useState(true)
  const running = entries.filter((e) => e.status === 'running').length

  return (
    <div className="fixed bottom-4 right-4 z-50 w-80 max-w-[calc(100vw-2rem)]">
      <div style={{ backgroundColor: 'var(--color-surface)' }} className="border border-[var(--color-border)] rounded-xl shadow-xl overflow-hidden">
        {/* Header */}
        <button
          onClick={() => setOpen((v) => !v)}
          className="w-full flex items-center justify-between px-4 py-2.5 bg-slate-900 text-white hover:bg-slate-800 transition-colors"
        >
          <span className="flex items-center gap-2 font-medium text-sm">
            <Bot className="w-4 h-4 text-slate-400" />
            Agent Activity
            {running > 0 && (
              <motion.span
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="inline-flex items-center gap-1 text-[11px] bg-blue-500/20 text-blue-300 px-1.5 py-0.5 rounded-full font-medium"
              >
                <Loader2 className="w-3 h-3 animate-spin" /> {running}
              </motion.span>
            )}
          </span>
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-slate-500">{entries.length}</span>
            {open ? <ChevronDown className="w-4 h-4 text-slate-500" /> : <ChevronUp className="w-4 h-4 text-slate-500" />}
          </div>
        </button>

        {/* Activity list */}
        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ height: 0 }}
              animate={{ height: 'auto' }}
              exit={{ height: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="overflow-hidden"
            >
              <div className="max-h-80 overflow-y-auto">
                {entries.length === 0 && (
                  <p style={{ fontFamily: 'var(--font-body)' }} className="px-4 py-8 text-sm text-slate-400 text-center">
                    No activity yet. Connect a WebMCP agent to see tool calls here.
                  </p>
                )}
                <AnimatePresence initial={false}>
                  {entries.map((e) => (
                    <motion.div
                      key={e.id}
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                      className="overflow-hidden"
                    >
                      <div style={{ fontFamily: 'var(--font-body)' }} className="px-4 py-2.5 text-sm border-b border-[var(--color-border)] last:border-0 hover:bg-slate-50/50 transition-colors">
                        <div className="flex items-center justify-between gap-2">
                          <span style={{ fontFamily: 'var(--font-heading)' }} className="font-medium text-slate-900 truncate">{e.title}</span>
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
                          <p style={{ fontFamily: 'var(--font-body)' }} className="mt-1 text-xs text-slate-500 break-words leading-relaxed">{e.detail}</p>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
