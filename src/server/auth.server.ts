import { eq } from 'drizzle-orm'
import bcrypt from 'bcryptjs'
import { SignJWT, jwtVerify } from 'jose'
import { db } from '../../db/index.js'
import { users } from '../../db/schema.js'

const SESSION_COOKIE = 'stockpilot_session'
const SESSION_MAX_AGE_DAYS = 7
const BCRYPT_ROUNDS = 12

function getJwtSecret() {
  const secret = process.env.JWT_SECRET
  if (secret) return new TextEncoder().encode(secret)
  // Fallback for dev — NOT secure for production
  console.warn('[auth] No JWT_SECRET set, using fallback secret. Set JWT_SECRET in Netlify env vars for production.')
  return new TextEncoder().encode('stockpilot-dev-fallback-secret-not-for-production')
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
    const user = await findUserById(userId)
    return user
  } catch {
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
