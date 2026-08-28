import { useState } from 'react'
import { Link, useRouter } from '@tanstack/react-router'
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
} from 'lucide-react'

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
  return (
    <nav className="bg-white/80 backdrop-blur-md border-b border-gray-200/60 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center gap-1 h-14 overflow-x-auto">
        <Link to="/" className="flex items-center gap-2 shrink-0 mr-4">
          <div className="w-7 h-7 bg-gray-900 rounded-lg flex items-center justify-center">
            <PackageSearch className="w-4 h-4 text-white" />
          </div>
          <span className="font-semibold text-gray-900 tracking-tight text-sm">StockPilot</span>
        </Link>

        <div className="flex items-center gap-0.5 shrink-0">
          {links.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className="flex items-center gap-1.5 text-[13px] font-medium text-gray-500 px-2.5 py-1.5 rounded-md whitespace-nowrap hover:text-gray-900 hover:bg-gray-100/60 [&.active]:text-gray-900 [&.active]:bg-gray-100"
              activeProps={{ className: 'active' }}
            >
              <link.icon className="w-3.5 h-3.5" />
              {link.label}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-2 ml-auto shrink-0">
          <Link
            to="/products/new"
            className="flex items-center gap-1.5 text-[13px] font-medium text-white bg-gray-900 px-3 py-1.5 rounded-lg whitespace-nowrap hover:bg-gray-800 shadow-sm"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            New Product
          </Link>
          <Link
            to="/agent-tools"
            className="flex items-center justify-center w-8 h-8 text-gray-400 rounded-lg whitespace-nowrap hover:bg-gray-100 hover:text-gray-600 [&.active]:text-gray-600 [&.active]:bg-gray-100"
            activeProps={{ className: 'active' }}
            title="Agent Tools (developer)"
          >
            <Terminal className="w-4 h-4" />
          </Link>
          {user ? (
            <UserMenu user={user} />
          ) : (
            <Link to="/login" className="text-sm font-medium text-gray-600 hover:text-gray-900 px-2">
              Sign in
            </Link>
          )}
        </div>
      </div>
    </nav>
  )
}

function UserMenu({ user }: { user: { name: string; email: string } }) {
  const [open, setOpen] = useState(false)
  const router = useRouter()
  async function handleLogout() {
    const { logoutFn } = await import('../server/auth.functions.js')
    await logoutFn()
    await router.invalidate()
    router.navigate({ to: '/login' })
  }
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-gray-100"
      >
        <div className="w-7 h-7 rounded-full bg-gray-900 text-white flex items-center justify-center text-xs font-medium">
          {user.name.slice(0, 1).toUpperCase()}
        </div>
        <span className="text-sm font-medium text-gray-700 hidden sm:block">{user.name}</span>
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-56 bg-white border border-gray-200 rounded-xl shadow-lg p-2 z-50">
          <p className="text-sm font-medium text-gray-900 px-2 py-1">{user.name}</p>
          <p className="text-xs text-gray-500 px-2 pb-2">{user.email}</p>
          <button
            onClick={handleLogout}
            className="w-full text-left text-sm text-gray-700 hover:bg-gray-50 px-2 py-1.5 rounded-md"
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  )
}
