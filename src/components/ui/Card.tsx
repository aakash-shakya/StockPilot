import { type ReactNode } from 'react'
import { cn } from '../../lib/cn.js'

interface CardProps {
  children: ReactNode
  className?: string
  hover?: boolean
}

export function Card({ children, className, hover }: CardProps) {
  return (
    <div
      className={cn(
        'rounded-xl border bg-white transition-all duration-200',
        'border-[var(--color-border)] shadow-[var(--shadow-card)]',
        hover && 'hover:border-[var(--color-border-strong)] hover:shadow-[var(--shadow-card-hover)] cursor-pointer',
        className,
      )}
    >
      {children}
    </div>
  )
}

export function CardHeader({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('px-5 py-4 border-b border-[var(--color-border)]', className)}>
      {children}
    </div>
  )
}

export function CardContent({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('p-5', className)}>{children}</div>
}

export function CardTitle({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <h3
      className={cn('text-sm font-semibold', className)}
      style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-ink)' }}
    >
      {children}
    </h3>
  )
}

export function CardDescription({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p className={cn('text-xs mt-0.5', className)} style={{ color: 'var(--color-ink-muted)' }}>
      {children}
    </p>
  )
}
