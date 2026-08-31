import { drizzle } from 'drizzle-orm/d1'
import { env } from 'cloudflare:workers'
import * as schema from './schema.js'

type DrizzleDB = ReturnType<typeof drizzle<typeof schema>>

let _db: DrizzleDB | null = null

export function getDb(): DrizzleDB {
  if (!_db) _db = drizzle(env.DB, { schema })
  return _db
}

// Backwards compat — proxy delegates to the lazy D1 singleton.
// Existing `import { db } from '../../db/index.js'` calls keep working.
export const db: DrizzleDB = new Proxy({} as DrizzleDB, {
  get(_, prop) {
    return (getDb() as any)[prop]
  },
})
