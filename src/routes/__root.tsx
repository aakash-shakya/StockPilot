import { useEffect } from 'react'
import { HeadContent, Outlet, Scripts, createRootRoute, redirect, useRouter, useRouterState } from '@tanstack/react-router'

import { Nav } from '../components/Nav.js'
import { AgentActivityPanel } from '../components/AgentActivityPanel.js'
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
    ],
  }),
  beforeLoad: async ({ location }) => {
    const publicPaths = ['/login', '/register']
    const isPublic = publicPaths.some((p) => location.pathname === p || location.pathname.startsWith(p + '/'))
    const user = await getCurrentUserFn()
    if (!user && !isPublic) {
      throw redirect({ to: '/login' })
    }
    if (user && isPublic) {
      throw redirect({ to: '/' })
    }
    return { user }
  },
  loader: async () => {
    const user = await getCurrentUserFn()
    return { user }
  },
  shellComponent: RootDocument,
  component: RootComponent,
})

function RootComponent() {
  const router = useRouter()
  const { user } = Route.useLoaderData()
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const isAuthPage = pathname === '/login' || pathname === '/register'

  useEffect(() => {
    const sub = agentActivityStore.subscribe(() => {
      router.invalidate()
    })
    return () => sub.unsubscribe()
  }, [router])

  if (isAuthPage) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Outlet />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Nav user={user} />
      <Outlet />
      <WebMcpProvider />
      <AgentActivityPanel />
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
