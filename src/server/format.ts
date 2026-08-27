export function centsToDollars(cents: number): number {
  return Math.round(cents) / 100
}

export function formatMoney(cents: number): string {
  return centsToDollars(cents).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
  })
}

export function round1(n: number): number {
  return Math.round(n * 10) / 10
}

export type RiskLevel = 'critical' | 'warning' | 'watch' | 'healthy'

export function riskLevelFor(coverageDays: number | null): RiskLevel {
  if (coverageDays === null) return 'healthy'
  if (coverageDays <= 2) return 'critical'
  if (coverageDays <= 5) return 'warning'
  if (coverageDays <= 10) return 'watch'
  return 'healthy'
}
