'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { todayStr, formatDateDisplay } from '@/lib/supplements'

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

export default function WeightPage() {
  const [logs, setLogs] = useState<WeightLog[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

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

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!weightLbs) return
    setSubmitting(true)
    const { error } = await supabase.from('weight_logs').insert({
      log_date: logDate,
      weight_lbs: parseFloat(weightLbs),
      notes: notes || null,
    })
    if (error) {
      alert('Error saving: ' + error.message)
    } else {
      setWeightLbs('')
      setNotes('')
      setLogDate(todayStr())
      await load()
    }
    setSubmitting(false)
  }

  const sortedAsc = [...logs].sort((a, b) => a.log_date.localeCompare(b.log_date))
  const latest = sortedAsc[sortedAsc.length - 1]
  const baseline = 107

  const minW = logs.length > 0 ? Math.min(...logs.map(l => l.weight_lbs)) : baseline
  const maxW = logs.length > 0 ? Math.max(...logs.map(l => l.weight_lbs)) : baseline

  return (
    <div>
      <h1 className="page-title">Weight Log</h1>
      <p className="page-subtitle">Baseline: ~107 lbs at protocol start (April 2026)</p>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

        {/* Form + stats */}
        <div className="lg:col-span-2 space-y-4">
          <div className="card">
            <p className="section-title">Log Weight</p>
            <form onSubmit={submit} className="space-y-4">
              <div>
                <label className="label">Date</label>
                <input
                  type="date"
                  className="input"
                  value={logDate}
                  onChange={e => setLogDate(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="label">Weight (lbs)</label>
                <input
                  type="number"
                  step="0.1"
                  min="50"
                  max="200"
                  className="input"
                  placeholder="e.g. 106.5"
                  value={weightLbs}
                  onChange={e => setWeightLbs(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="label">Notes</label>
                <textarea
                  className="textarea"
                  rows={2}
                  placeholder="Scale used, time of day, fasted…"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                />
              </div>

              <button type="submit" disabled={submitting} className="btn-primary w-full">
                {submitting ? 'Saving…' : 'Log Weight'}
              </button>
            </form>
          </div>

          {/* Summary stats */}
          <div className="card">
            <p className="section-title">Summary</p>
            <div className="space-y-3">
              <div className="flex justify-between items-center py-2 border-b border-bark-100">
                <span className="text-xs text-bark-500 font-serif">Baseline</span>
                <span className="text-sm font-serif font-semibold text-bark-700">~107 lbs</span>
              </div>
              {latest && (
                <div className="flex justify-between items-center py-2 border-b border-bark-100">
                  <span className="text-xs text-bark-500 font-serif">Current</span>
                  <span className="text-sm font-serif font-semibold text-bark-800">
                    {latest.weight_lbs} lbs
                    {' '}
                    <span className={`text-xs ${latest.weight_lbs < baseline ? 'text-amber-600' : latest.weight_lbs > baseline ? 'text-bark-500' : 'text-moss-600'}`}>
                      ({latest.weight_lbs >= baseline ? '+' : ''}{(latest.weight_lbs - baseline).toFixed(1)} from baseline)
                    </span>
                  </span>
                </div>
              )}
              {logs.length >= 2 && (
                <>
                  <div className="flex justify-between items-center py-2 border-b border-bark-100">
                    <span className="text-xs text-bark-500 font-serif">Recorded Low</span>
                    <span className="text-sm font-serif text-bark-700">{minW} lbs</span>
                  </div>
                  <div className="flex justify-between items-center py-2">
                    <span className="text-xs text-bark-500 font-serif">Recorded High</span>
                    <span className="text-sm font-serif text-bark-700">{maxW} lbs</span>
                  </div>
                </>
              )}
              <div className="flex justify-between items-center py-2">
                <span className="text-xs text-bark-500 font-serif">Entries Logged</span>
                <span className="text-sm font-serif text-bark-700">{logs.length}</span>
              </div>
            </div>
          </div>
        </div>

        {/* History */}
        <div className="lg:col-span-3">
          <h2 className="section-title">Weight History</h2>

          {loading ? (
            <p className="text-bark-400 italic text-sm">Loading…</p>
          ) : logs.length === 0 ? (
            <div className="card text-center py-8">
              <p className="text-bark-400 italic text-sm">No weight entries yet.</p>
              <p className="text-bark-400 text-xs mt-2">Baseline reference: ~107 lbs at protocol start.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {/* Baseline row */}
              <div className="card bg-bark-50 border-bark-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-bark-400 font-serif italic">Protocol Start Baseline</p>
                    <p className="text-sm font-serif text-bark-500 mt-0.5">April 2026</p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-serif font-bold text-bark-400">~107 lbs</p>
                  </div>
                </div>
              </div>

              {logs.map((log, i) => {
                const prevLog = sortedAsc[sortedAsc.findIndex(l => l.id === log.id) - 1]
                const prevWeight = prevLog?.weight_lbs ?? (i === logs.length - 1 ? baseline : undefined)
                const diffFromBaseline = log.weight_lbs - baseline

                return (
                  <div key={log.id} className="card">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-serif font-semibold text-bark-800">
                          {formatDateDisplay(log.log_date)}
                        </p>
                        {log.notes && (
                          <p className="text-xs text-bark-500 italic mt-0.5">{log.notes}</p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-xl font-serif font-bold text-bark-800">{log.weight_lbs} lbs</p>
                        <div className="flex items-center gap-2 justify-end mt-0.5">
                          <TrendArrow current={log.weight_lbs} previous={prevWeight} />
                          <span className={`text-xs font-serif ${
                            diffFromBaseline < -2 ? 'text-rose-600' :
                            diffFromBaseline < 0 ? 'text-amber-600' :
                            diffFromBaseline === 0 ? 'text-bark-400' :
                            'text-moss-600'
                          }`}>
                            {diffFromBaseline >= 0 ? '+' : ''}{diffFromBaseline.toFixed(1)} baseline
                          </span>
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
