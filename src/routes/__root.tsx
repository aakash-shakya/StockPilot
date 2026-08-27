import { useEffect } from 'react'
import { HeadContent, Outlet, Scripts, createRootRoute, useRouter } from '@tanstack/react-router'

import { Nav } from '../components/Nav.js'
import { AgentActivityPanel } from '../components/AgentActivityPanel.js'
import { WebMcpProvider } from '../lib/webmcp/WebMcpProvider.js'
import { agentActivityStore } from '../lib/agent-activity-store.js'
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
  shellComponent: RootDocument,
  component: RootComponent,
})

function RootComponent() {
  const router = useRouter()

  useEffect(() => {
    const sub = agentActivityStore.subscribe(() => {
      router.invalidate()
    })
    return () => sub.unsubscribe()
  }, [router])

  return (
    <div className="min-h-screen bg-gray-50">
      <Nav />
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
