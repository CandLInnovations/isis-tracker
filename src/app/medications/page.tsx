'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { GABAPENTIN_REASONS, formatDateDisplay, formatTimeDisplay } from '@/lib/supplements'

function localDateTimeStr(): string {
  const now = new Date()
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}

type GabaLog = {
  id: string
  given_at: string
  pills: number
  pain_before: number | null
  reason: string | null
  notes: string | null
}

const PAIN_LABELS = ['', 'Minimal', 'Mild', 'Moderate', 'Significant', 'Severe']
const PAIN_COLORS = ['', 'text-moss-600', 'text-moss-500', 'text-amber-600', 'text-amber-700', 'text-rose-600']

export default function MedicationsPage() {
  const [logs, setLogs] = useState<GabaLog[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  // Form
  const [givenAt, setGivenAt] = useState(() => localDateTimeStr())
  const [pills, setPills] = useState<1 | 2>(1)
  const [painBefore, setPainBefore] = useState<number | null>(null)
  const [reason, setReason] = useState('')
  const [notes, setNotes] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('gabapentin_logs')
      .select('*')
      .order('given_at', { ascending: false })
    setLogs(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    const { error } = await supabase.from('gabapentin_logs').insert({
      given_at: new Date(givenAt).toISOString(),
      pills,
      pain_before: painBefore,
      reason: reason || null,
      notes: notes || null,
    })
    if (error) {
      alert('Error saving: ' + error.message)
    } else {
      setGivenAt(localDateTimeStr())
      setPills(1)
      setPainBefore(null)
      setReason('')
      setNotes('')
      await load()
    }
    setSubmitting(false)
  }

  const totalDoses = logs.length
  const totalPills = logs.reduce((sum, l) => sum + l.pills, 0)

  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
  const last7 = logs.filter(l => new Date(l.given_at) >= sevenDaysAgo)

  // Group by date
  const grouped: Record<string, GabaLog[]> = {}
  for (const log of logs) {
    const d = log.given_at.split('T')[0]
    if (!grouped[d]) grouped[d] = []
    grouped[d].push(log)
  }
  const sortedDates = Object.keys(grouped).sort((a, b) => b.localeCompare(a))

  return (
    <div>
      <h1 className="page-title">Gabapentin Log</h1>
      <p className="page-subtitle">PRN (as needed) · 100mg per pill · separate herbal treats by 2 hours on dosing days</p>

      {/* Reminder banner */}
      <div className="mb-6 bg-bark-100 border border-bark-300 rounded-xl p-3 flex gap-3 items-start">
        <span className="text-bark-600 text-base">⚠️</span>
        <div className="text-xs font-serif text-bark-600 space-y-0.5">
          <p><strong>1 pill = 100mg gabapentin</strong></p>
          <p>On gabapentin days, space herbal supplement treats at least 2 hours apart from the dose.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

        {/* Form */}
        <div className="lg:col-span-2 space-y-4">
          <div className="card">
            <p className="section-title">Log Dose</p>
            <form onSubmit={submit} className="space-y-4">
              <div>
                <label className="label">Date & Time Given</label>
                <input
                  type="datetime-local"
                  className="input"
                  value={givenAt}
                  onChange={e => setGivenAt(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="label">Pills Given</label>
                <div className="flex gap-2 mt-1">
                  {([1, 2] as const).map(n => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setPills(n)}
                      className={`flex-1 py-2 rounded-lg border text-sm font-serif transition-all ${
                        pills === n
                          ? 'bg-bark-700 border-bark-700 text-cream'
                          : 'border-bark-300 text-bark-600 hover:bg-bark-50'
                      }`}
                    >
                      {n} pill{n > 1 ? 's' : ''} ({n * 100}mg)
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="label">Pain Level Before Dose</label>
                <div className="flex gap-1.5 mt-1">
                  {[1, 2, 3, 4, 5].map(n => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setPainBefore(painBefore === n ? null : n)}
                      className={`flex-1 py-1.5 rounded border text-xs font-serif transition-all ${
                        painBefore === n
                          ? 'bg-bark-700 border-bark-700 text-cream'
                          : 'border-bark-200 text-bark-600 hover:bg-bark-50'
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
                {painBefore && (
                  <p className={`text-xs mt-1 font-serif ${PAIN_COLORS[painBefore]}`}>
                    {PAIN_LABELS[painBefore]} pain
                  </p>
                )}
              </div>

              <div>
                <label className="label">Reason</label>
                <select
                  className="select"
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                >
                  <option value="">Select a reason…</option>
                  {GABAPENTIN_REASONS.map(r => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label">Notes</label>
                <textarea
                  className="textarea"
                  rows={2}
                  placeholder="Additional context…"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                />
              </div>

              <button type="submit" disabled={submitting} className="btn-primary w-full">
                {submitting ? 'Saving…' : 'Log Dose'}
              </button>
            </form>
          </div>

          {/* Stats */}
          <div className="card">
            <p className="section-title">Statistics</p>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Total Doses', value: totalDoses },
                { label: 'Total Pills', value: totalPills },
                { label: 'Last 7 Days', value: last7.length },
                { label: 'mg Last 7 Days', value: last7.reduce((s, l) => s + l.pills * 100, 0) },
              ].map(({ label, value }) => (
                <div key={label} className="bg-bark-50 rounded-lg p-3 text-center">
                  <p className="text-xs text-bark-500 font-serif">{label}</p>
                  <p className="text-xl font-serif font-bold text-bark-800 mt-0.5">{value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* History */}
        <div className="lg:col-span-3">
          <h2 className="section-title">Dose History</h2>

          {loading ? (
            <p className="text-bark-400 italic text-sm">Loading…</p>
          ) : sortedDates.length === 0 ? (
            <div className="card text-center py-8">
              <p className="text-bark-400 italic text-sm">No gabapentin doses logged yet — wonderful!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {sortedDates.map(date => (
                <div key={date}>
                  <p className="text-xs text-bark-500 uppercase tracking-wide font-serif mb-2">
                    {formatDateDisplay(date)}
                    <span className="ml-2 normal-case font-normal">
                      ({grouped[date].reduce((s, l) => s + l.pills, 0)} pills total)
                    </span>
                  </p>
                  <div className="space-y-2">
                    {grouped[date].map(log => (
                      <div key={log.id} className="card">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-sm font-serif font-semibold text-bark-800">
                              {formatTimeDisplay(log.given_at)}
                              <span className="text-bark-400 font-normal ml-2 text-xs">
                                {log.pills} pill{log.pills > 1 ? 's' : ''} · {log.pills * 100}mg
                              </span>
                            </p>
                            {log.reason && (
                              <p className="text-xs text-bark-600 mt-0.5">{log.reason}</p>
                            )}
                            {log.notes && (
                              <p className="text-xs text-bark-500 italic mt-1">{log.notes}</p>
                            )}
                          </div>
                          {log.pain_before && (
                            <div className="text-center flex-shrink-0">
                              <p className="text-lg font-serif font-bold text-bark-700">{log.pain_before}</p>
                              <p className={`text-[10px] font-serif ${PAIN_COLORS[log.pain_before]}`}>
                                {PAIN_LABELS[log.pain_before]}
                              </p>
                            </div>
                          )}
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
