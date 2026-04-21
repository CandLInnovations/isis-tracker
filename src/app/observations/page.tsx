'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { todayStr, formatDateDisplay } from '@/lib/supplements'

type ObsLog = {
  id: string
  log_date: string
  pain_level: number | null
  energy_level: number | null
  appetite: string | null
  urine_color: string | null
  stool_quality: string | null
  water_intake: string | null
  gum_color: string | null
  vomiting: boolean
  lump_size_cm: number | null
  lump_texture: string | null
  lump_warmth: string | null
  left_side_distension: boolean
  lump_notes: string | null
  general_notes: string | null
}

const PAIN_LABELS = ['', 'Minimal (1)', 'Mild (2)', 'Moderate (3)', 'Significant (4)', 'Severe (5)']
const PAIN_BG     = ['', 'bg-moss-100 text-moss-700', 'bg-moss-100 text-moss-600', 'bg-amber-100 text-amber-700', 'bg-amber-100 text-amber-800', 'bg-rose-100 text-rose-700']

function ScalePicker({ label, value, onChange, labels }: {
  label: string
  value: number | null
  onChange: (v: number | null) => void
  labels: string[]
}) {
  return (
    <div>
      <label className="label">{label}</label>
      <div className="flex gap-1 mt-1">
        {[1, 2, 3, 4, 5].map(n => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(value === n ? null : n)}
            className={`flex-1 py-2 rounded border text-xs font-serif transition-all ${
              value === n
                ? 'bg-bark-700 border-bark-700 text-cream'
                : 'border-bark-200 text-bark-600 hover:bg-bark-50'
            }`}
            title={labels[n]}
          >
            {n}
          </button>
        ))}
      </div>
      {value && <p className="text-xs text-bark-500 mt-0.5 font-serif">{labels[value]}</p>}
    </div>
  )
}

function ObsCard({ log }: { log: ObsLog }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="card">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full text-left flex items-center justify-between gap-2"
      >
        <div className="flex items-center gap-3 flex-wrap">
          <span className="font-serif font-semibold text-bark-800 text-sm">{formatDateDisplay(log.log_date)}</span>
          {log.pain_level && (
            <span className={`text-xs px-2 py-0.5 rounded-full ${PAIN_BG[log.pain_level]}`}>
              Pain {log.pain_level}/5
            </span>
          )}
          {log.energy_level && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-bark-100 text-bark-600">
              Energy {log.energy_level}/5
            </span>
          )}
          {log.vomiting && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-rose-100 text-rose-700">Vomiting</span>
          )}
        </div>
        <span className="text-bark-400 text-xs">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="mt-4 pt-4 border-t border-bark-100 space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs font-serif">
            {[
              { label: 'Appetite',     val: log.appetite },
              { label: 'Urine Color',  val: log.urine_color },
              { label: 'Stool',        val: log.stool_quality },
              { label: 'Water Intake', val: log.water_intake },
              { label: 'Gum Color',    val: log.gum_color },
              { label: 'Vomiting',     val: log.vomiting ? 'Yes' : 'No' },
            ].map(({ label, val }) => val && (
              <div key={label} className="bg-bark-50 rounded-md p-2">
                <p className="text-bark-400 uppercase text-[10px] tracking-wide">{label}</p>
                <p className="text-bark-800 font-semibold mt-0.5">{val}</p>
              </div>
            ))}
          </div>

          {/* Lump section */}
          {(log.lump_size_cm || log.lump_texture || log.lump_warmth || log.left_side_distension || log.lump_notes) && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs font-serif">
              <p className="text-amber-700 font-semibold uppercase tracking-wide text-[10px] mb-2">Lump Observation</p>
              <div className="grid grid-cols-2 gap-2">
                {log.lump_size_cm && <div><span className="text-amber-600">Size:</span> <span className="text-bark-800">{log.lump_size_cm} cm</span></div>}
                {log.lump_texture && <div><span className="text-amber-600">Texture:</span> <span className="text-bark-800">{log.lump_texture}</span></div>}
                {log.lump_warmth && <div><span className="text-amber-600">Warmth:</span> <span className="text-bark-800">{log.lump_warmth}</span></div>}
                {log.left_side_distension && <div className="col-span-2"><span className="text-rose-600 font-semibold">Left side distension noted</span></div>}
              </div>
              {log.lump_notes && <p className="text-bark-600 italic mt-2">{log.lump_notes}</p>}
            </div>
          )}

          {log.general_notes && (
            <p className="text-xs text-bark-500 italic border-t border-bark-100 pt-2">{log.general_notes}</p>
          )}
        </div>
      )}
    </div>
  )
}

const EMPTY_FORM = {
  log_date: todayStr(),
  pain_level: null as number | null,
  energy_level: null as number | null,
  appetite: '',
  urine_color: '',
  stool_quality: '',
  water_intake: '',
  gum_color: '',
  vomiting: false,
  lump_size_cm: '' as string | number,
  lump_texture: '',
  lump_warmth: '',
  left_side_distension: false,
  lump_notes: '',
  general_notes: '',
}

export default function ObservationsPage() {
  const [logs, setLogs] = useState<ObsLog[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('observation_logs')
      .select('*')
      .order('log_date', { ascending: false })
    setLogs(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  function setField<K extends keyof typeof EMPTY_FORM>(key: K, val: (typeof EMPTY_FORM)[K]) {
    setForm(prev => ({ ...prev, [key]: val }))
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)

    const existing = logs.find(l => l.log_date === form.log_date)
    const payload = {
      log_date: form.log_date,
      pain_level: form.pain_level,
      energy_level: form.energy_level,
      appetite: form.appetite || null,
      urine_color: form.urine_color || null,
      stool_quality: form.stool_quality || null,
      water_intake: form.water_intake || null,
      gum_color: form.gum_color || null,
      vomiting: form.vomiting,
      lump_size_cm: form.lump_size_cm !== '' ? Number(form.lump_size_cm) : null,
      lump_texture: form.lump_texture || null,
      lump_warmth: form.lump_warmth || null,
      left_side_distension: form.left_side_distension,
      lump_notes: form.lump_notes || null,
      general_notes: form.general_notes || null,
      updated_at: new Date().toISOString(),
    }

    let error
    if (existing) {
      ({ error } = await supabase.from('observation_logs').update(payload).eq('id', existing.id))
    } else {
      ({ error } = await supabase.from('observation_logs').insert(payload))
    }

    if (error) {
      alert('Error saving: ' + error.message)
    } else {
      setForm({ ...EMPTY_FORM, log_date: todayStr() })
      await load()
    }
    setSubmitting(false)
  }

  const PAIN_SCALE_LABELS   = ['', 'Minimal', 'Mild', 'Moderate', 'Significant', 'Severe']
  const ENERGY_SCALE_LABELS = ['', 'Very Low', 'Low', 'Moderate', 'Good', 'Excellent']

  return (
    <div>
      <h1 className="page-title">Daily Observations</h1>
      <p className="page-subtitle">Vitals, behavior, and lump monitoring for Isis</p>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

        {/* Form */}
        <div className="lg:col-span-2">
          <div className="card">
            <p className="section-title">Log Observations</p>
            <form onSubmit={submit} className="space-y-4">

              <div>
                <label className="label">Date</label>
                <input
                  type="date"
                  className="input"
                  value={form.log_date}
                  onChange={e => setField('log_date', e.target.value)}
                  required
                />
              </div>

              <ScalePicker
                label="Pain Level (1 = minimal · 5 = severe)"
                value={form.pain_level}
                onChange={v => setField('pain_level', v)}
                labels={PAIN_SCALE_LABELS}
              />

              <ScalePicker
                label="Energy Level (1 = very low · 5 = excellent)"
                value={form.energy_level}
                onChange={v => setField('energy_level', v)}
                labels={ENERGY_SCALE_LABELS}
              />

              <div>
                <label className="label">Appetite</label>
                <select className="select" value={form.appetite} onChange={e => setField('appetite', e.target.value)}>
                  <option value="">— not noted —</option>
                  {['Excellent', 'Good', 'Fair', 'Poor', 'Refused'].map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Urine Color</label>
                  <select className="select" value={form.urine_color} onChange={e => setField('urine_color', e.target.value)}>
                    <option value="">—</option>
                    {['Clear', 'Pale yellow', 'Yellow', 'Dark yellow', 'Amber', 'Orange', 'Brown'].map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Stool Quality</label>
                  <select className="select" value={form.stool_quality} onChange={e => setField('stool_quality', e.target.value)}>
                    <option value="">—</option>
                    {['Normal', 'Soft', 'Loose', 'Diarrhea', 'Hard', 'Mucus', 'Blood', 'None'].map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Water Intake</label>
                  <select className="select" value={form.water_intake} onChange={e => setField('water_intake', e.target.value)}>
                    <option value="">—</option>
                    {['Normal', 'Increased', 'Decreased', 'Minimal'].map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Gum Color</label>
                  <select className="select" value={form.gum_color} onChange={e => setField('gum_color', e.target.value)}>
                    <option value="">—</option>
                    {['Pink (normal)', 'Pale pink', 'White/pale', 'Blue/gray', 'Yellow', 'Bright red'].map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                </div>
              </div>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  className="w-4 h-4 accent-rose-500 rounded"
                  checked={form.vomiting}
                  onChange={e => setField('vomiting', e.target.checked)}
                />
                <span className="text-sm font-serif text-bark-700">Vomiting today</span>
              </label>

              {/* Lump section */}
              <div className="border-t border-bark-100 pt-4">
                <p className="text-xs text-bark-600 uppercase tracking-wide font-serif font-semibold mb-3">Lump Observation</p>

                <div className="space-y-3">
                  <div>
                    <label className="label">Estimated Size (cm)</label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      className="input"
                      placeholder="e.g. 4.5"
                      value={form.lump_size_cm}
                      onChange={e => setField('lump_size_cm', e.target.value)}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="label">Texture</label>
                      <select className="select" value={form.lump_texture} onChange={e => setField('lump_texture', e.target.value)}>
                        <option value="">—</option>
                        {['Soft', 'Firm', 'Hard', 'Fluctuant', 'Smooth', 'Irregular', 'Movable', 'Fixed'].map(v => <option key={v} value={v}>{v}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="label">Warmth</label>
                      <select className="select" value={form.lump_warmth} onChange={e => setField('lump_warmth', e.target.value)}>
                        <option value="">—</option>
                        {['Normal', 'Slightly warm', 'Warm', 'Hot'].map(v => <option key={v} value={v}>{v}</option>)}
                      </select>
                    </div>
                  </div>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      className="w-4 h-4 accent-amber-500 rounded"
                      checked={form.left_side_distension}
                      onChange={e => setField('left_side_distension', e.target.checked)}
                    />
                    <span className="text-sm font-serif text-bark-700">Left side distension noted</span>
                  </label>

                  <div>
                    <label className="label">Lump Notes</label>
                    <textarea
                      className="textarea"
                      rows={2}
                      placeholder="Changes in appearance, location, Isis's reaction to touch…"
                      value={form.lump_notes}
                      onChange={e => setField('lump_notes', e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="label">General Notes</label>
                <textarea
                  className="textarea"
                  rows={2}
                  placeholder="Overall mood, activity level, anything else…"
                  value={form.general_notes}
                  onChange={e => setField('general_notes', e.target.value)}
                />
              </div>

              <button type="submit" disabled={submitting} className="btn-secondary w-full">
                {submitting ? 'Saving…' : 'Save Observations'}
              </button>
            </form>
          </div>
        </div>

        {/* History */}
        <div className="lg:col-span-3">
          <h2 className="section-title">Observation History</h2>
          {loading ? (
            <p className="text-bark-400 italic text-sm">Loading history…</p>
          ) : logs.length === 0 ? (
            <div className="card text-center py-8">
              <p className="text-bark-400 italic text-sm">No observations logged yet.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {logs.map(log => <ObsCard key={log.id} log={log} />)}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
