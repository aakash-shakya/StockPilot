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
      <nav className="bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center gap-1 h-14">
          <Link to="/" className="flex items-center gap-2 shrink-0 mr-3">
            <div className="w-7 h-7 bg-slate-900 rounded-lg flex items-center justify-center">
              <PackageSearch className="w-4 h-4 text-white" />
            </div>
            <span className="font-semibold text-slate-900 tracking-tight text-sm hidden sm:block">StockPilot</span>
          </Link>

          {/* Desktop nav */}
          <div className="flex-1 min-w-0 items-center gap-0.5 hidden md:flex">
            {links.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className={cn(
                  'flex items-center gap-1.5 text-[13px] font-medium text-slate-500 px-2.5 py-1.5 rounded-md whitespace-nowrap shrink-0 transition-colors',
                  'hover:text-slate-900 hover:bg-slate-100/60',
                  '[&.active]:text-slate-900 [&.active]:bg-slate-100',
                )}
                activeProps={{ className: 'active' }}
              >
                <link.icon className="w-3.5 h-3.5" />
                {link.label}
              </Link>
            ))}
          </div>

          <div className="flex items-center gap-2 ml-auto md:ml-3 shrink-0">
            <Link
              to="/products/new"
              className="hidden sm:flex items-center gap-1.5 text-[13px] font-medium text-white bg-slate-900 px-3 py-1.5 rounded-lg whitespace-nowrap hover:bg-slate-800 shadow-sm transition-colors"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              New Product
            </Link>
            <Link
              to="/agent-tools"
              className="flex items-center justify-center w-8 h-8 text-slate-400 rounded-lg whitespace-nowrap hover:bg-slate-100 hover:text-slate-600 [&.active]:text-slate-600 [&.active]:bg-slate-100 transition-colors"
              activeProps={{ className: 'active' }}
              title="Agent Tools (developer)"
            >
              <Terminal className="w-4 h-4" />
            </Link>
            {user ? (
              <UserMenu user={user} />
            ) : (
              <Link to="/login" className="text-sm font-medium text-slate-600 hover:text-slate-900 px-2">
                Sign in
              </Link>
            )}

            {/* Mobile hamburger */}
            <button
              onClick={() => setMobileOpen(true)}
              className="md:hidden flex items-center justify-center w-8 h-8 text-slate-500 rounded-lg hover:bg-slate-100 transition-colors"
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
              className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50 md:hidden"
              onClick={() => setMobileOpen(false)}
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed top-0 right-0 bottom-0 w-72 bg-white border-l border-slate-200 shadow-xl z-50 md:hidden overflow-y-auto"
            >
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
                <span className="text-sm font-semibold text-slate-900">Navigation</span>
                <button
                  onClick={() => setMobileOpen(false)}
                  className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 transition-colors"
                  aria-label="Close menu"
                >
                  <X className="w-4 h-4 text-slate-500" />
                </button>
              </div>
              <div className="p-2">
                {links.map((link) => (
                  <Link
                    key={link.to}
                    to={link.to}
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      'flex items-center gap-3 text-sm font-medium text-slate-600 px-3 py-2.5 rounded-lg transition-colors',
                      'hover:text-slate-900 hover:bg-slate-50',
                      '[&.active]:text-slate-900 [&.active]:bg-slate-100',
                    )}
                    activeProps={{ className: 'active' }}
                  >
                    <link.icon className="w-4 h-4" />
                    {link.label}
                  </Link>
                ))}
              </div>
              <div className="p-2 border-t border-slate-100">
                <Link
                  to="/products/new"
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-3 text-sm font-medium text-white bg-slate-900 px-3 py-2.5 rounded-lg hover:bg-slate-800 transition-colors"
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
        className="flex items-center gap-2 px-2 py-1 rounded-full hover:bg-slate-100 border border-transparent hover:border-slate-200 transition-colors"
      >
        <div className="w-7 h-7 rounded-full bg-slate-900 text-white flex items-center justify-center text-xs font-medium ring-1 ring-slate-900/10">
          {user.name.slice(0, 1).toUpperCase()}
        </div>
        <span className="text-sm font-medium text-slate-700 hidden sm:block max-w-[120px] truncate">{user.name}</span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -4 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="absolute right-0 top-full mt-2 w-60 bg-white border border-slate-200 rounded-xl shadow-xl p-2 z-50 origin-top-right"
          >
            <div className="px-3 py-2 border-b border-slate-100 mb-1">
              <p className="text-sm font-semibold text-slate-900 truncate">{user.name}</p>
              <p className="text-xs text-slate-500 truncate">{user.email}</p>
            </div>
            <button
              onClick={handleLogout}
              className="w-full text-left text-sm text-slate-700 hover:bg-slate-50 hover:text-slate-900 px-3 py-2 rounded-lg transition-colors"
            >
              Sign out
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
