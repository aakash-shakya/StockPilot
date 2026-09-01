import { eq } from 'drizzle-orm'
import bcrypt from 'bcryptjs'
import { SignJWT, jwtVerify } from 'jose'
import { db } from '../../db/index.js'
import { users } from '../../db/schema.js'

const SESSION_COOKIE = 'stockpilot_session'
const SESSION_MAX_AGE_DAYS = 7
const BCRYPT_ROUNDS = 12

// ---------------------------------------------------------------------------
// Rate limiting (in-memory, per-Worker instance)
// ---------------------------------------------------------------------------
const loginAttempts = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000 // 15 minutes
const RATE_LIMIT_MAX = 10 // max attempts per window

/**
 * Check rate limit for login attempts. Throws if limit exceeded.
 * Uses a simple in-memory map — resets on Worker restart, acceptable for demo.
 */
export function checkLoginRateLimit(identifier: string) {
  const now = Date.now()
  const entry = loginAttempts.get(identifier)

  if (entry && now < entry.resetAt) {
    if (entry.count >= RATE_LIMIT_MAX) {
      const retryAfter = Math.ceil((entry.resetAt - now) / 1000)
      throw new Error(`Too many login attempts. Try again in ${retryAfter}s.`)
    }
    entry.count++
  } else {
    loginAttempts.set(identifier, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS })
  }
}

function getJwtSecret() {
  const secret = process.env.JWT_SECRET
  if (secret) return new TextEncoder().encode(secret)
  // In production, fail loudly instead of silently using a weak fallback
  if (process.env.NODE_ENV === 'production') {
    throw new Error('[auth] JWT_SECRET is not set. Configure it in your Cloudflare Worker secrets.')
  }
  // Dev-only fallback — never shipped to production
  console.warn('[auth] No JWT_SECRET set, using dev fallback. Set JWT_SECRET for production.')
  return new TextEncoder().encode('stockpilot-dev-fallback-secret-not-for-production')
}

/**
 * Extract auth user from the incoming request.
 * Tries: Authorization header → cookie → null.
 * Works on Cloudflare Workers (no H3 cookie manipulation needed).
 */
export async function getAuthUserFromRequest(): Promise<SafeUser | null> {
  try {
    // Dynamic import — only available inside TanStack Start request context
    const { getRequestHeaders } = await import('@tanstack/start-server-core')
    const rawHeaders = getRequestHeaders() as unknown as Record<string, string | undefined>

    // 1. Try Authorization header
    const authHeader = rawHeaders['authorization'] ?? rawHeaders['Authorization']
    if (authHeader && typeof authHeader === 'string') {
      const token = authHeader.replace(/^Bearer\s+/i, '').trim()
      if (token) return verifyJwt(token)
    }

    // 2. Try cookie fallback (works on non-Workers runtimes)
    const cookieHeader = rawHeaders['cookie']
    if (cookieHeader && typeof cookieHeader === 'string') {
      const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE}=([^;]*)`))
      if (match?.[1]) return verifyJwt(match[1])
    }
  } catch {
    // Outside request context or import failed
  }
  return null
}

export function getSessionCookieName() {
  return SESSION_COOKIE
}

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS)
}

export function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

export async function createUser(input: { email: string; password: string; name: string; role?: string }) {
  const email = input.email.toLowerCase().trim()
  if (!email || !email.includes('@')) throw new Error('Valid email required')
  if (!input.password || input.password.length < 8) throw new Error('Password must be at least 8 characters')
  if (!input.name || input.name.trim().length < 2) throw new Error('Name required')

  const [existing] = await db.select().from(users).where(eq(users.email, email))
  if (existing) throw new Error('Email already registered')

  const passwordHash = await hashPassword(input.password)
  const [user] = await db
    .insert(users)
    .values({
      email,
      passwordHash,
      name: input.name.trim(),
      role: input.role ?? 'admin',
    })
    .returning()
  return sanitizeUser(user)
}

export async function findUserByEmail(email: string) {
  const [user] = await db.select().from(users).where(eq(users.email, email.toLowerCase().trim()))
  return user ?? null
}

export async function findUserById(id: number) {
  const [user] = await db.select().from(users).where(eq(users.id, id))
  return user ? sanitizeUser(user) : null
}

export function sanitizeUser(user: typeof users.$inferSelect) {
  const { passwordHash: _ph, ...safe } = user
  return safe
}

export type SafeUser = ReturnType<typeof sanitizeUser>

export async function signJwt(user: SafeUser): Promise<string> {
  const token = await new SignJWT({
    sub: String(user.id),
    email: user.email,
    name: user.name,
    role: user.role,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_DAYS}d`)
    .sign(getJwtSecret())
  return token
}

export async function verifyJwt(token: string): Promise<SafeUser | null> {
  if (!token) return null
  try {
    const { payload } = await jwtVerify(token, getJwtSecret())
    if (!payload.sub) return null
    const userId = Number(payload.sub)
    if (isNaN(userId)) return null
    try {
      const user = await findUserById(userId)
      if (user) return user
    } catch {
      // DB unavailable on cold start — fall through to degraded JWT payload
    }
    // JWT is valid but DB lookup failed or returned nothing — degrade gracefully
    return {
      id: userId,
      email: String(payload.email ?? ''),
      name: String(payload.name ?? ''),
      role: String(payload.role ?? 'admin'),
      createdAt: new Date(),
      updatedAt: new Date(),
    }
  } catch {
    // JWT signature invalid or expired
    return null
  }
}

// Kept for backwards compat — now signs a JWT instead of creating a DB session
export async function createSession(userId: number): Promise<{ token: string; expiresAt: Date }> {
  const user = await findUserById(userId)
  if (!user) throw new Error('User not found')
  const token = await signJwt(user)
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_DAYS * 86400000)
  return { token, expiresAt }
}

// No-op — JWT can't be revoked server-side, cookie deletion handles it
export async function deleteSession(_token: string) {
  // JWT is self-contained; removing the cookie is sufficient
}

export async function deleteAllSessionsForUser(_userId: number) {
  // JWT is self-contained; no server-side session to delete
}

export async function cleanupExpiredSessions() {
  // No DB sessions to clean up — JWT expiry is checked at verification time
}

export async function validateSessionToken(token: string): Promise<SafeUser | null> {
  return verifyJwt(token)
}

export async function authenticateUser(email: string, password: string): Promise<SafeUser> {
  // Rate limit by email (cheap, no IP extraction needed on Workers)
  checkLoginRateLimit(email.toLowerCase().trim())

  const user = await findUserByEmail(email)
  if (!user) throw new Error('Invalid email or password')
  const valid = await verifyPassword(password, user.passwordHash)
  if (!valid) throw new Error('Invalid email or password')
  return sanitizeUser(user)
}

export async function getUserFromToken(token: string | undefined | null): Promise<SafeUser | null> {
  if (!token) return null
  return verifyJwt(token)
}
