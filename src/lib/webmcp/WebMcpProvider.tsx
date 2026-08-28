import { useEffect } from 'react'
import { registerInventoryWebMCPTools } from './tools.js'

export function WebMcpProvider() {
  useEffect(() => {
    let cleanup: (() => void) | undefined
    let cancelled = false
    registerInventoryWebMCPTools()
      .then((fn) => {
        if (cancelled) {
          fn()
          return
        }
        cleanup = fn
      })
      .catch((err) => {
        console.warn('[WebMCP] registration failed', err)
      })
    return () => {
      cancelled = true
      cleanup?.()
    }
  }, [])

  return null
}
