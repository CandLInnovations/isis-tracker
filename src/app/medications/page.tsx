'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { GABAPENTIN_REASONS, formatDateDisplay, formatTimeDisplay } from '@/lib/supplements'
import { PencilIcon, TrashIcon } from '@/components/Icons'

function localDateStr(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

function localTimeStr(): string {
  const now = new Date()
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
}

function localDateTimeStr(): string {
  const now = new Date()
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}

type MedTab = 'gabapentin' | 'benadryl' | 'all'

type GabaLog = {
  id: string
  given_at: string
  pills: number
  pain_before: number | null
  reason: string | null
  notes: string | null
}

type BenadrylLog = {
  id: string
  given_at: string
  dose_mg: number
  reason: string | null
  notes: string | null
}

type CombinedEntry =
  | ({ med: 'gabapentin' } & GabaLog)
  | ({ med: 'benadryl' } & BenadrylLog)

const PAIN_LABELS = ['', 'Minimal', 'Mild', 'Moderate', 'Significant', 'Severe']
const PAIN_COLORS = ['', 'text-moss-600', 'text-moss-500', 'text-amber-600', 'text-amber-700', 'text-rose-600']

function groupByDate<T extends { given_at: string }>(entries: T[]): Record<string, T[]> {
  const groups: Record<string, T[]> = {}
  for (const e of entries) {
    const d = e.given_at.split('T')[0]
    if (!groups[d]) groups[d] = []
    groups[d].push(e)
  }
  return groups
}

export default function MedicationsPage() {
  const [tab, setTab] = useState<MedTab>('gabapentin')

  const [gabaLogs, setGabaLogs] = useState<GabaLog[]>([])
  const [gabaLoading, setGabaLoading] = useState(true)
  const [gabaSubmitting, setGabaSubmitting] = useState(false)
  const [gabaEditingId, setGabaEditingId] = useState<string | null>(null)
  const [givenAt, setGivenAt] = useState(() => localDateTimeStr())
  const [pills, setPills] = useState<1 | 2>(1)
  const [painBefore, setPainBefore] = useState<number | null>(null)
  const [gabaReason, setGabaReason] = useState('')
  const [gabaNotes, setGabaNotes] = useState('')

  const [benadrylLogs, setBenadrylLogs] = useState<BenadrylLog[]>([])
  const [benadrylLoading, setBenadrylLoading] = useState(true)
  const [benadrylSubmitting, setBenadrylSubmitting] = useState(false)
  const [benadrylEditingId, setBenadrylEditingId] = useState<string | null>(null)
  const [bDate, setBDate] = useState(() => localDateStr())
  const [bTime, setBTime] = useState(() => localTimeStr())
  const [doseMg, setDoseMg] = useState<25 | 50>(25)
  const [bReason, setBReason] = useState('')
  const [bNotes, setBNotes] = useState('')

  const loadGaba = useCallback(async () => {
    setGabaLoading(true)
    const { data } = await supabase.from('gabapentin_logs').select('*').order('given_at', { ascending: false })
    setGabaLogs(data ?? [])
    setGabaLoading(false)
  }, [])

  const loadBenadryl = useCallback(async () => {
    setBenadrylLoading(true)
    const { data } = await supabase.from('benadryl_logs').select('*').order('given_at', { ascending: false })
    setBenadrylLogs(data ?? [])
    setBenadrylLoading(false)
  }, [])

  useEffect(() => { loadGaba(); loadBenadryl() }, [loadGaba, loadBenadryl])

  function startGabaEdit(log: GabaLog) {
    setTab('gabapentin')
    setGabaEditingId(log.id)
    const d = new Date(log.given_at)
    setGivenAt(new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16))
    setPills(log.pills as 1 | 2)
    setPainBefore(log.pain_before)
    setGabaReason(log.reason ?? '')
    setGabaNotes(log.notes ?? '')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function cancelGabaEdit() {
    setGabaEditingId(null)
    setGivenAt(localDateTimeStr())
    setPills(1)
    setPainBefore(null)
    setGabaReason('')
    setGabaNotes('')
  }

  async function submitGaba(e: React.FormEvent) {
    e.preventDefault()
    setGabaSubmitting(true)
    const payload = { given_at: new Date(givenAt).toISOString(), pills, pain_before: painBefore, reason: gabaReason || null, notes: gabaNotes || null }
    if (gabaEditingId) {
      await supabase.from('gabapentin_logs').update(payload).eq('id', gabaEditingId)
    } else {
      await supabase.from('gabapentin_logs').insert(payload)
    }
    cancelGabaEdit()
    await loadGaba()
    setGabaSubmitting(false)
  }

  async function deleteGaba(id: string) {
    if (!confirm('Delete this gabapentin entry?')) return
    await supabase.from('gabapentin_logs').delete().eq('id', id)
    setGabaLogs(prev => prev.filter(l => l.id !== id))
  }

  function startBenadrylEdit(log: BenadrylLog) {
    setTab('benadryl')
    setBenadrylEditingId(log.id)
    const d = new Date(log.given_at)
    const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    setBDate(local.toISOString().slice(0, 10))
    setBTime(local.toISOString().slice(11, 16))
    setDoseMg(log.dose_mg as 25 | 50)
    setBReason(log.reason ?? '')
    setBNotes(log.notes ?? '')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function cancelBenadrylEdit() {
    setBenadrylEditingId(null)
    setBDate(localDateStr())
    setBTime(localTimeStr())
    setDoseMg(25)
    setBReason('')
    setBNotes('')
  }

  async function submitBenadryl(e: React.FormEvent) {
    e.preventDefault()
    setBenadrylSubmitting(true)
    const payload = {
      given_at: new Date(`${bDate}T${bTime}`).toISOString(),
      dose_mg: doseMg,
      reason: bReason || null,
      notes: bNotes || null,
    }
    if (benadrylEditingId) {
      await supabase.from('benadryl_logs').update(payload).eq('id', benadrylEditingId)
    } else {
      await supabase.from('benadryl_logs').insert(payload)
    }
    cancelBenadrylEdit()
    await loadBenadryl()
    setBenadrylSubmitting(false)
  }

  async function deleteBenadryl(id: string) {
    if (!confirm('Delete this Benadryl entry?')) return
    await supabase.from('benadryl_logs').delete().eq('id', id)
    setBenadrylLogs(prev => prev.filter(l => l.id !== id))
  }

  const sevenDaysAgo = new Date(); sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
  const gabaLast7    = gabaLogs.filter(l => new Date(l.given_at) >= sevenDaysAgo)
  const benadrylLast7 = benadrylLogs.filter(l => new Date(l.given_at) >= sevenDaysAgo)

  const combined: CombinedEntry[] = [
    ...gabaLogs.map(l => ({ med: 'gabapentin' as const, ...l })),
    ...benadrylLogs.map(l => ({ med: 'benadryl' as const, ...l })),
  ].sort((a, b) => new Date(b.given_at).getTime() - new Date(a.given_at).getTime())

  const gabaGrouped      = groupByDate(gabaLogs)
  const benadrylGrouped  = groupByDate(benadrylLogs)
  const combinedGrouped  = groupByDate(combined)
  const gabaDates        = Object.keys(gabaGrouped).sort((a, b) => b.localeCompare(a))
  const benadrylDates    = Object.keys(benadrylGrouped).sort((a, b) => b.localeCompare(a))
  const combinedDates    = Object.keys(combinedGrouped).sort((a, b) => b.localeCompare(a))
  const loading          = gabaLoading || benadrylLoading

  return (
    <div>
      <h1 className="page-title">Medications</h1>
      <p className="page-subtitle">PRN medications — gabapentin and Benadryl as needed</p>

      <div className="flex gap-0 mb-6 border-b border-bark-200">
        {([
          { key: 'gabapentin', label: 'Gabapentin' },
          { key: 'benadryl',   label: 'Benadryl' },
          { key: 'all',        label: 'All' },
        ] as { key: MedTab; label: string }[]).map(({ key, label }) => (
          <button key={key} onClick={() => setTab(key)}
            className={`px-4 py-2.5 text-sm font-serif transition-colors ${tab === key
              ? 'border-b-2 border-bark-700 text-bark-800 font-semibold -mb-px'
              : 'text-bark-500 hover:text-bark-700'}`}>
            {label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-2 space-y-4">

          {tab === 'gabapentin' && (
            <>
              <div className="bg-bark-100 border border-bark-300 rounded-xl p-3 flex gap-3 items-start">
                <span className="text-bark-600 text-base">⚠️</span>
                <div className="text-xs font-serif text-bark-600 space-y-0.5">
                  <p><strong>1 pill = 100mg gabapentin</strong></p>
                  <p>On gabapentin days, space herbal supplement treats at least 2 hours apart from the dose.</p>
                </div>
              </div>
              <div className="card">
                <p className="section-title">{gabaEditingId ? 'Edit Entry' : 'Log Gabapentin'}</p>
                {gabaEditingId && (
                  <div className="mb-3 flex items-center justify-between bg-bark-50 rounded-lg px-3 py-2">
                    <span className="text-xs text-bark-500 font-serif italic">Editing entry…</span>
                    <button onClick={cancelGabaEdit} className="text-xs text-bark-500 hover:text-bark-700 underline font-serif">Cancel</button>
                  </div>
                )}
                <form onSubmit={submitGaba} className="space-y-4">
                  <div>
                    <label className="label">Date & Time Given</label>
                    <input type="datetime-local" className="input" value={givenAt} onChange={e => setGivenAt(e.target.value)} required />
                  </div>
                  <div>
                    <label className="label">Pills Given</label>
                    <div className="flex gap-2 mt-1">
                      {([1, 2] as const).map(n => (
                        <button key={n} type="button" onClick={() => setPills(n)}
                          className={`flex-1 py-2 rounded-lg border text-sm font-serif transition-all ${pills === n ? 'bg-bark-700 border-bark-700 text-cream' : 'border-bark-300 text-bark-600 hover:bg-bark-50'}`}>
                          {n} pill{n > 1 ? 's' : ''} ({n * 100}mg)
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="label">Pain Level Before Dose</label>
                    <div className="flex gap-1.5 mt-1">
                      {[1, 2, 3, 4, 5].map(n => (
                        <button key={n} type="button" onClick={() => setPainBefore(painBefore === n ? null : n)}
                          className={`flex-1 py-1.5 rounded border text-xs font-serif transition-all ${painBefore === n ? 'bg-bark-700 border-bark-700 text-cream' : 'border-bark-200 text-bark-600 hover:bg-bark-50'}`}>
                          {n}
                        </button>
                      ))}
                    </div>
                    {painBefore && <p className={`text-xs mt-1 font-serif ${PAIN_COLORS[painBefore]}`}>{PAIN_LABELS[painBefore]} pain</p>}
                  </div>
                  <div>
                    <label className="label">Reason</label>
                    <select className="select" value={gabaReason} onChange={e => setGabaReason(e.target.value)}>
                      <option value="">Select a reason…</option>
                      {GABAPENTIN_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="label">Notes</label>
                    <textarea className="textarea" rows={2} placeholder="Additional context…" value={gabaNotes} onChange={e => setGabaNotes(e.target.value)} />
                  </div>
                  <button type="submit" disabled={gabaSubmitting} className="btn-primary w-full">
                    {gabaSubmitting ? 'Saving…' : gabaEditingId ? 'Update Entry' : 'Log Dose'}
                  </button>
                </form>
              </div>

              <div className="card">
                <p className="section-title">Gabapentin Stats</p>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: 'Total Doses',    value: gabaLogs.length },
                    { label: 'Total Pills',    value: gabaLogs.reduce((s, l) => s + l.pills, 0) },
                    { label: 'Last 7 Days',    value: gabaLast7.length },
                    { label: 'mg Last 7 Days', value: gabaLast7.reduce((s, l) => s + l.pills * 100, 0) },
                  ].map(({ label, value }) => (
                    <div key={label} className="bg-bark-50 rounded-lg p-3 text-center">
                      <p className="text-xs text-bark-500 font-serif">{label}</p>
                      <p className="text-xl font-serif font-bold text-bark-800 mt-0.5">{value}</p>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {tab === 'benadryl' && (
            <>
              <div className="bg-amber-50 border border-amber-300 rounded-xl p-3 flex gap-3 items-start">
                <span className="text-amber-600 text-base">⚠️</span>
                <div className="text-xs font-serif text-amber-900 space-y-1">
                  <p><strong>Plain diphenhydramine only</strong></p>
                  <p>Verify no xylitol, no Benadryl-D, no combination formulas.</p>
                  <p>Do not give within 2 hours of gabapentin.</p>
                </div>
              </div>
              <div className="card">
                <p className="section-title">{benadrylEditingId ? 'Edit Entry' : 'Log Benadryl'}</p>
                {benadrylEditingId && (
                  <div className="mb-3 flex items-center justify-between bg-bark-50 rounded-lg px-3 py-2">
                    <span className="text-xs text-bark-500 font-serif italic">Editing entry…</span>
                    <button onClick={cancelBenadrylEdit} className="text-xs text-bark-500 hover:text-bark-700 underline font-serif">Cancel</button>
                  </div>
                )}
                <form onSubmit={submitBenadryl} className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="label">Date</label>
                      <input type="date" className="input" value={bDate} onChange={e => setBDate(e.target.value)} required />
                    </div>
                    <div>
                      <label className="label">Time</label>
                      <input type="time" className="input" value={bTime} onChange={e => setBTime(e.target.value)} required />
                    </div>
                  </div>
                  <div>
                    <label className="label">Dose</label>
                    <div className="flex gap-2 mt-1">
                      {([25, 50] as const).map(mg => (
                        <button key={mg} type="button" onClick={() => setDoseMg(mg)}
                          className={`flex-1 py-2 rounded-lg border text-sm font-serif transition-all ${doseMg === mg ? 'bg-amber-600 border-amber-600 text-white' : 'border-amber-300 text-amber-700 hover:bg-amber-50'}`}>
                          {mg}mg ({mg / 25} tab{mg > 25 ? 's' : ''})
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="label">Reason / Trigger</label>
                    <input type="text" className="input" placeholder="e.g. pain restlessness, unable to settle…"
                      value={bReason} onChange={e => setBReason(e.target.value)} />
                  </div>
                  <div>
                    <label className="label">Notes</label>
                    <textarea className="textarea" rows={2} placeholder="Additional context…" value={bNotes} onChange={e => setBNotes(e.target.value)} />
                  </div>
                  <button type="submit" disabled={benadrylSubmitting}
                    className="w-full py-2.5 px-4 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-serif font-semibold transition-colors disabled:opacity-50">
                    {benadrylSubmitting ? 'Saving…' : benadrylEditingId ? 'Update Entry' : 'Log Benadryl'}
                  </button>
                </form>
              </div>

              <div className="card">
                <p className="section-title">Benadryl Stats</p>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: 'Total Doses',    value: benadrylLogs.length },
                    { label: 'Total mg',       value: benadrylLogs.reduce((s, l) => s + l.dose_mg, 0) },
                    { label: 'Last 7 Days',    value: benadrylLast7.length },
                    { label: 'mg Last 7 Days', value: benadrylLast7.reduce((s, l) => s + l.dose_mg, 0) },
                  ].map(({ label, value }) => (
                    <div key={label} className="bg-amber-50 rounded-lg p-3 text-center">
                      <p className="text-xs text-amber-700 font-serif">{label}</p>
                      <p className="text-xl font-serif font-bold text-amber-900 mt-0.5">{value}</p>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {tab === 'all' && (
            <div className="space-y-3">
              <div className="card">
                <p className="section-title">Gabapentin — Last 7 Days</p>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  <div className="bg-bark-50 rounded-lg p-2.5 text-center">
                    <p className="text-[10px] text-bark-500 font-serif">Doses</p>
                    <p className="text-lg font-serif font-bold text-bark-800">{gabaLast7.length}</p>
                  </div>
                  <div className="bg-bark-50 rounded-lg p-2.5 text-center">
                    <p className="text-[10px] text-bark-500 font-serif">mg Given</p>
                    <p className="text-lg font-serif font-bold text-bark-800">{gabaLast7.reduce((s, l) => s + l.pills * 100, 0)}</p>
                  </div>
                </div>
              </div>
              <div className="card">
                <p className="section-title">Benadryl — Last 7 Days</p>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  <div className="bg-amber-50 rounded-lg p-2.5 text-center">
                    <p className="text-[10px] text-amber-700 font-serif">Doses</p>
                    <p className="text-lg font-serif font-bold text-amber-900">{benadrylLast7.length}</p>
                  </div>
                  <div className="bg-amber-50 rounded-lg p-2.5 text-center">
                    <p className="text-[10px] text-amber-700 font-serif">mg Given</p>
                    <p className="text-lg font-serif font-bold text-amber-900">{benadrylLast7.reduce((s, l) => s + l.dose_mg, 0)}</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="lg:col-span-3">
          <h2 className="section-title">
            {tab === 'gabapentin' ? 'Gabapentin History' : tab === 'benadryl' ? 'Benadryl History' : 'All Medications'}
          </h2>

          {loading ? (
            <p className="text-bark-400 italic text-sm">Loading…</p>
          ) : (
            <>
              {tab === 'gabapentin' && (
                gabaDates.length === 0 ? (
                  <div className="card text-center py-8">
                    <p className="text-bark-400 italic text-sm">No gabapentin doses logged yet — wonderful!</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {gabaDates.map(date => (
                      <div key={date}>
                        <p className="text-xs text-bark-500 uppercase tracking-wide font-serif mb-2">
                          {formatDateDisplay(date)}
                          <span className="ml-2 normal-case font-normal">({gabaGrouped[date].reduce((s, l) => s + l.pills, 0)} pills)</span>
                        </p>
                        <div className="space-y-2">
                          {gabaGrouped[date].map(log => (
                            <div key={log.id} className="card">
                              <div className="flex items-start gap-2">
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-serif font-semibold text-bark-800">
                                    {formatTimeDisplay(log.given_at)}
                                    <span className="text-bark-400 font-normal ml-2 text-xs">{log.pills} pill{log.pills > 1 ? 's' : ''} · {log.pills * 100}mg</span>
                                  </p>
                                  {log.reason && <p className="text-xs text-bark-600 mt-0.5">{log.reason}</p>}
                                  {log.notes  && <p className="text-xs text-bark-500 italic mt-1">{log.notes}</p>}
                                </div>
                                <div className="flex items-center gap-1 flex-shrink-0">
                                  {log.pain_before && (
                                    <div className="text-center mr-2">
                                      <p className="text-lg font-serif font-bold text-bark-700">{log.pain_before}</p>
                                      <p className={`text-[10px] font-serif ${PAIN_COLORS[log.pain_before]}`}>{PAIN_LABELS[log.pain_before]}</p>
                                    </div>
                                  )}
                                  <button onClick={() => startGabaEdit(log)} className="p-1.5 rounded text-bark-400 hover:text-bark-700 hover:bg-bark-100 transition-colors" title="Edit"><PencilIcon /></button>
                                  <button onClick={() => deleteGaba(log.id)} className="p-1.5 rounded text-bark-300 hover:text-rose-600 hover:bg-rose-50 transition-colors" title="Delete"><TrashIcon /></button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )
              )}

              {tab === 'benadryl' && (
                benadrylDates.length === 0 ? (
                  <div className="card text-center py-8">
                    <p className="text-bark-400 italic text-sm">No Benadryl doses logged yet.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {benadrylDates.map(date => (
                      <div key={date}>
                        <p className="text-xs text-bark-500 uppercase tracking-wide font-serif mb-2">
                          {formatDateDisplay(date)}
                          <span className="ml-2 normal-case font-normal">({benadrylGrouped[date].reduce((s, l) => s + l.dose_mg, 0)}mg)</span>
                        </p>
                        <div className="space-y-2">
                          {benadrylGrouped[date].map(log => (
                            <div key={log.id} className="card border-amber-100">
                              <div className="flex items-start gap-2">
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-serif font-semibold text-bark-800">
                                    {formatTimeDisplay(log.given_at)}
                                    <span className="text-amber-600 font-normal ml-2 text-xs">{log.dose_mg}mg ({log.dose_mg / 25} tab{log.dose_mg > 25 ? 's' : ''})</span>
                                  </p>
                                  {log.reason && <p className="text-xs text-bark-600 mt-0.5">{log.reason}</p>}
                                  {log.notes  && <p className="text-xs text-bark-500 italic mt-1">{log.notes}</p>}
                                </div>
                                <div className="flex items-center gap-1 flex-shrink-0">
                                  <button onClick={() => startBenadrylEdit(log)} className="p-1.5 rounded text-bark-400 hover:text-bark-700 hover:bg-bark-100 transition-colors" title="Edit"><PencilIcon /></button>
                                  <button onClick={() => deleteBenadryl(log.id)} className="p-1.5 rounded text-bark-300 hover:text-rose-600 hover:bg-rose-50 transition-colors" title="Delete"><TrashIcon /></button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )
              )}

              {tab === 'all' && (
                combined.length === 0 ? (
                  <div className="card text-center py-8">
                    <p className="text-bark-400 italic text-sm">No medications logged yet.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {combinedDates.map(date => (
                      <div key={date}>
                        <p className="text-xs text-bark-500 uppercase tracking-wide font-serif mb-2">{formatDateDisplay(date)}</p>
                        <div className="space-y-2">
                          {combinedGrouped[date].map(entry => (
                            <div key={entry.id} className={`card ${entry.med === 'benadryl' ? 'border-amber-100 bg-amber-50/30' : ''}`}>
                              <div className="flex items-start gap-2">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-serif font-semibold border ${entry.med === 'benadryl' ? 'bg-amber-100 text-amber-700 border-amber-200' : 'bg-bark-100 text-bark-600 border-bark-200'}`}>
                                      {entry.med === 'benadryl' ? 'Benadryl' : 'Gabapentin'}
                                    </span>
                                    <p className="text-sm font-serif font-semibold text-bark-800">{formatTimeDisplay(entry.given_at)}</p>
                                    <span className={`text-xs ${entry.med === 'benadryl' ? 'text-amber-600' : 'text-bark-400'}`}>
                                      {entry.med === 'benadryl'
                                        ? `${entry.dose_mg}mg`
                                        : `${entry.pills} pill${entry.pills > 1 ? 's' : ''} · ${entry.pills * 100}mg`}
                                    </span>
                                  </div>
                                  {entry.reason && <p className="text-xs text-bark-600 mt-0.5">{entry.reason}</p>}
                                  {entry.notes  && <p className="text-xs text-bark-500 italic mt-1">{entry.notes}</p>}
                                </div>
                                <div className="flex items-center gap-1 flex-shrink-0">
                                  {entry.med === 'gabapentin' && entry.pain_before && (
                                    <div className="text-center mr-2">
                                      <p className="text-lg font-serif font-bold text-bark-700">{entry.pain_before}</p>
                                      <p className={`text-[10px] font-serif ${PAIN_COLORS[entry.pain_before]}`}>{PAIN_LABELS[entry.pain_before]}</p>
                                    </div>
                                  )}
                                  <button
                                    onClick={() => entry.med === 'gabapentin' ? startGabaEdit(entry) : startBenadrylEdit(entry)}
                                    className="p-1.5 rounded text-bark-400 hover:text-bark-700 hover:bg-bark-100 transition-colors" title="Edit"><PencilIcon />
                                  </button>
                                  <button
                                    onClick={() => entry.med === 'gabapentin' ? deleteGaba(entry.id) : deleteBenadryl(entry.id)}
                                    className="p-1.5 rounded text-bark-300 hover:text-rose-600 hover:bg-rose-50 transition-colors" title="Delete"><TrashIcon />
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
