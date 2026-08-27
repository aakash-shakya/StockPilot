const RISK_STYLES: Record<string, string> = {
  critical: 'bg-red-100 text-red-700',
  warning: 'bg-amber-100 text-amber-700',
  watch: 'bg-yellow-100 text-yellow-800',
  healthy: 'bg-emerald-100 text-emerald-700',
}

export function RiskBadge({ level }: { level: string }) {
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium capitalize ${RISK_STYLES[level] ?? 'bg-gray-100 text-gray-700'}`}>
      {level}
    </span>
  )
}

const TREND_STYLES: Record<string, string> = {
  accelerating: 'text-red-600',
  steady: 'text-gray-500',
  declining: 'text-emerald-600',
}

const TREND_LABEL: Record<string, string> = {
  accelerating: '↑ accelerating',
  steady: '→ steady',
  declining: '↓ declining',
}

export function TrendLabel({ trend }: { trend: string }) {
  return <span className={`text-xs font-medium ${TREND_STYLES[trend] ?? 'text-gray-500'}`}>{TREND_LABEL[trend] ?? trend}</span>
}

const PO_STATUS_STYLES: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  approved: 'bg-blue-100 text-blue-700',
  received: 'bg-emerald-100 text-emerald-700',
}

export function PoStatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium capitalize ${PO_STATUS_STYLES[status] ?? 'bg-gray-100 text-gray-700'}`}>
      {status}
    </span>
  )
}
