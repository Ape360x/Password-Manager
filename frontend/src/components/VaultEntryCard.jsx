import { useState } from 'react'
import { Eye, EyeOff, Copy, Check, Pencil, Trash2, Globe } from 'lucide-react'

function initials(name) {
  return name.slice(0, 2).toUpperCase()
}

export default function VaultEntryCard({ entry, onEdit, onDelete }) {
  const [revealed, setRevealed] = useState(false)
  const [copied, setCopied] = useState('')

  const copy = async (field, value) => {
    if (!value) return
    await navigator.clipboard.writeText(value)
    setCopied(field)
    setTimeout(() => setCopied(''), 1200)
  }

  return (
    <div className="group bg-panel border border-line rounded-lg p-4 hover:border-brass/40 transition-colors shadow-panel">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 shrink-0 rounded-md bg-panel2 border border-line flex items-center justify-center font-display text-xs text-brass">
            {initials(entry.site_name)}
          </div>
          <div className="min-w-0">
            <h3 className="font-display text-sm text-ink truncate">{entry.site_name}</h3>
            {entry.site_url && (
              <a
                href={entry.site_url.startsWith('http') ? entry.site_url : `https://${entry.site_url}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 text-xs text-steel hover:text-brass truncate"
              >
                <Globe size={11} /> {entry.site_url}
              </a>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={() => onEdit(entry)} className="p-1.5 text-steel hover:text-brass" aria-label="Edit entry">
            <Pencil size={14} />
          </button>
          <button onClick={() => onDelete(entry)} className="p-1.5 text-steel hover:text-danger" aria-label="Delete entry">
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {entry.username && (
        <div className="flex items-center justify-between bg-panel2 border border-line rounded-md px-3 py-2 mb-2">
          <span className="font-mono text-xs text-steel truncate">{entry.username}</span>
          <button onClick={() => copy('username', entry.username)} className="text-steel hover:text-brass shrink-0 ml-2" aria-label="Copy username">
            {copied === 'username' ? <Check size={13} className="text-unlock" /> : <Copy size={13} />}
          </button>
        </div>
      )}

      <div className="flex items-center justify-between bg-panel2 border border-line rounded-md px-3 py-2">
        <span className="font-mono text-xs text-ink truncate">
          {revealed ? entry.password : '\u2022'.repeat(Math.min(entry.password.length, 16))}
        </span>
        <div className="flex items-center gap-2 shrink-0 ml-2">
          <button onClick={() => setRevealed((r) => !r)} className="text-steel hover:text-brass" aria-label={revealed ? 'Hide password' : 'Reveal password'}>
            {revealed ? <EyeOff size={13} /> : <Eye size={13} />}
          </button>
          <button onClick={() => copy('password', entry.password)} className="text-steel hover:text-brass" aria-label="Copy password">
            {copied === 'password' ? <Check size={13} className="text-unlock" /> : <Copy size={13} />}
          </button>
        </div>
      </div>

      {entry.notes && <p className="text-xs text-steel mt-2 line-clamp-2">{entry.notes}</p>}
    </div>
  )
}
