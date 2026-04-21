'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { TOPICAL_PRODUCTS, SKIN_REACTIONS, formatDateDisplay, formatTimeDisplay } from '@/lib/supplements'
import { PencilIcon, TrashIcon } from '@/components/Icons'

function localDateTimeStr(): string {
  const now = new Date()
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}

type TopicalLog = {
  id: string
  applied_at: string
  products: string[]
  duration_minutes: number | null
  skin_reaction: string | null
  notes: string | null
}

function groupByDate(logs: TopicalLog[]): Record<string, TopicalLog[]> {
  const groups: Record<string, TopicalLog[]> = {}
  for (const log of logs) {
    const d = log.applied_at.split('T')[0]
    if (!groups[d]) groups[d] = []
    groups[d].push(log)
  }
  return groups
}

export default function TopicalPage() {
  const [logs, setLogs] = useState<TopicalLog[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  const [appliedAt, setAppliedAt]         = useState(localDateTimeStr)
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set())
  const [duration, setDuration]           = useState('')
  const [reaction, setReaction]           = useState('None')
  const [notes, setNotes]                 = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('topical_logs').select('*').order('applied_at', { ascending: false }).limit(100)
    setLogs(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  function startEdit(log: TopicalLog) {
    setEditingId(log.id)
    setAppliedAt(new Date(new Date(log.applied_at).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16))
    setSelectedProducts(new Set(log.products))
    setDuration(log.duration_minutes ? String(log.duration_minutes) : '')
    setReaction(log.skin_reaction ?? 'None')
    setNotes(log.notes ?? '')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function cancelEdit() {
    setEditingId(null)
    setAppliedAt(localDateTimeStr())
    setSelectedProducts(new Set())
    setDuration('')
    setReaction('None')
    setNotes('')
  }

  function toggleProduct(p: string) {
    setSelectedProducts(prev => {
      const next = new Set(prev)
      if (next.has(p)) next.delete(p); else next.add(p)
      return next
    })
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (selectedProducts.size === 0) { alert('Please select at least one product.'); return }
    setSubmitting(true)
    const payload = {
      applied_at: new Date(appliedAt).toISOString(),
      products: Array.from(selectedProducts),
      duration_minutes: duration ? parseInt(duration) : null,
      skin_reaction: reaction !== 'None' ? reaction : null,
      notes: notes || null,
    }
    if (editingId) {
      await supabase.from('topical_logs').update(payload).eq('id', editingId)
    } else {
      await supabase.from('topical_logs').insert(payload)
    }
    cancelEdit()
    await load()
    setSubmitting(false)
  }

  async function deleteEntry(id: string) {
    if (!confirm('Delete this application log?')) return
    await supabase.from('topical_logs').delete().eq('id', id)
    setLogs(prev => prev.filter(l => l.id !== id))
  }

  const grouped = groupByDate(logs)
  const sortedDates = Object.keys(grouped).sort((a, b) => b.localeCompare(a))

  return (
    <div>
      <h1 className="page-title">Topical Applications</h1>
      <p className="page-subtitle">DMSO / castor pack sessions with supporting oils & remedies</p>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-2">
          <div className="card">
            <p className="section-title">{editingId ? 'Edit Application' : 'Log Application'}</p>
            {editingId && (
              <div className="mb-3 flex items-center justify-between bg-bark-50 rounded-lg px-3 py-2">
                <span className="text-xs text-bark-500 font-serif italic">Editing entry…</span>
                <button onClick={cancelEdit} className="text-xs text-bark-500 hover:text-bark-700 underline font-serif">Cancel</button>
              </div>
            )}
            <form onSubmit={submit} className="space-y-4">
              <div>
                <label className="label">Date & Time Applied</label>
                <input type="datetime-local" className="input" value={appliedAt} onChange={e => setAppliedAt(e.target.value)} required />
              </div>
              <div>
                <label className="label">Products Applied</label>
                <div className="grid grid-cols-1 gap-1.5 mt-1">
                  {TOPICAL_PRODUCTS.map(p => (
                    <label key={p} className="flex items-center gap-2 cursor-pointer group">
                      <div
                        onClick={() => toggleProduct(p)}
                        className={`w-4 h-4 flex-shrink-0 rounded border-2 flex items-center justify-center transition-all cursor-pointer ${selectedProducts.has(p) ? 'bg-moss-500 border-moss-500' : 'border-bark-300 group-hover:border-moss-400'}`}
                      >
                        {selectedProducts.has(p) && <span className="text-white text-[10px]">✓</span>}
                      </div>
                      <span onClick={() => toggleProduct(p)} className="text-sm font-serif text-bark-800 cursor-pointer">{p}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className="label">Duration (minutes)</label>
                <input type="number" className="input" placeholder="e.g. 30" min={1} max={120} value={duration} onChange={e => setDuration(e.target.value)} />
              </div>
              <div>
                <label className="label">Skin Reaction</label>
                <select className="select" value={reaction} onChange={e => setReaction(e.target.value)}>
                  {SKIN_REACTIONS.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Notes</label>
                <textarea className="textarea" rows={3} placeholder="Any observations, Isis's reaction, areas treated…" value={notes} onChange={e => setNotes(e.target.value)} />
              </div>
              <button type="submit" disabled={submitting} className="btn-secondary w-full">
                {submitting ? 'Saving…' : editingId ? 'Update Application' : 'Log Application'}
              </button>
            </form>
          </div>
        </div>

        <div className="lg:col-span-3">
          <h2 className="section-title">Application History</h2>
          {loading ? (
            <p className="text-bark-400 italic text-sm">Loading history…</p>
          ) : sortedDates.length === 0 ? (
            <div className="card text-center"><p className="text-bark-400 italic text-sm py-6">No applications logged yet.</p></div>
          ) : (
            <div className="space-y-4">
              {sortedDates.map(date => (
                <div key={date}>
                  <p className="text-xs text-bark-500 uppercase tracking-wide font-serif mb-2">{formatDateDisplay(date)}</p>
                  <div className="space-y-2">
                    {grouped[date].map(log => (
                      <div key={log.id} className="card">
                        <div className="flex items-start gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2">
                              <p className="text-sm font-serif font-semibold text-bark-800">
                                {formatTimeDisplay(log.applied_at)}
                                {log.duration_minutes && <span className="text-bark-400 font-normal ml-2 text-xs">{log.duration_minutes} min</span>}
                              </p>
                              {log.skin_reaction && (
                                <span className={`text-xs px-2 py-0.5 rounded-full ${log.skin_reaction === 'None' ? 'bg-moss-100 text-moss-700' : 'bg-amber-100 text-amber-700'}`}>
                                  {log.skin_reaction}
                                </span>
                              )}
                            </div>
                            <div className="flex flex-wrap gap-1 mb-2">
                              {log.products.map(p => (
                                <span key={p} className="text-xs bg-bark-100 text-bark-600 px-2 py-0.5 rounded-full font-serif">{p}</span>
                              ))}
                            </div>
                            {log.notes && <p className="text-xs text-bark-500 italic border-t border-bark-100 pt-2 mt-2">{log.notes}</p>}
                          </div>
                          <div className="flex flex-col gap-1 flex-shrink-0">
                            <button onClick={() => startEdit(log)} className="p-1.5 rounded text-bark-400 hover:text-bark-700 hover:bg-bark-100 transition-colors" title="Edit">
                              <PencilIcon />
                            </button>
                            <button onClick={() => deleteEntry(log.id)} className="p-1.5 rounded text-bark-300 hover:text-rose-600 hover:bg-rose-50 transition-colors" title="Delete">
                              <TrashIcon />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
