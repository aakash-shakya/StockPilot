import { eq, lt } from 'drizzle-orm'
import bcrypt from 'bcryptjs'
import { randomBytes } from 'node:crypto'
import { db } from '../../db/index.js'
import { sessions, users } from '../../db/schema.js'

const SESSION_COOKIE = 'stockpilot_session'
const SESSION_MAX_AGE_DAYS = 7
const BCRYPT_ROUNDS = 12

export function getSessionCookieName() {
  return SESSION_COOKIE
}

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS)
}

export function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

export function generateToken(): string {
  return randomBytes(32).toString('hex')
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

export async function createSession(userId: number): Promise<{ token: string; expiresAt: Date }> {
  const token = generateToken()
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_DAYS * 86400000)
  await db.insert(sessions).values({ userId, token, expiresAt })
  return { token, expiresAt }
}

export async function validateSessionToken(token: string): Promise<SafeUser | null> {
  if (!token) return null
  try {
    const [session] = await db.select().from(sessions).where(eq(sessions.token, token))
    if (!session) return null

    const expiresAt = session.expiresAt instanceof Date ? session.expiresAt : new Date(session.expiresAt)
    if (expiresAt < new Date()) {
      await db.delete(sessions).where(eq(sessions.token, token))
      return null
    }
    // extend if within 3 days of expiry
    const threeDays = 3 * 86400000
    if (expiresAt.getTime() - Date.now() < threeDays) {
      const newExpires = new Date(Date.now() + SESSION_MAX_AGE_DAYS * 86400000)
      await db.update(sessions).set({ expiresAt: newExpires }).where(eq(sessions.token, token))
    }
    const user = await findUserById(session.userId)
    return user
  } catch (err) {
    console.error('[auth] validateSessionToken failed:', err)
    return null
  }
}

export async function deleteSession(token: string) {
  await db.delete(sessions).where(eq(sessions.token, token))
}

export async function deleteAllSessionsForUser(userId: number) {
  await db.delete(sessions).where(eq(sessions.userId, userId))
}

export async function cleanupExpiredSessions() {
  await db.delete(sessions).where(lt(sessions.expiresAt, new Date()))
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
  return validateSessionToken(token)
}
