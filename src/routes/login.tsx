import { useState } from 'react'
import { createFileRoute, Link, useRouter } from '@tanstack/react-router'
import { LogIn, PackageSearch } from 'lucide-react'
import { loginFn } from '../server/auth.functions.js'
import { Button } from '../components/ui/Button.js'
import { Card } from '../components/ui/Card.js'

export const Route = createFileRoute('/login')({
  component: LoginPage,
})

function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await loginFn({ data: { email, password } })
      await router.invalidate()
      router.navigate({ to: '/' })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-12" style={{ backgroundColor: 'var(--color-surface-sunken)' }}>
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center mx-auto mb-3" style={{ backgroundColor: 'var(--color-ink)' }}>
            <PackageSearch className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-ink)' }}>Welcome back</h1>
          <p className="text-sm text-slate-500 mt-1">Sign in to StockPilot</p>
        </div>

        <Card className="p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="text-sm bg-red-50 text-red-700 px-3 py-2.5 rounded-lg border border-red-100">{error}</div>
            )}
            <div>
              <label className="text-xs font-medium block mb-1" style={{ color: 'var(--color-ink-secondary)' }}>Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                className="input"
                style={{ fontFamily: 'var(--font-body)' }}
                required
              />
            </div>
            <div>
              <label className="text-xs font-medium block mb-1" style={{ color: 'var(--color-ink-secondary)' }}>Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="input"
                style={{ fontFamily: 'var(--font-body)' }}
                required
              />
            </div>
            <Button
              type="submit"
              disabled={loading}
              variant="primary"
              size="lg"
              className="w-full"
              icon={<LogIn className="w-4 h-4" />}
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>

          <p className="text-xs text-slate-500 text-center mt-4">
            No account?{' '}
            <Link to="/register" className="text-blue-600 hover:text-blue-700 font-medium">
              Create one
            </Link>
          </p>
        </Card>

        <p className="text-xs text-slate-400 text-center mt-4">Demo: register a new account to get started.</p>
      </div>
    </div>
  )
}
