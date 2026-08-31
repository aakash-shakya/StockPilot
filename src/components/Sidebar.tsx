import { useEffect, useRef, useState } from 'react'
import { Link, useRouter } from '@tanstack/react-router'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ClipboardList,
  FileBarChart,
  HeartPulse,
  LayoutDashboard,
  PackageSearch,
  PlusCircle,
  ShieldCheck,
  Sliders,
  Terminal,
  Truck,
  Bot,
  LogOut,
  ChevronDown,
  ShoppingCart,
  BarChart3,
} from 'lucide-react'
import { cn } from '../lib/cn.js'

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/pos', label: 'Point of Sale', icon: ShoppingCart },
  { to: '/sales', label: 'Sales History', icon: BarChart3 },
  { to: '/products', label: 'Products', icon: PackageSearch },
  { to: '/products/new', label: 'New Product', icon: PlusCircle },
  { to: '/purchase-orders', label: 'Purchase Orders', icon: ClipboardList },
  { to: '/agent-actions', label: 'Actions', icon: ShieldCheck },
  { to: '/suppliers', label: 'Suppliers', icon: Truck },
  { to: '/health', label: 'Health', icon: HeartPulse },
  { to: '/reports', label: 'Reports', icon: FileBarChart },
  { to: '/simulator', label: 'Simulator', icon: Sliders },
  { to: '/agent-tools', label: 'Tools', icon: Terminal },
] as const

interface SidebarProps {
  user?: { id: number; name: string; email: string; role: string } | null
  isAgentPanelOpen: boolean
  onToggleAgentPanel: () => void
}

export function Sidebar({ user, isAgentPanelOpen, onToggleAgentPanel }: SidebarProps) {
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const router = useRouter()
  const userMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!userMenuOpen) return
    function onClickOutside(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false)
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setUserMenuOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onClickOutside)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [userMenuOpen])

  async function handleLogout() {
    localStorage.removeItem('stockpilot_token')
    localStorage.removeItem('stockpilot_user')
    router.navigate({ to: '/login' })
  }

  return (
    <aside
      className="w-56 flex flex-col flex-shrink-0 h-screen sticky top-0 border-r"
      style={{
        backgroundColor: 'var(--color-sidebar)',
        borderColor: 'var(--color-sidebar-border)',
      }}
    >
      {/* Logo */}
      <div className="px-4 py-4 border-b" style={{ borderColor: 'var(--color-sidebar-border)' }}>
        <Link to="/" className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-white/10">
            <PackageSearch className="w-4.5 h-4.5 text-white" />
          </div>
          <div>
            <h1 className="text-sm font-semibold text-white leading-tight" style={{ fontFamily: 'var(--font-heading)' }}>
              StockPilot
            </h1>
            <p className="text-[11px] text-slate-400 leading-tight">inventory management</p>
          </div>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto scrollbar-none">
        {navItems.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className={cn(
              'flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors',
              'hover:bg-white/5',
              '[&.active]:bg-white/10',
            )}
            style={{ color: 'var(--color-sidebar-text)' }}
            activeProps={{
              className: 'active',
              style: { color: '#ffffff', backgroundColor: 'rgba(255,255,255,0.1)' },
            }}
          >
            <item.icon className="w-4 h-4 shrink-0" />
            {item.label}
          </Link>
        ))}
      </nav>

      {/* Bottom actions */}
      <div className="px-3 py-3 border-t space-y-1" style={{ borderColor: 'var(--color-sidebar-border)' }}>
        {/* Agent Panel Toggle */}
        <button
          onClick={onToggleAgentPanel}
          className={cn(
            'flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-[13px] font-medium transition-colors',
            isAgentPanelOpen
              ? 'bg-cyan-500/20 text-cyan-300'
              : 'text-slate-400 hover:bg-white/5 hover:text-slate-200',
          )}
        >
          <Bot className="w-4 h-4 shrink-0" />
          <span className="flex-1 text-left">Agent</span>
          <kbd className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-slate-500">
            {navigator.platform?.includes('Mac') ? '\u2318' : 'Ctrl'}+/
          </kbd>
        </button>

        {/* User Menu */}
        {user && (
          <div ref={userMenuRef} className="relative">
            <button
              onClick={() => setUserMenuOpen((v) => !v)}
              className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-[13px] font-medium text-slate-300 hover:bg-white/5 transition-colors"
            >
              <div className="w-6 h-6 rounded-full bg-cyan-500 text-white flex items-center justify-center text-[11px] font-semibold shrink-0">
                {user.name.slice(0, 1).toUpperCase()}
              </div>
              <span className="flex-1 text-left truncate">{user.name}</span>
              <ChevronDown className={cn('w-3.5 h-3.5 text-slate-500 transition-transform', userMenuOpen && 'rotate-180')} />
            </button>
            <AnimatePresence>
              {userMenuOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 4 }}
                  transition={{ duration: 0.15 }}
                  className="absolute bottom-full left-0 right-0 mb-1 rounded-xl shadow-xl p-1.5 z-50 border"
                  style={{
                    backgroundColor: 'var(--color-sidebar)',
                    borderColor: 'var(--color-sidebar-border)',
                  }}
                >
                  <div className="px-3 py-2 border-b mb-1" style={{ borderColor: 'var(--color-sidebar-border)' }}>
                    <p className="text-sm font-semibold text-white truncate" style={{ fontFamily: 'var(--font-heading)' }}>
                      {user.name}
                    </p>
                    <p className="text-[11px] text-slate-400 truncate">{user.email}</p>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2 text-left text-[13px] px-3 py-2 rounded-lg text-slate-400 hover:bg-white/5 hover:text-white transition-colors"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    Sign out
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>
    </aside>
  )
}
