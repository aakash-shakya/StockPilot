import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import * as auth from './auth.server.js'

export const registerFn = createServerFn({ method: 'POST' })
  .inputValidator(
    z.object({
      email: z.string().email(),
      password: z.string().min(8, 'Password must be at least 8 characters'),
      name: z.string().min(2),
    }),
  )
  .handler(async ({ data }) => {
    const user = await auth.createUser(data)
    const { token, expiresAt } = await auth.createSession(user.id)
    return { token, expiresAt: expiresAt.toISOString(), user: { id: user.id, email: user.email, name: user.name, role: user.role } }
  })

export const loginFn = createServerFn({ method: 'POST' })
  .inputValidator(
    z.object({
      email: z.string().email(),
      password: z.string().min(1),
    }),
  )
  .handler(async ({ data }) => {
    const user = await auth.authenticateUser(data.email, data.password)
    const { token, expiresAt } = await auth.createSession(user.id)
    return { token, expiresAt: expiresAt.toISOString(), user: { id: user.id, email: user.email, name: user.name, role: user.role } }
  })

export const logoutFn = createServerFn({ method: 'POST' }).handler(async () => {
  return { ok: true }
})

/** Read current user from middleware auth context. */
export const getCurrentUserFn = createServerFn({ method: 'GET' }).handler(async ({ context }) => {
  return (context as any)?.authUser ?? null
})

/** Require authenticated user — throws if not logged in. */
export const requireAuthFn = createServerFn({ method: 'GET' }).handler(async ({ context }) => {
  const user = (context as any)?.authUser
  if (!user) throw new Error('Unauthorized')
  return user
})
