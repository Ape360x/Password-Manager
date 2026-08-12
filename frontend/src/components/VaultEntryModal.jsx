import { useState } from 'react'
import { X } from 'lucide-react'
import PasswordGenerator from './PasswordGenerator'

const EMPTY = { site_name: '', site_url: '', username: '', password: '', notes: '' }

export default function VaultEntryModal({ initial, onSave, onClose }) {
  const [form, setForm] = useState(initial ? { ...EMPTY, ...initial } : EMPTY)
  const [showGenerator, setShowGenerator] = useState(false)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    if (!form.site_name.trim()) return setError('Site name is required.')
    if (!form.password) return setError('Password is required.')
    setSaving(true)
    try {
      await onSave(form)
    } catch (err) {
      setError(err?.response?.data?.error || 'Could not save this entry.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-panel border border-line rounded-xl w-full max-w-md shadow-panel max-h-[90vh] overflow-y-auto scrollbar-thin">
        <div className="flex items-center justify-between px-5 py-4 border-b border-line">
          <h2 className="font-display text-base text-ink">{initial ? 'Edit entry' : 'New entry'}</h2>
          <button onClick={onClose} className="text-steel hover:text-ink" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={submit} className="p-5 space-y-3">
          <Field label="Site name">
            <input value={form.site_name} onChange={set('site_name')} className="input" placeholder="GitHub" autoFocus />
          </Field>
          <Field label="URL (optional)">
            <input value={form.site_url || ''} onChange={set('site_url')} className="input" placeholder="github.com" />
          </Field>
          <Field label="Username / email">
            <input value={form.username || ''} onChange={set('username')} className="input font-mono" placeholder="you@example.com" />
          </Field>
          <Field label="Password">
            <div className="flex gap-2">
              <input
                type="text"
                value={form.password}
                onChange={set('password')}
                className="input font-mono"
                placeholder="\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022"
              />
            </div>
            <button
              type="button"
              onClick={() => setShowGenerator((s) => !s)}
              className="text-xs text-brass hover:text-brass-bright mt-1.5"
            >
              {showGenerator ? 'Hide generator' : 'Generate a password'}
            </button>
          </Field>

          {showGenerator && (
            <PasswordGenerator onUse={(pw) => setForm((f) => ({ ...f, password: pw }))} />
          )}

          <Field label="Notes (optional)">
            <textarea value={form.notes || ''} onChange={set('notes')} className="input resize-none" rows={2} />
          </Field>

          {error && <p className="text-xs text-danger">{error}</p>}

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 rounded-md border border-line text-steel text-sm hover:text-ink hover:border-steel transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-2 rounded-md bg-brass text-base font-medium text-sm hover:bg-brass-bright transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving\u2026' : 'Save entry'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="block text-xs text-steel mb-1">{label}</span>
      {children}
    </label>
  )
}
