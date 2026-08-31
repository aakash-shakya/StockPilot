import { useState } from 'react'
import { createFileRoute, Link, useRouter } from '@tanstack/react-router'
import { UserPlus, PackageSearch } from 'lucide-react'
import { registerFn } from '../server/auth.functions.js'
import { Button } from '../components/ui/Button.js'
import { Card } from '../components/ui/Card.js'

export const Route = createFileRoute('/register')({
  component: RegisterPage,
})

function RegisterPage() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const result = await registerFn({ data: { email, password, name } })
      localStorage.setItem('stockpilot_token', result.token)
      localStorage.setItem('stockpilot_user', JSON.stringify(result.user))
      router.navigate({ to: '/' })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed')
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
          <h1 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-ink)' }}>Create account</h1>
          <p className="text-sm text-slate-500 mt-1">Start managing inventory securely</p>
        </div>

        <Card className="p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="text-sm bg-red-50 text-red-700 px-3 py-2.5 rounded-lg border border-red-100">{error}</div>
            )}
            <div>
              <label className="text-xs font-medium block mb-1" style={{ color: 'var(--color-ink-secondary)' }}>Full name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Alex Morgan"
                className="input"
                style={{ fontFamily: 'var(--font-body)' }}
                required
              />
            </div>
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
                placeholder="At least 8 characters"
                className="input"
                style={{ fontFamily: 'var(--font-body)' }}
                required
                minLength={8}
              />
              <p className="text-xs text-slate-400 mt-1">Hashed with bcrypt (12 rounds), never stored in plain text.</p>
            </div>
            <Button
              type="submit"
              disabled={loading}
              variant="primary"
              size="lg"
              className="w-full"
              icon={<UserPlus className="w-4 h-4" />}
            >
              {loading ? 'Creating…' : 'Create account'}
            </Button>
          </form>

          <p className="text-xs text-slate-500 text-center mt-4">
            Already have an account?{' '}
            <Link to="/login" className="text-blue-600 hover:text-blue-700 font-medium">
              Sign in
            </Link>
          </p>
        </Card>
      </div>
    </div>
  )
}
