import { useEffect } from 'react'
import { registerInventoryWebMCPTools } from './tools.js'

export function WebMcpProvider() {
  useEffect(() => {
    let cleanup: (() => void) | undefined
    registerInventoryWebMCPTools().then((fn) => {
      cleanup = fn
    })
    return () => cleanup?.()
  }, [])

  return null
}
