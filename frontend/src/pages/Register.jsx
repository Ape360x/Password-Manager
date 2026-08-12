import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Dial from '../components/Dial'
import StrengthMeter from '../components/StrengthMeter'
import { AlertCircle } from 'lucide-react'

export default function Register() {
  const { register } = useAuth()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    if (password !== confirm) {
      setError('Master passwords do not match.')
      return
    }
    setLoading(true)
    try {
      await register(username, password)
      navigate('/vault')
    } catch (err) {
      setError(err?.response?.data?.error || 'Something went wrong. Try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center blueprint-bg p-8">
      <div className="w-full max-w-sm">
        <div className="flex justify-center mb-6">
          <Dial size={48} />
        </div>
        <h2 className="font-display text-xl text-center text-ink mb-1">Create your vault</h2>
        <p className="text-sm text-steel text-center mb-6">
          Pick a master password you've never used anywhere else &mdash; it's the only
          key that can unlock what you store here.
        </p>

        <form onSubmit={submit} className="space-y-3">
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="input"
            placeholder="Username"
            autoComplete="username"
            autoFocus
          />
          <div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input"
              placeholder="Master password"
              autoComplete="new-password"
            />
            <StrengthMeter password={password} />
          </div>
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="input"
            placeholder="Confirm master password"
            autoComplete="new-password"
          />

          {error && (
            <p className="flex items-center gap-1.5 text-xs text-danger">
              <AlertCircle size={13} /> {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-md bg-brass text-base font-medium text-sm hover:bg-brass-bright transition-colors disabled:opacity-60"
          >
            {loading ? 'Creating\u2026' : 'Create vault'}
          </button>
        </form>

        <p className="text-center text-sm text-steel mt-6">
          Already have a vault?{' '}
          <Link to="/login" className="text-brass hover:text-brass-bright">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
