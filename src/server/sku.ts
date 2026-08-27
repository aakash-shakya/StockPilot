const CATEGORY_CODES: Record<string, string> = {
  electronics: 'ELEC',
  office: 'OFF',
  tools: 'TOOL',
  shipping: 'SHIP',
}

/** First 3-4 consonant-biased letters of a word, uppercased — stable and readable. */
function codeFromWord(word: string, length: number): string {
  const cleaned = word.replace(/[^a-zA-Z0-9]/g, '').toUpperCase()
  if (!cleaned) return 'GEN'.slice(0, length)
  return cleaned.slice(0, length).padEnd(Math.min(length, cleaned.length), cleaned.at(-1))
}

function categoryCode(category: string): string {
  const known = CATEGORY_CODES[category.trim().toLowerCase()]
  if (known) return known
  return codeFromWord(category, 4)
}

export interface SkuParts {
  category: string
  brand: string
  model: string
  variant?: string
}

/**
 * Deterministic CATEGORY-BRAND-MODEL[-VARIANT] SKU, e.g. ELEC-LOG-MXM4-BLK.
 * Pure formatting only — collision resolution against existing SKUs happens
 * in inventory.server.ts, which has database access.
 */
export function buildSkuBase(parts: SkuParts): string {
  const segments = [
    categoryCode(parts.category),
    codeFromWord(parts.brand, 3),
    codeFromWord(parts.model, 4),
  ]
  if (parts.variant) segments.push(codeFromWord(parts.variant, 3))
  return segments.join('-')
}

/** Appends a numeric disambiguator once a base SKU collides, e.g. ELEC-LOG-MXM4-2. */
export function withCollisionSuffix(base: string, attempt: number): string {
  return attempt <= 1 ? base : `${base}-${attempt}`
}
