import {
  AlertOctagon,
  AlertTriangle,
  CheckCircle2,
  Circle,
  Clock,
  Eye,
  Loader2,
  ShieldCheck,
  ShieldX,
  XCircle,
} from 'lucide-react'

const badgeBase = 'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium'

const RISK_META: Record<string, { label: string; classes: string; style: React.CSSProperties; icon: typeof CheckCircle2 }> = {
  critical: { label: 'Critical', classes: `${badgeBase} ring-1 ring-inset ring-red-600/20`, style: { backgroundColor: 'var(--color-danger-bg)', color: 'var(--color-danger)', fontFamily: 'var(--font-body)' }, icon: AlertOctagon },
  warning: { label: 'Warning', classes: `${badgeBase} ring-1 ring-inset ring-orange-600/20`, style: { backgroundColor: 'var(--color-warning-bg)', color: 'var(--color-warning)', fontFamily: 'var(--font-body)' }, icon: AlertTriangle },
  watch: { label: 'Watch', classes: `${badgeBase} ring-1 ring-inset ring-amber-600/20`, style: { backgroundColor: 'var(--color-warning-bg)', color: 'var(--color-warning)', fontFamily: 'var(--font-body)' }, icon: Eye },
  healthy: { label: 'Healthy', classes: `${badgeBase} ring-1 ring-inset ring-emerald-600/20`, style: { backgroundColor: 'var(--color-success-bg)', color: 'var(--color-success)', fontFamily: 'var(--font-body)' }, icon: CheckCircle2 },
}

export function RiskBadge({ level }: { level: string }) {
  const meta = RISK_META[level] ?? { label: level, classes: `${badgeBase} ring-1 ring-inset ring-gray-600/20`, style: { backgroundColor: 'var(--color-surface)', color: 'var(--color-ink-secondary)', fontFamily: 'var(--font-body)' } as React.CSSProperties, icon: Circle }
  const Icon = meta.icon
  return (
    <span style={meta.style} className={meta.classes}>
      <Icon className="w-3 h-3" />
      {meta.label}
    </span>
  )
}

const SEVERITY_META: Record<string, { label: string; classes: string; style: React.CSSProperties; icon: typeof CheckCircle2 }> = {
  high: { label: 'High', classes: `${badgeBase} ring-1 ring-inset ring-red-600/20`, style: { backgroundColor: 'var(--color-danger-bg)', color: 'var(--color-danger)', fontFamily: 'var(--font-body)' }, icon: AlertOctagon },
  medium: { label: 'Medium', classes: `${badgeBase} ring-1 ring-inset ring-orange-600/20`, style: { backgroundColor: 'var(--color-warning-bg)', color: 'var(--color-warning)', fontFamily: 'var(--font-body)' }, icon: AlertTriangle },
  low: { label: 'Low', classes: `${badgeBase} ring-1 ring-inset ring-amber-600/20`, style: { backgroundColor: 'var(--color-warning-bg)', color: 'var(--color-warning)', fontFamily: 'var(--font-body)' }, icon: Eye },
}

export function SeverityBadge({ severity }: { severity: string }) {
  const meta = SEVERITY_META[severity] ?? { label: severity, classes: `${badgeBase} ring-1 ring-inset ring-gray-600/20`, style: { backgroundColor: 'var(--color-surface)', color: 'var(--color-ink-secondary)', fontFamily: 'var(--font-body)' } as React.CSSProperties, icon: Circle }
  const Icon = meta.icon
  return (
    <span style={meta.style} className={meta.classes}>
      <Icon className="w-3 h-3" />
      {meta.label}
    </span>
  )
}

const IMPACT_META: Record<string, { classes: string; style: React.CSSProperties }> = {
  high: { classes: `${badgeBase} ring-1 ring-inset ring-red-600/20`, style: { backgroundColor: 'var(--color-danger-bg)', color: 'var(--color-danger)', fontFamily: 'var(--font-body)' } },
  medium: { classes: `${badgeBase} ring-1 ring-inset ring-orange-600/20`, style: { backgroundColor: 'var(--color-warning-bg)', color: 'var(--color-warning)', fontFamily: 'var(--font-body)' } },
  low: { classes: `${badgeBase} ring-1 ring-inset ring-gray-600/20`, style: { backgroundColor: 'var(--color-surface-sunken)', color: 'var(--color-ink-secondary)', fontFamily: 'var(--font-body)' } },
}

export function ImpactBadge({ impact }: { impact: string }) {
  const meta = IMPACT_META[impact] ?? IMPACT_META.low
  return (
    <span style={meta.style} className={`${meta.classes} capitalize`}>
      {impact} impact
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
  return <span style={{ fontFamily: 'var(--font-body)' }} className={`text-xs font-medium ${TREND_STYLES[trend] ?? 'text-gray-500'}`}>{TREND_LABEL[trend] ?? trend}</span>
}

const PO_STATUS_META: Record<string, { label: string; classes: string; style: React.CSSProperties; icon: typeof CheckCircle2 }> = {
  draft: { label: 'Draft', classes: `${badgeBase} ring-1 ring-inset ring-gray-500/20`, style: { backgroundColor: 'var(--color-surface-sunken)', color: 'var(--color-ink-secondary)', fontFamily: 'var(--font-body)' }, icon: Circle },
  approved: { label: 'Approved', classes: `${badgeBase} ring-1 ring-inset ring-blue-600/20`, style: { backgroundColor: 'var(--color-info-bg)', color: 'var(--color-info)', fontFamily: 'var(--font-body)' }, icon: Clock },
  received: { label: 'Received', classes: `${badgeBase} ring-1 ring-inset ring-emerald-600/20`, style: { backgroundColor: 'var(--color-success-bg)', color: 'var(--color-success)', fontFamily: 'var(--font-body)' }, icon: CheckCircle2 },
}

export function PoStatusBadge({ status }: { status: string }) {
  const meta = PO_STATUS_META[status] ?? { label: status, classes: `${badgeBase} ring-1 ring-inset ring-gray-600/20`, style: { backgroundColor: 'var(--color-surface)', color: 'var(--color-ink-secondary)', fontFamily: 'var(--font-body)' } as React.CSSProperties, icon: Circle }
  const Icon = meta.icon
  return (
    <span style={meta.style} className={meta.classes}>
      <Icon className="w-3 h-3" />
      {meta.label}
    </span>
  )
}

const ACTION_STATUS_META: Record<string, { label: string; classes: string; style: React.CSSProperties; icon: typeof CheckCircle2 }> = {
  pending: { label: 'Pending', classes: `${badgeBase} ring-1 ring-inset ring-amber-600/20`, style: { backgroundColor: 'var(--color-warning-bg)', color: 'var(--color-warning)', fontFamily: 'var(--font-body)' }, icon: Clock },
  approved: { label: 'Approved', classes: `${badgeBase} ring-1 ring-inset ring-blue-600/20`, style: { backgroundColor: 'var(--color-info-bg)', color: 'var(--color-info)', fontFamily: 'var(--font-body)' }, icon: ShieldCheck },
  rejected: { label: 'Rejected', classes: `${badgeBase} ring-1 ring-inset ring-gray-500/20`, style: { backgroundColor: 'var(--color-surface-sunken)', color: 'var(--color-ink-secondary)', fontFamily: 'var(--font-body)' }, icon: ShieldX },
  executed: { label: 'Executed', classes: `${badgeBase} ring-1 ring-inset ring-emerald-600/20`, style: { backgroundColor: 'var(--color-success-bg)', color: 'var(--color-success)', fontFamily: 'var(--font-body)' }, icon: CheckCircle2 },
  failed: { label: 'Failed', classes: `${badgeBase} ring-1 ring-inset ring-red-600/20`, style: { backgroundColor: 'var(--color-danger-bg)', color: 'var(--color-danger)', fontFamily: 'var(--font-body)' }, icon: XCircle },
}

export function ActionStatusBadge({ status }: { status: string }) {
  const meta = ACTION_STATUS_META[status] ?? { label: status, classes: `${badgeBase} ring-1 ring-inset ring-gray-600/20`, style: { backgroundColor: 'var(--color-surface)', color: 'var(--color-ink-secondary)', fontFamily: 'var(--font-body)' } as React.CSSProperties, icon: Circle }
  const Icon = meta.icon
  return (
    <span style={meta.style} className={`${meta.classes} capitalize`}>
      {status === 'approved' && <Loader2 className="w-3 h-3 animate-spin" />}
      {status !== 'approved' && <Icon className="w-3 h-3" />}
      {meta.label}
    </span>
  )
}
