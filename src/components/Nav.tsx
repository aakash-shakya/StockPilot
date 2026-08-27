import { Link } from '@tanstack/react-router'
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
  { to: '/purchase-orders', label: 'Purchase Orders', icon: ClipboardList },
  { to: '/agent-actions', label: 'Agent Actions', icon: ShieldCheck },
  { to: '/suppliers', label: 'Suppliers', icon: Truck },
  { to: '/health', label: 'Health', icon: HeartPulse },
  { to: '/reports', label: 'Reports', icon: FileBarChart },
  { to: '/simulator', label: 'Simulator', icon: Sliders },
] as const

export function Nav() {
  return (
    <nav className="bg-gray-900 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center gap-6 h-14 overflow-x-auto">
        <span className="font-semibold tracking-tight shrink-0">StockPilot</span>
        <div className="flex items-center gap-1 shrink-0">
          {links.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className="flex items-center gap-1.5 text-sm text-gray-300 px-3 py-1.5 rounded-md whitespace-nowrap hover:bg-white/10 hover:text-white [&.active]:bg-white/10 [&.active]:text-white"
              activeProps={{ className: 'active' }}
            >
              <link.icon className="w-4 h-4" />
              {link.label}
            </Link>
          ))}
        </div>
        <div className="flex items-center gap-2 ml-auto shrink-0">
          <Link
            to="/products/new"
            className="flex items-center gap-1.5 text-sm font-medium text-gray-900 bg-white px-3 py-1.5 rounded-md whitespace-nowrap hover:bg-gray-100"
          >
            <PlusCircle className="w-4 h-4" />
            New Product
          </Link>
          <Link
            to="/agent-tools"
            className="flex items-center gap-1.5 text-xs text-gray-500 px-2 py-1.5 rounded-md whitespace-nowrap hover:bg-white/10 hover:text-gray-300 [&.active]:text-gray-300"
            activeProps={{ className: 'active' }}
            title="Agent Tools (developer)"
          >
            <Terminal className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    </nav>
  )
}
