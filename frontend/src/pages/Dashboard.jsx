import { useEffect, useMemo, useState } from 'react'
import { Plus, Search, LogOut, Lock } from 'lucide-react'
import api from '../api'
import { useAuth } from '../context/AuthContext'
import Dial from '../components/Dial'
import VaultEntryCard from '../components/VaultEntryCard'
import VaultEntryModal from '../components/VaultEntryModal'

export default function Dashboard() {
  const { username, logout } = useAuth()
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [modalEntry, setModalEntry] = useState(undefined) // undefined = closed, null = new, obj = edit
  const [deleteTarget, setDeleteTarget] = useState(null)

  const load = async () => {
    setLoading(true)
    try {
      const { data } = await api.get('/vault')
      setEntries(data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return entries
    return entries.filter(
      (e) =>
        e.site_name.toLowerCase().includes(q) ||
        (e.username || '').toLowerCase().includes(q) ||
        (e.site_url || '').toLowerCase().includes(q)
    )
  }, [entries, query])

  const saveEntry = async (form) => {
    if (modalEntry && modalEntry.id) {
      const { data } = await api.put(`/vault/${modalEntry.id}`, form)
      setEntries((es) => es.map((e) => (e.id === data.id ? data : e)))
    } else {
      const { data } = await api.post('/vault', form)
      setEntries((es) => [...es, data].sort((a, b) => a.site_name.localeCompare(b.site_name)))
    }
    setModalEntry(undefined)
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    await api.delete(`/vault/${deleteTarget.id}`)
    setEntries((es) => es.filter((e) => e.id !== deleteTarget.id))
    setDeleteTarget(null)
  }

  return (
    <div className="min-h-screen blueprint-bg">
      <header className="border-b border-line bg-base/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Dial size={26} unlocked />
            <span className="font-display text-base tracking-wide">Keyseat</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-steel hidden sm:inline">{username}</span>
            <button
              onClick={logout}
              className="flex items-center gap-1.5 text-sm text-steel hover:text-danger transition-colors"
            >
              <LogOut size={15} /> Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-steel" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search your vault\u2026"
              className="input pl-9"
            />
          </div>
          <button
            onClick={() => setModalEntry(null)}
            className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-md bg-brass text-base font-medium text-sm hover:bg-brass-bright transition-colors shrink-0"
          >
            <Plus size={16} /> Add entry
          </button>
        </div>

        {loading ? (
          <p className="text-steel text-sm">Loading vault\u2026</p>
        ) : filtered.length === 0 ? (
          <EmptyState hasQuery={!!query} onAdd={() => setModalEntry(null)} />
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((entry) => (
              <VaultEntryCard
                key={entry.id}
                entry={entry}
                onEdit={setModalEntry}
                onDelete={setDeleteTarget}
              />
            ))}
          </div>
        )}
      </main>

      {modalEntry !== undefined && (
        <VaultEntryModal
          initial={modalEntry}
          onSave={saveEntry}
          onClose={() => setModalEntry(undefined)}
        />
      )}

      {deleteTarget && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-panel border border-line rounded-xl w-full max-w-sm p-5">
            <h3 className="font-display text-base text-ink mb-2">Delete {deleteTarget.site_name}?</h3>
            <p className="text-sm text-steel mb-5">
              This can't be undone. The encrypted entry will be permanently removed.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setDeleteTarget(null)}
                className="flex-1 py-2 rounded-md border border-line text-steel text-sm hover:text-ink hover:border-steel transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="flex-1 py-2 rounded-md bg-danger text-base font-medium text-sm hover:opacity-90 transition-opacity"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function EmptyState({ hasQuery, onAdd }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-20 border border-dashed border-line rounded-lg">
      <Lock size={28} className="text-steel mb-3" />
      <p className="text-ink font-display mb-1">{hasQuery ? 'No matches' : 'Your vault is empty'}</p>
      <p className="text-sm text-steel mb-4 max-w-xs">
        {hasQuery
          ? 'Try a different search term.'
          : 'Add your first entry to start building your vault.'}
      </p>
      {!hasQuery && (
        <button
          onClick={onAdd}
          className="flex items-center gap-1.5 px-4 py-2 rounded-md bg-brass text-base font-medium text-sm hover:bg-brass-bright transition-colors"
        >
          <Plus size={16} /> Add entry
        </button>
      )}
    </div>
  )
}
