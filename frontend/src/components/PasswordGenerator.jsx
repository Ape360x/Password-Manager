import { useState } from 'react'
import { RefreshCw, Copy, Check } from 'lucide-react'
import api from '../api'

export default function PasswordGenerator({ onUse }) {
  const [length, setLength] = useState(20)
  const [opts, setOpts] = useState({ use_upper: true, use_lower: true, use_digits: true, use_symbols: true })
  const [password, setPassword] = useState('')
  const [copied, setCopied] = useState(false)
  const [loading, setLoading] = useState(false)

  const generate = async () => {
    setLoading(true)
    try {
      const { data } = await api.post('/generate-password', { length, ...opts, avoid_ambiguous: true })
      setPassword(data.password)
      setCopied(false)
    } finally {
      setLoading(false)
    }
  }

  const copy = async () => {
    if (!password) return
    await navigator.clipboard.writeText(password)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const toggle = (key) => setOpts((o) => ({ ...o, [key]: !o[key] }))

  return (
    <div className="bg-panel2 border border-line rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-display text-sm tracking-wide text-steel uppercase">Generator</h3>
        <button
          type="button"
          onClick={generate}
          disabled={loading}
          className="flex items-center gap-1.5 text-xs font-medium text-brass hover:text-brass-bright transition-colors"
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          Generate
        </button>
      </div>

      <div className="flex items-center gap-2 bg-base border border-line rounded-md px-3 py-2 mb-3">
        <code className="flex-1 font-mono text-sm text-ink truncate">{password || 'Click generate\u2026'}</code>
        <button
          type="button"
          onClick={copy}
          disabled={!password}
          className="text-steel hover:text-brass transition-colors disabled:opacity-30"
          aria-label="Copy generated password"
        >
          {copied ? <Check size={16} className="text-unlock" /> : <Copy size={16} />}
        </button>
      </div>

      <label className="flex items-center justify-between text-xs text-steel mb-3">
        <span>Length: {length}</span>
        <input
          type="range"
          min={8}
          max={48}
          value={length}
          onChange={(e) => setLength(Number(e.target.value))}
          className="w-2/3 accent-brass"
        />
      </label>

      <div className="grid grid-cols-2 gap-2 mb-3">
        {[
          ['use_upper', 'A-Z'],
          ['use_lower', 'a-z'],
          ['use_digits', '0-9'],
          ['use_symbols', '#!@'],
        ].map(([key, label]) => (
          <label key={key} className="flex items-center gap-2 text-xs text-steel font-mono">
            <input
              type="checkbox"
              checked={opts[key]}
              onChange={() => toggle(key)}
              className="accent-brass"
            />
            {label}
          </label>
        ))}
      </div>

      {onUse && (
        <button
          type="button"
          onClick={() => password && onUse(password)}
          disabled={!password}
          className="w-full text-xs font-medium py-2 rounded-md bg-brass/10 text-brass hover:bg-brass/20 transition-colors disabled:opacity-30"
        >
          Use this password
        </button>
      )}
    </div>
  )
}
