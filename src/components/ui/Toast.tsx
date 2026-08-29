import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from 'lucide-react'
import { cn } from '../../lib/cn.js'

type ToastType = 'success' | 'error' | 'warning' | 'info'

interface Toast {
  id: string
  type: ToastType
  title: string
  description?: string
}

interface ToastContextValue {
  toast: (opts: { type?: ToastType; title: string; description?: string }) => void
}

const ToastContext = createContext<ToastContextValue>({ toast: () => {} })

export function useToast() {
  return useContext(ToastContext)
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const toast = useCallback(
    (opts: { type?: ToastType; title: string; description?: string }) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
      setToasts((prev) => [...prev, { id, type: opts.type ?? 'info', ...opts }])
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id))
      }, 4000)
    },
    [],
  )

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      {createPortal(
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2 w-full max-w-sm pointer-events-none">
          <AnimatePresence>
            {toasts.map((t) => (
              <motion.div
                key={t.id}
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10, scale: 0.95 }}
                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                className={cn(
                  'pointer-events-auto flex items-start gap-3 p-3.5 rounded-xl border shadow-lg backdrop-blur-sm',
                  t.type === 'success' && 'bg-emerald-50/95 border-emerald-200 text-emerald-900',
                  t.type === 'error' && 'bg-red-50/95 border-red-200 text-red-900',
                  t.type === 'warning' && 'bg-amber-50/95 border-amber-200 text-amber-900',
                  t.type === 'info' && 'bg-blue-50/95 border-blue-200 text-blue-900',
                )}
              >
                <div className="mt-0.5 shrink-0">
                  {t.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
                  {t.type === 'error' && <XCircle className="w-4 h-4 text-red-600" />}
                  {t.type === 'warning' && <AlertTriangle className="w-4 h-4 text-amber-600" />}
                  {t.type === 'info' && <Info className="w-4 h-4 text-blue-600" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold">{t.title}</p>
                  {t.description && <p className="text-xs mt-0.5 opacity-80">{t.description}</p>}
                </div>
                <button onClick={() => dismiss(t.id)} className="shrink-0 p-0.5 rounded hover:bg-black/5">
                  <X className="w-3.5 h-3.5 opacity-50" />
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  )
}
