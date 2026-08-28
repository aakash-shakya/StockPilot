import { createServerFn } from '@tanstack/react-start'
import { getCookie, setCookie, deleteCookie } from '@tanstack/start-server-core'
import { z } from 'zod'
import * as auth from './auth.server.js'

const COOKIE_NAME = auth.getSessionCookieName()

function cookieOptions(expiresAt?: Date) {
  const isProd = process.env.NODE_ENV === 'production'
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax' as const,
    path: '/',
    expires: expiresAt,
    maxAge: expiresAt ? Math.floor((expiresAt.getTime() - Date.now()) / 1000) : undefined,
  }
}

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
    setCookie(COOKIE_NAME, token, cookieOptions(expiresAt))
    return user
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
    setCookie(COOKIE_NAME, token, cookieOptions(expiresAt))
    return user
  })

export const logoutFn = createServerFn({ method: 'POST' }).handler(async () => {
  const token = getCookie(COOKIE_NAME)
  if (token) {
    await auth.deleteSession(token)
    deleteCookie(COOKIE_NAME, { path: '/' })
  }
  return { ok: true }
})

export const getCurrentUserFn = createServerFn({ method: 'GET' }).handler(async () => {
  const token = getCookie(COOKIE_NAME)
  if (!token) return null
  const user = await auth.validateSessionToken(token)
  return user
})

export const requireAuthFn = createServerFn({ method: 'GET' }).handler(async () => {
  const token = getCookie(COOKIE_NAME)
  const user = token ? await auth.validateSessionToken(token) : null
  if (!user) throw new Error('Unauthorized')
  return user
})
