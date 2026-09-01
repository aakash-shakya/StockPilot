import { createMiddleware } from '@tanstack/react-start'
import { verifyJwt } from './auth.server.js'
import type { SafeUser } from './auth.server.js'

export interface AuthContext {
  authUser: SafeUser | null
}

async function extractUser(request: Request): Promise<SafeUser | null> {
  const authHeader = request.headers.get('Authorization')
  if (authHeader) {
    const token = authHeader.replace(/^Bearer\s+/i, '').trim()
    if (token) return verifyJwt(token)
  }
  return null
}

export const authMiddleware = createMiddleware()
  .server(async ({ request, next }) => {
    const authUser = await extractUser(request)
    return next({ context: { authUser } satisfies AuthContext } as any)
  })

/**
 * Require authenticated user from middleware context.
 * Returns the user or throws 401.
 */
export function requireAuthFromContext(context: any): SafeUser {
  const user = context?.authUser as SafeUser | null
  if (!user) throw new Error('Unauthorized')
  return user
}
