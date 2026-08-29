import { useEffect } from 'react'
import { HeadContent, Outlet, Scripts, createRootRoute, redirect, useRouter, useRouterState } from '@tanstack/react-router'

import { Nav } from '../components/Nav.js'
import { AgentActivityPanel } from '../components/AgentActivityPanel.js'
import { ToastProvider } from '../components/ui/Toast.js'
import { WebMcpProvider } from '../lib/webmcp/WebMcpProvider.js'
import { agentActivityStore } from '../lib/agent-activity-store.js'
import { getCurrentUserFn } from '../server/auth.functions.js'
import '../styles.css'

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
    let user = null
    try {
      user = await getCurrentUserFn()
    } catch (err) {
      console.error('[root] getCurrentUserFn failed, treating as logged out:', err)
    }
    if (!user && !isPublic) {
      throw redirect({ to: '/login' })
    }
    if (user && isPublic) {
      throw redirect({ to: '/' })
    }
    return { user }
  },
  shellComponent: RootDocument,
  component: RootComponent,
})

function RootComponent() {
  const router = useRouter()
  const { user } = Route.useRouteContext()
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const isAuthPage = pathname === '/login' || pathname === '/register'

  useEffect(() => {
    const sub = agentActivityStore.subscribe(() => {
      router.invalidate()
    })
    return () => sub.unsubscribe()
  }, [router])

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
    window.addEventListener('agent:scroll', handleScroll)
    return () => {
      window.removeEventListener('agent:navigate', handleNavigate)
      window.removeEventListener('agent:highlight', handleHighlight)
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
    <div className="min-h-screen" style={{ backgroundColor: 'var(--color-surface-sunken)' }}>
      <ToastProvider>
        <Nav user={user} />
        <Outlet />
        <WebMcpProvider />
        <AgentActivityPanel />
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
