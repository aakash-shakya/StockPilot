import { type ReactNode } from 'react'
import { cn } from '../../lib/cn.js'

const variants = {
  default: 'bg-slate-100 text-slate-700 border-slate-200',
  blue: 'bg-blue-50 text-blue-700 border-blue-200',
  red: 'bg-red-50 text-red-700 border-red-200',
  amber: 'bg-amber-50 text-amber-700 border-amber-200',
  emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  violet: 'bg-violet-50 text-violet-700 border-violet-200',
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
    >
      {dot && (
        <span
          className={cn(
            'w-1.5 h-1.5 rounded-full',
            variant === 'red' && 'bg-red-500',
            variant === 'amber' && 'bg-amber-500',
            variant === 'emerald' && 'bg-emerald-500',
            variant === 'blue' && 'bg-blue-500',
            variant === 'violet' && 'bg-violet-500',
            variant === 'default' && 'bg-slate-500',
          )}
        />
      )}
      {children}
    </span>
  )
}
