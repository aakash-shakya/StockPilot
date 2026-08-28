import { useState } from 'react'
import { createFileRoute, Link, useRouter } from '@tanstack/react-router'
import { UserPlus, PackageSearch } from 'lucide-react'
import { registerFn } from '../server/auth.functions.js'

export const Route = createFileRoute('/register')({
  component: RegisterPage,
})

function RegisterPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await registerFn({ data: { email, password, name } })
      await router.invalidate()
      router.navigate({ to: '/' })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="w-10 h-10 bg-gray-900 rounded-xl flex items-center justify-center mx-auto mb-3">
            <PackageSearch className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Create account</h1>
          <p className="text-sm text-gray-500 mt-1">Start managing inventory securely</p>
        </div>

        <div className="panel panel-shadow p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="text-sm bg-red-50 text-red-700 px-3 py-2.5 rounded-lg border border-red-100">{error}</div>
            )}
            <div>
              <label className="text-xs font-medium text-gray-700 block mb-1">Full name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Alex Morgan"
                className="input"
                required
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-700 block mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                className="input"
                required
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-700 block mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
                className="input"
                required
                minLength={8}
              />
              <p className="text-xs text-gray-400 mt-1">Hashed with bcrypt (12 rounds), never stored in plain text.</p>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 disabled:opacity-50"
            >
              <UserPlus className="w-4 h-4" />
              {loading ? 'Creating…' : 'Create account'}
            </button>
          </form>

          <p className="text-xs text-gray-500 text-center mt-4">
            Already have an account?{' '}
            <Link to="/login" className="text-blue-600 hover:text-blue-700 font-medium">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
