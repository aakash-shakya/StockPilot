import { useStore } from '@tanstack/react-store'
import { AnimatePresence, motion } from 'framer-motion'
import { Bot, Loader2, ShieldAlert, CheckCircle2, XCircle, X } from 'lucide-react'
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
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40"
            style={{ backgroundColor: 'rgba(0, 0, 0, 0.2)', backdropFilter: 'blur(2px)' }}
            onClick={onToggle}
          />

          {/* Drawer */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed top-0 right-0 h-full z-50 flex flex-col border-l"
            style={{
              width: '360px',
              maxWidth: '100vw',
              backgroundColor: 'var(--color-surface)',
              borderColor: 'var(--color-border)',
              boxShadow: '-4px 0 24px rgba(0, 0, 0, 0.08)',
            }}
          >
            {/* Header */}
            <div
              className="flex items-center justify-between px-4 py-3 border-b shrink-0"
              style={{ borderColor: 'var(--color-border)' }}
            >
              <span
                className="flex items-center gap-2 text-sm font-semibold"
                style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-ink)' }}
              >
                <Bot className="w-4 h-4" style={{ color: 'var(--color-accent)' }} />
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
              <div className="flex items-center gap-3">
                <span className="text-[11px]" style={{ color: 'var(--color-ink-muted)' }}>
                  {entries.length} calls
                </span>
                <button
                  onClick={onToggle}
                  className="p-1 rounded-md hover:bg-slate-100 transition-colors"
                  aria-label="Close panel"
                >
                  <X className="w-4 h-4" style={{ color: 'var(--color-ink-muted)' }} />
                </button>
              </div>
            </div>

            {/* Activity list */}
            <div className="flex-1 overflow-y-auto min-h-0">
              {entries.length === 0 && (
                <p
                  className="px-4 py-12 text-sm text-center"
                  style={{ color: 'var(--color-ink-muted)', fontFamily: 'var(--font-body)' }}
                >
                  No activity yet. Connect a WebMCP agent to see tool calls here.
                </p>
              )}
              <div className="divide-y" style={{ borderColor: 'var(--color-border)' }}>
                {entries.map((e) => (
                  <div
                    key={e.id}
                    className="px-4 py-3 text-sm transition-colors hover:bg-slate-50/50"
                    style={{ fontFamily: 'var(--font-body)' }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className="font-medium truncate"
                        style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-ink)' }}
                      >
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
                      <span className="text-[11px]" style={{ color: 'var(--color-ink-muted)' }}>
                        {timeAgo(e.createdAt)}
                      </span>
                    </div>
                    {e.detail && (
                      <p
                        className="mt-1 text-xs leading-relaxed break-words"
                        style={{ color: 'var(--color-ink-secondary)' }}
                      >
                        {e.detail}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
