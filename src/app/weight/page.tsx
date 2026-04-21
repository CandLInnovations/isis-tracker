'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { todayStr, formatDateDisplay } from '@/lib/supplements'
import { PencilIcon, TrashIcon } from '@/components/Icons'

type WeightLog = {
  id: string
  log_date: string
  weight_lbs: number
  notes: string | null
}

function TrendArrow({ current, previous }: { current: number; previous: number | undefined }) {
  if (previous === undefined) return null
  const diff = current - previous
  const abs = Math.abs(diff).toFixed(1)
  if (Math.abs(diff) < 0.1) return <span className="text-bark-400 text-xs">→ stable</span>
  if (diff > 0) return <span className="text-amber-600 text-xs">↑ +{abs} lbs</span>
  return <span className="text-moss-600 text-xs">↓ −{abs} lbs</span>
}

const BASELINE = 107

export default function WeightPage() {
  const [logs, setLogs] = useState<WeightLog[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [logDate, setLogDate] = useState(todayStr())
  const [weightLbs, setWeightLbs] = useState('')
  const [notes, setNotes] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('weight_logs')
      .select('*')
      .order('log_date', { ascending: false })
    setLogs(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  function startEdit(log: WeightLog) {
    setEditingId(log.id)
    setLogDate(log.log_date)
    setWeightLbs(String(log.weight_lbs))
    setNotes(log.notes ?? '')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function cancelEdit() {
    setEditingId(null)
    setLogDate(todayStr())
    setWeightLbs('')
    setNotes('')
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!weightLbs) return
    setSubmitting(true)
    const payload = { log_date: logDate, weight_lbs: parseFloat(weightLbs), notes: notes || null }
    if (editingId) {
      await supabase.from('weight_logs').update(payload).eq('id', editingId)
    } else {
      await supabase.from('weight_logs').insert(payload)
    }
    cancelEdit()
    await load()
    setSubmitting(false)
  }

  async function deleteEntry(id: string) {
    if (!confirm('Delete this weight entry?')) return
    await supabase.from('weight_logs').delete().eq('id', id)
    setLogs(prev => prev.filter(l => l.id !== id))
  }

  const sortedAsc = [...logs].sort((a, b) => a.log_date.localeCompare(b.log_date))
  const latest = sortedAsc.at(-1)
  const minW = logs.length > 0 ? Math.min(...logs.map(l => l.weight_lbs)) : BASELINE
  const maxW = logs.length > 0 ? Math.max(...logs.map(l => l.weight_lbs)) : BASELINE

  return (
    <div>
      <h1 className="page-title">Weight Log</h1>
      <p className="page-subtitle">Baseline: ~107 lbs at protocol start (April 2026)</p>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="card">
            <p className="section-title">{editingId ? 'Edit Entry' : 'Log Weight'}</p>
            {editingId && (
              <div className="mb-3 flex items-center justify-between bg-bark-50 rounded-lg px-3 py-2">
                <span className="text-xs text-bark-500 font-serif italic">Editing entry…</span>
                <button onClick={cancelEdit} className="text-xs text-bark-500 hover:text-bark-700 underline font-serif">Cancel</button>
              </div>
            )}
            <form onSubmit={submit} className="space-y-4">
              <div>
                <label className="label">Date</label>
                <input type="date" className="input" value={logDate} onChange={e => setLogDate(e.target.value)} required />
              </div>
              <div>
                <label className="label">Weight (lbs)</label>
                <input type="number" step="0.1" min="50" max="200" className="input" placeholder="e.g. 106.5"
                  value={weightLbs} onChange={e => setWeightLbs(e.target.value)} required />
              </div>
              <div>
                <label className="label">Notes</label>
                <textarea className="textarea" rows={2} placeholder="Scale used, time of day, fasted…"
                  value={notes} onChange={e => setNotes(e.target.value)} />
              </div>
              <button type="submit" disabled={submitting} className="btn-primary w-full">
                {submitting ? 'Saving…' : editingId ? 'Update Entry' : 'Log Weight'}
              </button>
            </form>
          </div>

          <div className="card">
            <p className="section-title">Summary</p>
            <div className="space-y-0">
              {[
                { label: 'Baseline', value: '~107 lbs' },
                ...(latest ? [{ label: 'Current', value: `${latest.weight_lbs} lbs (${latest.weight_lbs >= BASELINE ? '+' : ''}${(latest.weight_lbs - BASELINE).toFixed(1)} from baseline)` }] : []),
                ...(logs.length >= 2 ? [
                  { label: 'Recorded Low', value: `${minW} lbs` },
                  { label: 'Recorded High', value: `${maxW} lbs` },
                ] : []),
                { label: 'Entries Logged', value: String(logs.length) },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between items-center py-2 border-b border-bark-100 last:border-0">
                  <span className="text-xs text-bark-500 font-serif">{label}</span>
                  <span className="text-sm font-serif text-bark-700">{value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="lg:col-span-3">
          <h2 className="section-title">Weight History</h2>
          {loading ? (
            <p className="text-bark-400 italic text-sm">Loading…</p>
          ) : logs.length === 0 ? (
            <div className="card text-center py-8">
              <p className="text-bark-400 italic text-sm">No weight entries yet.</p>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="card bg-bark-50 border-bark-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-bark-400 font-serif italic">Protocol Start Baseline</p>
                    <p className="text-sm font-serif text-bark-500 mt-0.5">April 2026</p>
                  </div>
                  <p className="text-lg font-serif font-bold text-bark-400">~107 lbs</p>
                </div>
              </div>
              {logs.map((log) => {
                const idx = sortedAsc.findIndex(l => l.id === log.id)
                const prevWeight = idx > 0 ? sortedAsc[idx - 1].weight_lbs : BASELINE
                const diffFromBaseline = log.weight_lbs - BASELINE
                return (
                  <div key={log.id} className="card">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-serif font-semibold text-bark-800">{formatDateDisplay(log.log_date)}</p>
                        {log.notes && <p className="text-xs text-bark-500 italic mt-0.5">{log.notes}</p>}
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className="text-xl font-serif font-bold text-bark-800">{log.weight_lbs} lbs</p>
                          <div className="flex items-center gap-2 justify-end mt-0.5">
                            <TrendArrow current={log.weight_lbs} previous={prevWeight} />
                            <span className={`text-xs font-serif ${diffFromBaseline < -2 ? 'text-rose-600' : diffFromBaseline < 0 ? 'text-amber-600' : diffFromBaseline === 0 ? 'text-bark-400' : 'text-moss-600'}`}>
                              {diffFromBaseline >= 0 ? '+' : ''}{diffFromBaseline.toFixed(1)} baseline
                            </span>
                          </div>
                        </div>
                        <div className="flex flex-col gap-1">
                          <button onClick={() => startEdit(log)} className="p-1.5 rounded text-bark-400 hover:text-bark-700 hover:bg-bark-100 transition-colors" title="Edit">
                            <PencilIcon />
                          </button>
                          <button onClick={() => deleteEntry(log.id)} className="p-1.5 rounded text-bark-300 hover:text-rose-600 hover:bg-rose-50 transition-colors" title="Delete">
                            <TrashIcon />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
