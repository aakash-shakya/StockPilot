import { type ButtonHTMLAttributes, type ReactNode, forwardRef } from 'react'
import { cn } from '../../lib/cn.js'

const variants = {
  primary: 'bg-[var(--color-ink)] text-white hover:bg-[#1f2937] shadow-sm ring-1 ring-black/10',
  secondary: 'bg-white text-[var(--color-ink-secondary)] border border-[var(--color-border)] hover:bg-[var(--color-surface-sunken)] hover:border-[var(--color-border-strong)] shadow-sm',
  ghost: 'text-[var(--color-ink-secondary)] hover:bg-[var(--color-surface-sunken)] hover:text-[var(--color-ink)]',
  danger: 'bg-red-600 text-white hover:bg-red-700 shadow-sm ring-1 ring-red-600/20',
  success: 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm ring-1 ring-emerald-600/20',
  accent: 'bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)] shadow-sm ring-1 ring-cyan-600/20',
}

const sizes = {
  xs: 'px-2 py-1 text-xs rounded-md gap-1',
  sm: 'px-3 py-1.5 text-xs rounded-lg gap-1.5',
  md: 'px-4 py-2 text-sm rounded-lg gap-1.5',
  lg: 'px-5 py-2.5 text-sm rounded-xl gap-2',
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof variants
  size?: keyof typeof sizes
  icon?: ReactNode
  children: ReactNode
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', icon, children, className, disabled, ...props }, ref) => (
    <button
      ref={ref}
      disabled={disabled}
      className={cn(
        'inline-flex items-center justify-center font-medium transition-all duration-150',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2',
        'disabled:opacity-50 disabled:pointer-events-none',
        'active:scale-[0.98]',
        variants[variant],
        sizes[size],
        className,
      )}
      style={{ fontFamily: 'var(--font-body)' }}
      {...props}
    >
      {icon}
      {children}
    </button>
  ),
)
Button.displayName = 'Button'
