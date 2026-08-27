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

// Status color is never used alone — every badge pairs a fixed hue with an icon
// and a text label, per the dataviz skill's status-palette rule.
const RISK_META: Record<string, { label: string; classes: string; icon: typeof CheckCircle2 }> = {
  critical: { label: 'Critical', classes: 'bg-red-50 text-red-700 ring-red-600/20', icon: AlertOctagon },
  warning: { label: 'Warning', classes: 'bg-orange-50 text-orange-700 ring-orange-600/20', icon: AlertTriangle },
  watch: { label: 'Watch', classes: 'bg-amber-50 text-amber-700 ring-amber-600/20', icon: Eye },
  healthy: { label: 'Healthy', classes: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20', icon: CheckCircle2 },
}

export function RiskBadge({ level }: { level: string }) {
  const meta = RISK_META[level] ?? { label: level, classes: 'bg-gray-50 text-gray-700 ring-gray-600/20', icon: Circle }
  const Icon = meta.icon
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ring-1 ring-inset ${meta.classes}`}>
      <Icon className="w-3 h-3" />
      {meta.label}
    </span>
  )
}

const SEVERITY_META: Record<string, { label: string; classes: string; icon: typeof CheckCircle2 }> = {
  high: { label: 'High', classes: 'bg-red-50 text-red-700 ring-red-600/20', icon: AlertOctagon },
  medium: { label: 'Medium', classes: 'bg-orange-50 text-orange-700 ring-orange-600/20', icon: AlertTriangle },
  low: { label: 'Low', classes: 'bg-amber-50 text-amber-700 ring-amber-600/20', icon: Eye },
}

export function SeverityBadge({ severity }: { severity: string }) {
  const meta = SEVERITY_META[severity] ?? { label: severity, classes: 'bg-gray-50 text-gray-700 ring-gray-600/20', icon: Circle }
  const Icon = meta.icon
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ring-1 ring-inset ${meta.classes}`}>
      <Icon className="w-3 h-3" />
      {meta.label}
    </span>
  )
}

const IMPACT_META: Record<string, string> = {
  high: 'bg-red-50 text-red-700 ring-red-600/20',
  medium: 'bg-orange-50 text-orange-700 ring-orange-600/20',
  low: 'bg-gray-50 text-gray-600 ring-gray-600/20',
}

export function ImpactBadge({ impact }: { impact: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ring-1 ring-inset capitalize ${IMPACT_META[impact] ?? IMPACT_META.low}`}>
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
  return <span className={`text-xs font-medium ${TREND_STYLES[trend] ?? 'text-gray-500'}`}>{TREND_LABEL[trend] ?? trend}</span>
}

const PO_STATUS_META: Record<string, { label: string; classes: string; icon: typeof CheckCircle2 }> = {
  draft: { label: 'Draft', classes: 'bg-gray-50 text-gray-600 ring-gray-600/20', icon: Circle },
  approved: { label: 'Approved', classes: 'bg-blue-50 text-blue-700 ring-blue-600/20', icon: Clock },
  received: { label: 'Received', classes: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20', icon: CheckCircle2 },
}

export function PoStatusBadge({ status }: { status: string }) {
  const meta = PO_STATUS_META[status] ?? { label: status, classes: 'bg-gray-50 text-gray-700 ring-gray-600/20', icon: Circle }
  const Icon = meta.icon
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ring-1 ring-inset ${meta.classes}`}>
      <Icon className="w-3 h-3" />
      {meta.label}
    </span>
  )
}

const ACTION_STATUS_META: Record<string, { label: string; classes: string; icon: typeof CheckCircle2 }> = {
  pending: { label: 'Pending', classes: 'bg-amber-50 text-amber-700 ring-amber-600/20', icon: Clock },
  approved: { label: 'Approved', classes: 'bg-blue-50 text-blue-700 ring-blue-600/20', icon: ShieldCheck },
  rejected: { label: 'Rejected', classes: 'bg-gray-50 text-gray-600 ring-gray-600/20', icon: ShieldX },
  executed: { label: 'Executed', classes: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20', icon: CheckCircle2 },
  failed: { label: 'Failed', classes: 'bg-red-50 text-red-700 ring-red-600/20', icon: XCircle },
}

export function ActionStatusBadge({ status }: { status: string }) {
  const meta = ACTION_STATUS_META[status] ?? { label: status, classes: 'bg-gray-50 text-gray-700 ring-gray-600/20', icon: Circle }
  const Icon = meta.icon
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ring-1 ring-inset capitalize ${meta.classes}`}>
      {status === 'approved' && <Loader2 className="w-3 h-3 animate-spin" />}
      {status !== 'approved' && <Icon className="w-3 h-3" />}
      {meta.label}
    </span>
  )
}
