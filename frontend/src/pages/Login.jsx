import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Dial from '../components/Dial'
import { AlertCircle } from 'lucide-react'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [status, setStatus] = useState('idle') // idle | spinning | unlocked

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setStatus('spinning')
    try {
      await login(username, password)
      setStatus('unlocked')
      setTimeout(() => navigate('/vault'), 500)
    } catch (err) {
      setStatus('idle')
      setError(err?.response?.data?.error || 'Something went wrong. Try again.')
    }
  }

  return (
    <div className="min-h-screen grid md:grid-cols-2 blueprint-bg">
      <div className="hidden md:flex flex-col justify-between p-12 border-r border-line">
        <div className="flex items-center gap-3">
          <Dial size={32} />
          <span className="font-display text-lg tracking-wide">Keyseat</span>
        </div>
        <div>
          <h1 className="font-display text-4xl leading-tight text-ink mb-4">
            One combination.<br />Every account.
          </h1>
          <p className="text-steel max-w-sm">
            Your vault key never leaves the server unencrypted, and it's derived fresh
            from your master password every time you sign in &mdash; nothing usable is
            ever written to disk.
          </p>
        </div>
        <p className="text-xs text-steel font-mono">AES-256-GCM &middot; Argon2id &middot; PBKDF2-SHA256</p>
      </div>

      <div className="flex items-center justify-center p-8">
        <div className="w-full max-w-sm">
          <div className="flex md:hidden items-center gap-3 mb-8 justify-center">
            <Dial size={28} unlocked={status === 'unlocked'} spinning={status === 'spinning'} />
            <span className="font-display text-lg">Keyseat</span>
          </div>

          <div className="hidden md:flex justify-center mb-6">
            <Dial size={56} unlocked={status === 'unlocked'} spinning={status === 'spinning'} />
          </div>

          <h2 className="font-display text-xl text-center text-ink mb-1">Unlock your vault</h2>
          <p className="text-sm text-steel text-center mb-6">Sign in with your master password</p>

          <form onSubmit={submit} className="space-y-3">
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="input"
              placeholder="Username"
              autoComplete="username"
              autoFocus
            />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input"
              placeholder="Master password"
              autoComplete="current-password"
            />

            {error && (
              <p className="flex items-center gap-1.5 text-xs text-danger">
                <AlertCircle size={13} /> {error}
              </p>
            )}

            <button
              type="submit"
              disabled={status === 'spinning'}
              className="w-full py-2.5 rounded-md bg-brass text-base font-medium text-sm hover:bg-brass-bright transition-colors disabled:opacity-60"
            >
              {status === 'spinning' ? 'Unlocking\u2026' : 'Unlock'}
            </button>
          </form>

          <p className="text-center text-sm text-steel mt-6">
            New here?{' '}
            <Link to="/register" className="text-brass hover:text-brass-bright">
              Create a vault
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
