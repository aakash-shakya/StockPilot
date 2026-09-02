import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { HeadContent, Outlet, Scripts, createRootRoute, redirect, useRouter, useRouterState } from '@tanstack/react-router'

import { Sidebar } from '../components/Sidebar.js'
import { AgentActivityPanel } from '../components/AgentActivityPanel.js'
import { ToastProvider } from '../components/ui/Toast.js'
import { WebMcpProvider } from '../lib/webmcp/WebMcpProvider.js'
import { agentActivityStore } from '../lib/agent-activity-store.js'
import '../styles.css'

// Intercept fetch to attach JWT from localStorage — cookies don't work on Cloudflare Workers
if (typeof window !== 'undefined') {
  const originalFetch = window.fetch
  window.fetch = async (input, init) => {
    const token = localStorage.getItem('stockpilot_token')
    if (token) {
      const headers = new Headers(init?.headers as HeadersInit)
      if (!headers.has('Authorization')) {
        headers.set('Authorization', `Bearer ${token}`)
      }
      init = { ...init, headers }
    }
    return originalFetch(input, init)
  }
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
      {
        title: 'StockPilot — agent-native inventory management',
      },
      {
        name: 'description',
        content: 'Inventory management app where the dashboard and a browser-based AI agent operate on the same data through the same logic. Powered by WebMCP.',
      },
      {
        property: 'og:title',
        content: 'StockPilot — agent-native inventory management',
      },
      {
        property: 'og:description',
        content: 'Inventory management app where the dashboard and a browser-based AI agent operate on the same data through the same logic. Powered by WebMCP.',
      },
      {
        property: 'og:type',
        content: 'website',
      },
      {
        name: 'theme-color',
        content: '#0f172a',
      },
    ],
  }),
  beforeLoad: async ({ location }) => {
    const publicPaths = ['/login', '/register']
    const isPublic = publicPaths.some((p) => location.pathname === p || location.pathname.startsWith(p + '/'))
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('stockpilot_token')
      if (!token && !isPublic) {
        throw redirect({ to: '/login' })
      }
      if (token && isPublic) {
        throw redirect({ to: '/' })
      }
    }
    return { user: null }
  },
  pendingComponent: RootLoading,
  shellComponent: RootDocument,
  component: RootComponent,
})

function RootLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--color-surface-sunken)' }}>
      <div className="flex flex-col items-center gap-3">
        <div
          className="w-8 h-8 rounded-lg animate-pulse"
          style={{ backgroundColor: 'var(--color-ink)' }}
        />
        <div className="w-16 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--color-border)' }}>
          <div
            className="h-full rounded-full animate-[shimmer_1.5s_ease-in-out_infinite]"
            style={{ backgroundColor: 'var(--color-accent)', width: '40%' }}
          />
        </div>
      </div>
    </div>
  )
}

function getUserFromStorage() {
  try {
    const raw = localStorage.getItem('stockpilot_user')
    if (raw) return JSON.parse(raw)
  } catch { /* ignore */ }
  return null
}

function RootComponent() {
  const router = useRouter()
  const [user] = useState<{ id: number; name: string; email: string; role: string } | null>(getUserFromStorage)
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const isAuthPage = pathname === '/login' || pathname === '/register'
  const [agentPanelOpen, setAgentPanelOpen] = useState(false)
  const [linkNotification, setLinkNotification] = useState<{ productId: number; path: string; label: string } | null>(null)

  // Client-side auth guard: redirect to login if no token on initial load
  useEffect(() => {
    const token = localStorage.getItem('stockpilot_token')
    if (!token && !isAuthPage) {
      window.location.href = '/login'
    }
  }, [isAuthPage])

  useEffect(() => {
    const sub = agentActivityStore.subscribe(() => {
      router.invalidate()
    })
    return () => sub.unsubscribe()
  }, [router])

  // Keyboard shortcuts
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      // Cmd+/ or Ctrl+/ — toggle agent panel
      if ((e.metaKey || e.ctrlKey) && e.key === '/') {
        e.preventDefault()
        setAgentPanelOpen((v) => !v)
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [])

  // Auto-open agent panel on first tool call
  useEffect(() => {
    const handleOpenPanel = () => setAgentPanelOpen(true)
    window.addEventListener('agent:open-panel', handleOpenPanel)
    return () => window.removeEventListener('agent:open-panel', handleOpenPanel)
  }, [])

  // Handle WebMCP UI manipulation events from agent tools
  useEffect(() => {
    const handleNavigate = (e: Event) => {
      const { path } = (e as CustomEvent).detail
      if (path) router.navigate({ to: path })
    }
    const handleHighlight = (e: Event) => {
      const { productId, durationMs = 4000 } = (e as CustomEvent).detail
      const el = document.querySelector(`[data-product-id="${productId}"]`)
      if (el) {
        el.classList.add('ring-2', 'ring-emerald-400', 'ring-offset-2', 'animate-pulse')
        setTimeout(() => el.classList.remove('ring-2', 'ring-emerald-400', 'ring-offset-2', 'animate-pulse'), durationMs)
      }
    }
    const handleHighlightMiss = (e: Event) => {
      const { productId } = (e as CustomEvent).detail
      setLinkNotification({
        productId,
        path: `/products/${productId}`,
        label: `Product #${productId}`,
      })
    }
    const handleScroll = (e: Event) => {
      const { headingText, elementId } = (e as CustomEvent).detail
      let target: Element | null = null
      if (elementId) {
        target = document.getElementById(elementId)
      } else if (headingText) {
        for (const h of document.querySelectorAll('h1, h2, h3, h4')) {
          if (h.textContent?.toLowerCase().includes(headingText.toLowerCase())) {
            target = h
            break
          }
        }
      }
      target?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
    window.addEventListener('agent:navigate', handleNavigate)
    window.addEventListener('agent:highlight', handleHighlight)
    window.addEventListener('agent:highlight-miss', handleHighlightMiss)
    window.addEventListener('agent:scroll', handleScroll)
    return () => {
      window.removeEventListener('agent:navigate', handleNavigate)
      window.removeEventListener('agent:highlight', handleHighlight)
      window.removeEventListener('agent:highlight-miss', handleHighlightMiss)
      window.removeEventListener('agent:scroll', handleScroll)
    }
  }, [router])

  if (isAuthPage) {
    return (
      <div className="min-h-screen" style={{ backgroundColor: 'var(--color-surface-sunken)' }}>
        <Outlet />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex" style={{ backgroundColor: 'var(--color-surface-sunken)' }}>
      <ToastProvider>
        <Sidebar
          user={user}
          isAgentPanelOpen={agentPanelOpen}
          onToggleAgentPanel={() => setAgentPanelOpen((v) => !v)}
        />
        <div className="flex-1 flex min-w-0 min-h-screen overflow-hidden">
          <main className="flex-1 flex flex-col min-w-0 min-h-screen overflow-y-auto">
            <Outlet />
          </main>
          <AnimatePresence>
            {agentPanelOpen && (
              <motion.div
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: 360, opacity: 1 }}
                exit={{ width: 0, opacity: 0 }}
                transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                className="shrink-0 overflow-hidden border-l"
                style={{ borderColor: 'var(--color-border)' }}
              >
                <AgentActivityPanel onToggle={() => setAgentPanelOpen(false)} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <WebMcpProvider />
        {/* Sticky notification for highlight-miss: shows clickable link when product isn't on current page */}
        {linkNotification && (
          <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 bg-blue-600 text-white px-4 py-2.5 rounded-lg shadow-lg flex items-center gap-3 text-sm font-medium">
            <span>{linkNotification.label} — not on this page</span>
            <button
              className="underline font-semibold hover:text-blue-200"
              onClick={() => {
                router.navigate({ to: linkNotification.path })
                setLinkNotification(null)
              }}
            >
              View Product →
            </button>
            <button
              onClick={() => setLinkNotification(null)}
              className="ml-1 text-white/60 hover:text-white"
            >
              ×
            </button>
          </div>
        )}
      </ToastProvider>
    </div>
  )
}

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  )
}
