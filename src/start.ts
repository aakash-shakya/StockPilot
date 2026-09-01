import { createStart } from '@tanstack/react-start'
import { authMiddleware } from './server/auth-middleware.js'

export const startInstance = createStart(() => ({
  requestMiddleware: [authMiddleware],
}))
