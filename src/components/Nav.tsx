import { useEffect, useRef, useState } from 'react'
import { Link, useRouter } from '@tanstack/react-router'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ClipboardList,
  FileBarChart,
  HeartPulse,
  LayoutDashboard,
  Menu,
  PackageSearch,
  PlusCircle,
  ShieldCheck,
  Sliders,
  Terminal,
  Truck,
  X,
} from 'lucide-react'
import { cn } from '../lib/cn.js'

const links = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/products', label: 'Products', icon: PackageSearch },
  { to: '/purchase-orders', label: 'Orders', icon: ClipboardList },
  { to: '/agent-actions', label: 'Actions', icon: ShieldCheck },
  { to: '/suppliers', label: 'Suppliers', icon: Truck },
  { to: '/health', label: 'Health', icon: HeartPulse },
  { to: '/reports', label: 'Reports', icon: FileBarChart },
  { to: '/simulator', label: 'Simulator', icon: Sliders },
] as const

export function Nav({ user }: { user?: { id: number; name: string; email: string; role: string } | null }) {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <>
      <nav
        className="sticky top-0 z-40 border-b"
        style={{
          backgroundColor: 'rgba(255, 255, 255, 0.85)',
          backdropFilter: 'blur(12px) saturate(180%)',
          borderColor: 'var(--color-border)',
        }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center gap-1 h-14">
          <Link to="/" className="flex items-center gap-2.5 shrink-0 mr-3">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: 'var(--color-ink)' }}
            >
              <PackageSearch className="w-4 h-4 text-white" />
            </div>
            <span
              className="font-semibold tracking-tight text-sm hidden sm:block"
              style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-ink)' }}
            >
              StockPilot
            </span>
          </Link>

          {/* Desktop nav */}
          <div className="flex-1 min-w-0 items-center gap-0.5 hidden md:flex">
            {links.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className={cn(
                  'flex items-center gap-1.5 text-[13px] font-medium px-2.5 py-1.5 rounded-md whitespace-nowrap shrink-0 transition-colors',
                  'hover:bg-[var(--color-surface-sunken)]',
                  '[&.active]:bg-[var(--color-surface-sunken)]',
                )}
                style={{
                  fontFamily: 'var(--font-body)',
                  color: 'var(--color-ink-muted)',
                }}
                activeProps={{ className: 'active', style: { color: 'var(--color-ink)' } }}
              >
                <link.icon className="w-3.5 h-3.5" />
                {link.label}
              </Link>
            ))}
          </div>

          <div className="flex items-center gap-2 ml-auto md:ml-3 shrink-0">
            <Link
              to="/products/new"
              className="hidden sm:flex items-center gap-1.5 text-[13px] font-medium text-white px-3 py-1.5 rounded-lg whitespace-nowrap shadow-sm transition-colors"
              style={{
                fontFamily: 'var(--font-body)',
                backgroundColor: 'var(--color-ink)',
              }}
            >
              <PlusCircle className="w-3.5 h-3.5" />
              New Product
            </Link>
            <Link
              to="/agent-tools"
              className="flex items-center justify-center w-8 h-8 rounded-lg whitespace-nowrap transition-colors"
              style={{ color: 'var(--color-ink-muted)' }}
              activeProps={{ className: 'active', style: { color: 'var(--color-ink-secondary)', backgroundColor: 'var(--color-surface-sunken)' } }}
              title="Agent Tools (developer)"
            >
              <Terminal className="w-4 h-4" />
            </Link>
            {user ? (
              <UserMenu user={user} />
            ) : (
              <Link
                to="/login"
                className="text-sm font-medium px-2 transition-colors"
                style={{ fontFamily: 'var(--font-body)', color: 'var(--color-ink-secondary)' }}
              >
                Sign in
              </Link>
            )}

            {/* Mobile hamburger */}
            <button
              onClick={() => setMobileOpen(true)}
              className="md:hidden flex items-center justify-center w-8 h-8 rounded-lg transition-colors"
              style={{ color: 'var(--color-ink-muted)' }}
              aria-label="Open menu"
            >
              <Menu className="w-5 h-5" />
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 backdrop-blur-sm z-50 md:hidden"
              style={{ backgroundColor: 'rgba(0, 0, 0, 0.2)' }}
              onClick={() => setMobileOpen(false)}
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed top-0 right-0 bottom-0 w-72 border-l shadow-xl z-50 md:hidden overflow-y-auto"
              style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
            >
              <div
                className="flex items-center justify-between px-4 py-3 border-b"
                style={{ borderColor: 'var(--color-border)' }}
              >
                <span
                  className="text-sm font-semibold"
                  style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-ink)' }}
                >
                  Navigation
                </span>
                <button
                  onClick={() => setMobileOpen(false)}
                  className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors"
                  style={{ color: 'var(--color-ink-muted)' }}
                  aria-label="Close menu"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="p-2">
                {links.map((link) => (
                  <Link
                    key={link.to}
                    to={link.to}
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      'flex items-center gap-3 text-sm font-medium px-3 py-2.5 rounded-lg transition-colors',
                      'hover:bg-[var(--color-surface-sunken)]',
                      '[&.active]:bg-[var(--color-surface-sunken)]',
                    )}
                    style={{ fontFamily: 'var(--font-body)', color: 'var(--color-ink-secondary)' }}
                    activeProps={{ className: 'active', style: { color: 'var(--color-ink)' } }}
                  >
                    <link.icon className="w-4 h-4" />
                    {link.label}
                  </Link>
                ))}
              </div>
              <div className="p-2 border-t" style={{ borderColor: 'var(--color-border)' }}>
                <Link
                  to="/products/new"
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-3 text-sm font-medium text-white px-3 py-2.5 rounded-lg transition-colors"
                  style={{ fontFamily: 'var(--font-body)', backgroundColor: 'var(--color-ink)' }}
                >
                  <PlusCircle className="w-4 h-4" />
                  New Product
                </Link>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}

function UserMenu({ user }: { user: { name: string; email: string } }) {
  const [open, setOpen] = useState(false)
  const router = useRouter()
  const containerRef = useRef<HTMLDivElement>(null)
  async function handleLogout() {
    const { logoutFn } = await import('../server/auth.functions.js')
    await logoutFn()
    await router.invalidate()
    router.navigate({ to: '/login' })
  }

  useEffect(() => {
    if (!open) return
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onClickOutside)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex items-center gap-2 px-2 py-1 rounded-full transition-colors"
        style={{ border: '1px solid transparent' }}
      >
        <div
          className="w-7 h-7 rounded-full text-white flex items-center justify-center text-xs font-medium"
          style={{ backgroundColor: 'var(--color-accent)' }}
        >
          {user.name.slice(0, 1).toUpperCase()}
        </div>
        <span
          className="text-sm font-medium hidden sm:block max-w-[120px] truncate"
          style={{ fontFamily: 'var(--font-body)', color: 'var(--color-ink-secondary)' }}
        >
          {user.name}
        </span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -4 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="absolute right-0 top-full mt-2 w-60 rounded-xl shadow-xl p-2 z-50 origin-top-right border"
            style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
          >
            <div className="px-3 py-2 border-b mb-1" style={{ borderColor: 'var(--color-border)' }}>
              <p
                className="text-sm font-semibold truncate"
                style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-ink)' }}
              >
                {user.name}
              </p>
              <p className="text-xs truncate" style={{ color: 'var(--color-ink-muted)' }}>
                {user.email}
              </p>
            </div>
            <button
              onClick={handleLogout}
              className="w-full text-left text-sm px-3 py-2 rounded-lg transition-colors"
              style={{ fontFamily: 'var(--font-body)', color: 'var(--color-ink-secondary)' }}
            >
              Sign out
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
