import { type ReactNode } from 'react'
import { cn } from '../../lib/cn.js'

const variants = {
  default: 'bg-slate-100 text-slate-600 border-slate-200/60',
  blue: 'bg-sky-50 text-sky-700 border-sky-200/60',
  red: 'bg-red-50 text-red-700 border-red-200/60',
  amber: 'bg-amber-50 text-amber-700 border-amber-200/60',
  emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200/60',
  violet: 'bg-violet-50 text-violet-700 border-violet-200/60',
  cyan: 'bg-cyan-50 text-cyan-700 border-cyan-200/60',
}

interface BadgeProps {
  variant?: keyof typeof variants
  children: ReactNode
  className?: string
  dot?: boolean
}

export function Badge({ variant = 'default', children, className, dot }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 text-[11px] font-semibold px-2 py-0.5 rounded-full border',
        variants[variant],
        className,
      )}
      style={{ fontFamily: 'var(--font-body)' }}
    >
      {dot && (
        <span
          className={cn(
            'w-1.5 h-1.5 rounded-full',
            variant === 'red' && 'bg-red-500',
            variant === 'amber' && 'bg-amber-500',
            variant === 'emerald' && 'bg-emerald-500',
            variant === 'blue' && 'bg-sky-500',
            variant === 'violet' && 'bg-violet-500',
            variant === 'cyan' && 'bg-cyan-500',
            variant === 'default' && 'bg-slate-400',
          )}
        />
      )}
      {children}
    </span>
  )
}
