import { Link } from '@tanstack/react-router'
import { PackageSearch, LayoutDashboard, ClipboardList } from 'lucide-react'

const links = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/products', label: 'Products', icon: PackageSearch },
  { to: '/purchase-orders', label: 'Purchase Orders', icon: ClipboardList },
]

export function Nav() {
  return (
    <nav className="bg-gray-900 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center gap-8 h-14">
        <span className="font-bold tracking-tight">StockPilot</span>
        <div className="flex items-center gap-1">
          {links.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className="flex items-center gap-1.5 text-sm text-gray-300 px-3 py-1.5 rounded-md hover:bg-white/10 hover:text-white [&.active]:bg-white/10 [&.active]:text-white"
              activeProps={{ className: 'active' }}
            >
              <link.icon className="w-4 h-4" />
              {link.label}
            </Link>
          ))}
        </div>
      </div>
    </nav>
  )
}
