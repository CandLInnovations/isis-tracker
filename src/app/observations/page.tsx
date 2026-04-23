'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { todayStr, formatDateDisplay } from '@/lib/supplements'
import { PencilIcon, TrashIcon } from '@/components/Icons'

type MeasurementUnit = 'in' | 'cm'

type ObsLog = {
  id: string
  log_date: string
  time_of_day: string | null
  pain_level: number | null
  energy_level: number | null
  appetite: string | null
  urine_color: string | null
  stool_quality: string | null
  water_intake: string | null
  gum_color: string | null
  vomiting: boolean
  lump_size_cm: number | null
  belly_measurement_cm: number | null
  belly_exhale: number | null
  belly_inhale: number | null
  measurement_unit: string | null
  belly_unit: string | null
  lump_texture: string | null
  lump_warmth: string | null
  left_side_distension: boolean
  lump_notes: string | null
  general_notes: string | null
}

function localTimeStr(): string {
  const now = new Date()
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
}

function formatTimeOfDay(val: string | null): string | null {
  if (!val) return null
  const match = val.match(/^(\d{1,2}):(\d{2})$/)
  if (!match) return val
  const h = parseInt(match[1]), m = parseInt(match[2])
  const period = h >= 12 ? 'PM' : 'AM'
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${period}`
}

function timeOfDaySortKey(val: string | null): string {
  if (!val) return '99:99'
  if (val === 'Morning')   return '06:00'
  if (val === 'Midday')    return '12:00'
  if (val === 'Nighttime') return '20:00'
  return val
}

const PAIN_BG = ['', 'bg-moss-100 text-moss-700', 'bg-moss-100 text-moss-600', 'bg-amber-100 text-amber-700', 'bg-amber-100 text-amber-800', 'bg-rose-100 text-rose-700']

// Colors for the scale picker selected state (amber-500, orange-500, red-600 are not in custom tailwind config)
const SCALE_SELECTED_BG = ['', '#3d7228', '#519437', '#f59e0b', '#f97316', '#dc2626']

const STOOL_OPTIONS = [
  'Normal', 'Soft', 'Loose', 'Diarrhea', 'Hard',
  'Mucus present', 'Blood present',
  'No movement — under 24h', 'No movement — 24-48h', 'No movement — 48h+',
  'Not observed',
]

const NO_BM_OPTIONS = ['No movement — under 24h', 'No movement — 24-48h', 'No movement — 48h+', 'Not observed']

function fmtMeasurement(val: number | null, storedUnit: string | null, displayUnit: MeasurementUnit): string | null {
  if (val == null) return null
  const src = storedUnit ?? 'cm'
  let v: number
  if (src === displayUnit) v = val
  else if (src === 'cm' && displayUnit === 'in') v = val / 2.54
  else v = val * 2.54
  return `${parseFloat(v.toFixed(1))} ${displayUnit}`
}

function toFormValue(val: number | null, storedUnit: string | null, displayUnit: MeasurementUnit): string {
  if (val == null) return ''
  const src = storedUnit ?? 'cm'
  if (src === displayUnit) return String(val)
  if (src === 'cm' && displayUnit === 'in') return parseFloat((val / 2.54).toFixed(2)).toString()
  return parseFloat((val * 2.54).toFixed(1)).toString()
}

function groupByDate(logs: ObsLog[]): Record<string, ObsLog[]> {
  const groups: Record<string, ObsLog[]> = {}
  for (const log of logs) {
    if (!groups[log.log_date]) groups[log.log_date] = []
    groups[log.log_date].push(log)
  }
  for (const date of Object.keys(groups)) {
    groups[date].sort((a, b) => timeOfDaySortKey(a.time_of_day).localeCompare(timeOfDaySortKey(b.time_of_day)))
  }
  return groups
}

// ── Unit toggle ──────────────────────────────────────────────────────────────

function UnitToggle({ unit, onChange }: { unit: MeasurementUnit; onChange: (u: MeasurementUnit) => void }) {
  return (
    <div className="flex items-center gap-0.5 bg-bark-100 rounded-full p-0.5">
      {(['in', 'cm'] as MeasurementUnit[]).map(u => (
        <button key={u} type="button" onClick={() => onChange(u)}
          className={`px-3 py-1 rounded-full text-xs font-serif font-semibold transition-all min-w-[40px] ${unit === u ? 'bg-white text-bark-800 shadow-sm' : 'text-bark-500 hover:text-bark-700'}`}>
          {u}
        </button>
      ))}
    </div>
  )
}

// ── Scale picker — 5-button segmented control ────────────────────────────────

function ScalePicker({ label, sublabel, value, onChange }: {
  label: string; sublabel: string; value: number | null; onChange: (v: number | null) => void
}) {
  return (
    <div>
      <label className="label">{label}</label>
      <div className="flex gap-0.5 mt-1">
        {[1, 2, 3, 4, 5].map(n => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(value === n ? null : n)}
            style={value === n ? { backgroundColor: SCALE_SELECTED_BG[n], borderColor: SCALE_SELECTED_BG[n] } : {}}
            className={`flex-1 h-11 text-sm font-serif font-semibold transition-all rounded border ${
              value === n ? 'text-white' : 'bg-bark-100 border-bark-200 text-bark-600 hover:bg-bark-200'
            }`}
          >
            {n}
          </button>
        ))}
      </div>
      <p className="text-xs text-bark-400 mt-1 font-serif">{sublabel}</p>
    </div>
  )
}

// ── Collapsible form section ─────────────────────────────────────────────────

function CollapsibleSection({ id, title, defaultOpen, summary, children }: {
  id: string; title: string; defaultOpen: boolean; summary?: string; children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)

  useEffect(() => {
    const stored = localStorage.getItem(`isis-obs-section-${id}`)
    if (stored !== null) setOpen(stored === 'true')
  }, [id])

  function toggle() {
    setOpen(prev => {
      const next = !prev
      localStorage.setItem(`isis-obs-section-${id}`, String(next))
      return next
    })
  }

  return (
    <div className="py-4">
      <button type="button" onClick={toggle} className="flex items-center justify-between w-full group">
        <span className="text-xs text-bark-600 uppercase tracking-wide font-serif font-semibold group-hover:text-bark-800 transition-colors">
          {title}
        </span>
        <div className="flex items-center gap-2">
          {!open && summary && (
            <span className="text-xs text-bark-400 font-serif italic truncate max-w-[200px]">{summary}</span>
          )}
          <span className="text-bark-400 text-xs">{open ? '▲' : '▼'}</span>
        </div>
      </button>
      {open && <div className="space-y-3 mt-3">{children}</div>}
    </div>
  )
}

// ── Trend strip ──────────────────────────────────────────────────────────────

function TrendStrip({ logs, lumpUnit }: { logs: ObsLog[]; lumpUnit: MeasurementUnit }) {
  const todayDate = new Date()
  todayDate.setHours(23, 59, 59, 999)

  const sevenAgo = new Date()
  sevenAgo.setDate(sevenAgo.getDate() - 7)
  sevenAgo.setHours(0, 0, 0, 0)

  const fourteenAgo = new Date()
  fourteenAgo.setDate(fourteenAgo.getDate() - 14)
  fourteenAgo.setHours(0, 0, 0, 0)

  const recent  = logs.filter(l => new Date(l.log_date + 'T00:00:00') >= sevenAgo  && l.pain_level != null)
  const prev7   = logs.filter(l => { const d = new Date(l.log_date + 'T00:00:00'); return d >= fourteenAgo && d < sevenAgo && l.pain_level != null })

  let painStr = '—'
  if (recent.length > 0) {
    const ra = recent.reduce((s, l) => s + l.pain_level!, 0) / recent.length
    if (prev7.length > 0) {
      const pa = prev7.reduce((s, l) => s + l.pain_level!, 0) / prev7.length
      const arrow = ra < pa ? '↓' : ra > pa ? '↑' : '→'
      painStr = `${arrow} ${pa.toFixed(1)} → ${ra.toFixed(1)}`
    } else {
      painStr = `${ra.toFixed(1)} avg`
    }
  }

  const bmLog = [...logs]
    .sort((a, b) => b.log_date.localeCompare(a.log_date))
    .find(l => l.stool_quality && !NO_BM_OPTIONS.includes(l.stool_quality))

  let lastBMStr = '—'
  if (bmLog) {
    const d = new Date(bmLog.log_date + 'T00:00:00')
    const now = new Date(); now.setHours(0, 0, 0, 0)
    const diff = Math.floor((now.getTime() - d.getTime()) / 86400000)
    lastBMStr = diff === 0 ? 'Today' : diff === 1 ? 'Yesterday' : `${diff}d ago`
  }

  const lumpLogs = [...logs].filter(l => l.lump_size_cm != null).sort((a, b) => b.log_date.localeCompare(a.log_date))
  let lastLumpStr = '—'
  if (lumpLogs.length > 0) {
    const latest = lumpLogs[0]
    const disp = fmtMeasurement(latest.lump_size_cm, latest.measurement_unit, lumpUnit) ?? '—'
    if (lumpLogs.length > 1) {
      const toCm = (v: number, u: string | null) => u === 'in' ? v * 2.54 : v
      const diffCm = toCm(latest.lump_size_cm!, latest.measurement_unit) - toCm(lumpLogs[1].lump_size_cm!, lumpLogs[1].measurement_unit)
      const diff   = lumpUnit === 'in' ? diffCm / 2.54 : diffCm
      const arrow  = diff < -0.05 ? '↓' : diff > 0.05 ? '↑' : '→'
      lastLumpStr = `${disp} ${arrow}${Math.abs(diff).toFixed(1)}`
    } else {
      lastLumpStr = disp
    }
  }

  return (
    <div className="grid grid-cols-3 gap-3 bg-bark-50 rounded-xl px-4 py-3 mb-5 text-xs font-serif">
      <div>
        <p className="text-bark-400 uppercase tracking-wide text-[10px] mb-0.5">Pain trend</p>
        <p className="text-bark-800 font-semibold">{painStr}</p>
      </div>
      <div>
        <p className="text-bark-400 uppercase tracking-wide text-[10px] mb-0.5">Last BM</p>
        <p className="text-bark-800 font-semibold">{lastBMStr}</p>
      </div>
      <div>
        <p className="text-bark-400 uppercase tracking-wide text-[10px] mb-0.5">Last lump</p>
        <p className="text-bark-800 font-semibold">{lastLumpStr}</p>
      </div>
    </div>
  )
}

// ── Compact card for today's previous entries ────────────────────────────────

function TodayCard({ log, lumpUnit, onEdit, onDelete }: {
  log: ObsLog; lumpUnit: MeasurementUnit; onEdit: () => void; onDelete: () => void
}) {
  const time = formatTimeOfDay(log.time_of_day)
  const parts: string[] = []
  if (log.appetite) parts.push(`Appetite ${log.appetite.toLowerCase()}`)
  if (log.stool_quality) {
    if (log.stool_quality.startsWith('No movement')) {
      const suffix = log.stool_quality.split('—')[1]?.trim()
      parts.push(`No BM${suffix ? ` ${suffix}` : ''}`)
    } else if (log.stool_quality !== 'Not observed') {
      parts.push(`BM ${log.stool_quality.toLowerCase()}`)
    }
  }
  if (log.gum_color) parts.push(`Gums ${log.gum_color.replace(' (normal)', '').toLowerCase()}`)
  const vitalsSummary = parts.slice(0, 3).join(' · ')
  const lumpDisplay = log.lump_size_cm != null ? fmtMeasurement(log.lump_size_cm, log.measurement_unit, lumpUnit) : null

  return (
    <div className="bg-white border border-bark-100 rounded-xl px-4 py-3 shadow-sm flex items-start gap-3">
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          {time && <span className="text-xs font-serif font-semibold text-bark-700">{time}</span>}
          {log.pain_level  != null && <span className={`text-xs px-2 py-0.5 rounded-full ${PAIN_BG[log.pain_level]}`}>Pain {log.pain_level}</span>}
          {log.energy_level != null && <span className="text-xs px-2 py-0.5 rounded-full bg-bark-100 text-bark-600">Energy {log.energy_level}</span>}
          {log.vomiting && <span className="text-xs px-2 py-0.5 rounded-full bg-rose-100 text-rose-700">Vomiting</span>}
        </div>
        {vitalsSummary && <p className="text-xs text-bark-500 font-serif">{vitalsSummary}</p>}
        {lumpDisplay && <p className="text-xs text-bark-400 font-serif">Lump {lumpDisplay}</p>}
      </div>
      <div className="flex items-center gap-1 flex-shrink-0 pt-0.5">
        <button onClick={onEdit} className="p-1.5 rounded text-bark-400 hover:text-bark-700 hover:bg-bark-100 transition-colors" title="Edit">
          <PencilIcon />
        </button>
        <button onClick={onDelete} className="p-1.5 rounded text-bark-300 hover:text-rose-600 hover:bg-rose-50 transition-colors" title="Delete">
          <TrashIcon />
        </button>
      </div>
    </div>
  )
}

// ── Full collapsible card (used in date strip) ───────────────────────────────

function ObsCard({ log, lumpUnit, bellyUnit, onEdit, onDelete }: {
  log: ObsLog; lumpUnit: MeasurementUnit; bellyUnit: MeasurementUnit; onEdit: () => void; onDelete: () => void
}) {
  const [open, setOpen] = useState(false)
  const exhale = log.belly_exhale ?? log.belly_measurement_cm
  const storedBellyUnit = log.belly_unit ?? log.measurement_unit
  const hasLump = log.lump_size_cm != null || exhale != null || log.belly_inhale != null
    || log.lump_texture || log.lump_warmth || log.left_side_distension || log.lump_notes

  return (
    <div className="card">
      <div className="flex items-center gap-2">
        <button onClick={() => setOpen(o => !o)} className="flex-1 text-left flex items-center gap-2 flex-wrap">
          {log.time_of_day && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-bark-100 text-bark-600 font-serif font-semibold">{formatTimeOfDay(log.time_of_day)}</span>
          )}
          {log.pain_level  != null && <span className={`text-xs px-2 py-0.5 rounded-full ${PAIN_BG[log.pain_level]}`}>Pain {log.pain_level}/5</span>}
          {log.energy_level != null && <span className="text-xs px-2 py-0.5 rounded-full bg-bark-100 text-bark-600">Energy {log.energy_level}/5</span>}
          {log.vomiting && <span className="text-xs px-2 py-0.5 rounded-full bg-rose-100 text-rose-700">Vomiting</span>}
          <span className="text-bark-400 text-xs ml-auto">{open ? '▲' : '▼'}</span>
        </button>
        <button onClick={onEdit} className="p-1.5 rounded text-bark-400 hover:text-bark-700 hover:bg-bark-100 transition-colors flex-shrink-0" title="Edit">
          <PencilIcon />
        </button>
        <button onClick={onDelete} className="p-1.5 rounded text-bark-300 hover:text-rose-600 hover:bg-rose-50 transition-colors flex-shrink-0" title="Delete">
          <TrashIcon />
        </button>
      </div>

      {open && (
        <div className="mt-4 pt-4 border-t border-bark-100 space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs font-serif">
            {[
              { label: 'Appetite',     val: log.appetite },
              { label: 'Urine Color',  val: log.urine_color },
              { label: 'Stool',        val: log.stool_quality },
              { label: 'Water',        val: log.water_intake },
              { label: 'Gum Color',    val: log.gum_color },
              { label: 'Vomiting',     val: log.vomiting ? 'Yes' : null },
            ].map(({ label, val }) => val && (
              <div key={label} className="bg-bark-50 rounded-md p-2">
                <p className="text-bark-400 uppercase text-[10px] tracking-wide">{label}</p>
                <p className="text-bark-800 font-semibold mt-0.5">{val}</p>
              </div>
            ))}
          </div>
          {hasLump && (
            <div className="bg-amber-100 border border-amber-400/30 rounded-lg p-3 text-xs font-serif">
              <p className="text-amber-700 font-semibold uppercase tracking-wide text-[10px] mb-2">Lump Observation</p>
              <div className="grid grid-cols-2 gap-2">
                {log.lump_size_cm != null && (
                  <div><span className="text-amber-600">Size:</span> <span className="text-bark-800">{fmtMeasurement(log.lump_size_cm, log.measurement_unit, lumpUnit)}</span></div>
                )}
                {(exhale != null || log.belly_inhale != null) && (
                  <div className="col-span-2">
                    <span className="text-amber-600">Belly:</span>{' '}
                    {exhale != null && <span className="text-bark-800">Exhale {fmtMeasurement(exhale, storedBellyUnit, bellyUnit)}</span>}
                    {log.belly_inhale != null && <span className="text-bark-800">{exhale != null ? ' / ' : ''}Inhale {fmtMeasurement(log.belly_inhale, storedBellyUnit, bellyUnit)}</span>}
                  </div>
                )}
                {log.lump_texture && <div><span className="text-amber-600">Texture:</span> <span className="text-bark-800">{log.lump_texture}</span></div>}
                {log.lump_warmth  && <div><span className="text-amber-600">Warmth:</span>  <span className="text-bark-800">{log.lump_warmth}</span></div>}
                {log.left_side_distension && <div className="col-span-2"><span className="text-rose-700 font-semibold">Left side distension noted</span></div>}
              </div>
              {log.lump_notes && <p className="text-bark-600 italic mt-2">{log.lump_notes}</p>}
            </div>
          )}
          {log.general_notes && <p className="text-xs text-bark-500 italic border-t border-bark-100 pt-2">{log.general_notes}</p>}
        </div>
      )}
    </div>
  )
}

// ── 7-day date strip ─────────────────────────────────────────────────────────

function DateStrip({ logs, lumpUnit, bellyUnit, onEdit, onDelete }: {
  logs: ObsLog[]; lumpUnit: MeasurementUnit; bellyUnit: MeasurementUnit
  onEdit: (log: ObsLog) => void; onDelete: (id: string) => void
}) {
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const grouped = groupByDate(logs)
  const today = todayStr()

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const y = d.getFullYear()
    const mo = String(d.getMonth() + 1).padStart(2, '0')
    const dy = String(d.getDate()).padStart(2, '0')
    return `${y}-${mo}-${dy}`
  })

  function dotClass(date: string): string {
    const dayLogs = grouped[date]
    if (!dayLogs?.length) return ''
    const painLevels = dayLogs.map(l => l.pain_level).filter((p): p is number => p != null)
    if (!painLevels.length) return 'bg-bark-300'
    const avg = painLevels.reduce((a, b) => a + b, 0) / painLevels.length
    return avg <= 2 ? 'bg-moss-500' : avg <= 3 ? 'bg-amber-400' : 'bg-rose-500'
  }

  return (
    <div>
      <div className="overflow-x-auto -mx-5 px-5 pb-1">
        <div className="flex gap-2 min-w-max">
          {days.map(date => {
            const d = new Date(date + 'T00:00:00')
            const dayAbbr = d.toLocaleDateString('en-US', { weekday: 'short' })
            const dayNum  = d.getDate()
            const isToday    = date === today
            const isSelected = date === selectedDate
            const dot = dotClass(date)

            return (
              <button
                key={date}
                type="button"
                onClick={() => setSelectedDate(isSelected ? null : date)}
                className={`flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl transition-all min-w-[52px] ${
                  isSelected
                    ? 'bg-bark-100 border border-bark-400'
                    : isToday
                    ? 'bg-cream border border-bark-300'
                    : 'bg-white border border-bark-100 hover:border-bark-200'
                }`}
              >
                <span className="text-[10px] uppercase tracking-wide font-serif text-bark-500">{dayAbbr}</span>
                <span className={`text-sm font-semibold font-serif ${isSelected ? 'text-bark-800' : isToday ? 'text-bark-700' : 'text-bark-400'}`}>
                  {dayNum}
                </span>
                <div className={`w-2 h-2 rounded-full ${dot || 'invisible'}`} />
              </button>
            )
          })}
        </div>
      </div>

      {selectedDate && (
        <div className="mt-3 space-y-2">
          {grouped[selectedDate]
            ? [...grouped[selectedDate]].reverse().map(log => (
                <ObsCard
                  key={log.id}
                  log={log}
                  lumpUnit={lumpUnit}
                  bellyUnit={bellyUnit}
                  onEdit={() => onEdit(log)}
                  onDelete={() => onDelete(log.id)}
                />
              ))
            : <p className="text-xs text-bark-400 italic font-serif text-center py-2">No entries for this day.</p>
          }
        </div>
      )}
    </div>
  )
}

// ── Blank form factory ───────────────────────────────────────────────────────

const blankForm = () => ({
  log_date:            todayStr(),
  time_of_day:         localTimeStr(),
  pain_level:          null as number | null,
  energy_level:        null as number | null,
  appetite:            '',
  urine_color:         '',
  stool_quality:       '',
  water_intake:        '',
  gum_color:           '',
  vomiting_type:       '',
  lump_size_cm:        '' as string | number,
  belly_exhale:        '' as string | number,
  belly_inhale:        '' as string | number,
  lump_texture:        '',
  lump_warmth:         '',
  left_side_distension: false,
  lump_notes:          '',
  general_notes:       '',
})

// ── Page ─────────────────────────────────────────────────────────────────────

export default function ObservationsPage() {
  const [logs, setLogs]           = useState<ObsLog[]>([])
  const [loading, setLoading]     = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm]           = useState(blankForm)
  const [lumpUnit, setLumpUnit]   = useState<MeasurementUnit>('in')
  const [bellyUnit, setBellyUnit] = useState<MeasurementUnit>('in')
  const formRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const lu = localStorage.getItem('isis-lump-unit')
    const bu = localStorage.getItem('isis-belly-unit')
    if (lu === 'in' || lu === 'cm') setLumpUnit(lu)
    if (bu === 'in' || bu === 'cm') setBellyUnit(bu)
  }, [])

  function changeLumpUnit(u: MeasurementUnit) { setLumpUnit(u); localStorage.setItem('isis-lump-unit', u) }
  function changeBellyUnit(u: MeasurementUnit) { setBellyUnit(u); localStorage.setItem('isis-belly-unit', u) }

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('observation_logs').select('*').order('log_date', { ascending: false })
    setLogs(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  function setField<K extends keyof ReturnType<typeof blankForm>>(key: K, val: ReturnType<typeof blankForm>[K]) {
    setForm(prev => ({ ...prev, [key]: val }))
  }

  function startEdit(log: ObsLog) {
    setEditingId(log.id)
    setForm({
      log_date:             log.log_date,
      time_of_day:          log.time_of_day ?? 'Morning',
      pain_level:           log.pain_level,
      energy_level:         log.energy_level,
      appetite:             log.appetite ?? '',
      urine_color:          log.urine_color ?? '',
      stool_quality:        log.stool_quality ?? '',
      water_intake:         log.water_intake ?? '',
      gum_color:            log.gum_color ?? '',
      vomiting_type:        '',
      lump_size_cm:         toFormValue(log.lump_size_cm, log.measurement_unit, lumpUnit),
      belly_exhale:         toFormValue(log.belly_exhale ?? log.belly_measurement_cm, log.belly_unit ?? log.measurement_unit, bellyUnit),
      belly_inhale:         toFormValue(log.belly_inhale, log.belly_unit ?? log.measurement_unit, bellyUnit),
      lump_texture:         log.lump_texture ?? '',
      lump_warmth:          log.lump_warmth ?? '',
      left_side_distension: log.left_side_distension,
      lump_notes:           log.lump_notes ?? '',
      general_notes:        log.general_notes ?? '',
    })
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
  }

  function cancelEdit() {
    setEditingId(null)
    setForm(blankForm())
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    const payload = {
      log_date:             form.log_date,
      time_of_day:          form.time_of_day || null,
      pain_level:           form.pain_level,
      energy_level:         form.energy_level,
      appetite:             form.appetite || null,
      urine_color:          form.urine_color || null,
      stool_quality:        form.stool_quality || null,
      water_intake:         form.water_intake || null,
      gum_color:            form.gum_color || null,
      vomiting:             form.vomiting_type !== '',
      lump_size_cm:         form.lump_size_cm !== '' ? Number(form.lump_size_cm) : null,
      belly_exhale:         form.belly_exhale !== '' ? Number(form.belly_exhale) : null,
      belly_inhale:         form.belly_inhale !== '' ? Number(form.belly_inhale) : null,
      measurement_unit:     lumpUnit,
      belly_unit:           bellyUnit,
      lump_texture:         form.lump_texture || null,
      lump_warmth:          form.lump_warmth || null,
      left_side_distension: form.left_side_distension,
      lump_notes:           form.lump_notes || null,
      general_notes:        form.general_notes || null,
      updated_at:           new Date().toISOString(),
    }
    if (editingId) {
      await supabase.from('observation_logs').update(payload).eq('id', editingId)
    } else {
      await supabase.from('observation_logs').insert(payload)
    }
    cancelEdit()
    await load()
    setSubmitting(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function deleteEntry(id: string) {
    if (!confirm('Delete this observation entry?')) return
    await supabase.from('observation_logs').delete().eq('id', id)
    setLogs(prev => prev.filter(l => l.id !== id))
  }

  const today     = todayStr()
  const grouped   = groupByDate(logs)
  const todayLogs = grouped[today] ?? []

  const lumpSizePlaceholder = lumpUnit === 'in' ? 'e.g. 1.75' : 'e.g. 4.5'
  const bellyPlaceholder    = bellyUnit === 'in' ? 'e.g. 9.5'  : 'e.g. 24.0'

  const lumpFormSummary = (() => {
    const parts: string[] = []
    if (form.lump_size_cm !== '') parts.push(`${form.lump_size_cm} ${lumpUnit}`)
    if (form.belly_exhale !== '' || form.belly_inhale !== '') {
      const ex  = form.belly_exhale !== '' ? form.belly_exhale : '—'
      const inh = form.belly_inhale !== '' ? form.belly_inhale : '—'
      parts.push(`Belly ${ex}/${inh}`)
    }
    if (form.lump_texture) parts.push(form.lump_texture)
    if (form.left_side_distension) parts.push('Distension')
    return parts.join(' · ')
  })()

  const editingTimeLabel = editingId ? (formatTimeOfDay(form.time_of_day) ?? formatDateDisplay(form.log_date)) : null

  return (
    <div>
      <h1 className="page-title">Daily Observations</h1>
      <p className="page-subtitle">Vitals, behavior, and lump monitoring for Isis</p>

      {!loading && <TrendStrip logs={logs} lumpUnit={lumpUnit} />}

      {/* Today's previous entries */}
      {todayLogs.length > 0 && (
        <div className="mb-5">
          <p className="text-xs text-bark-500 uppercase tracking-wide font-serif mb-2">
            Today — {todayLogs.length} {todayLogs.length === 1 ? 'entry' : 'entries'} logged
          </p>
          <div className="space-y-2">
            {todayLogs.map(log => (
              <TodayCard
                key={log.id}
                log={log}
                lumpUnit={lumpUnit}
                onEdit={() => startEdit(log)}
                onDelete={() => deleteEntry(log.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Form */}
      <div ref={formRef} className="card">
        {editingId && (
          <div className="mb-4 -mt-1 flex items-center justify-between bg-bark-50 rounded-lg px-3 py-2">
            <span className="text-xs text-bark-600 font-serif">Editing {editingTimeLabel}</span>
            <button type="button" onClick={cancelEdit} className="text-xs text-bark-400 hover:text-bark-700 underline font-serif">
              Cancel
            </button>
          </div>
        )}

        <form onSubmit={submit}>
          <div className="divide-y divide-bark-100">

            {/* Group 1: Vitals */}
            <CollapsibleSection id="vitals" title="Vitals" defaultOpen={true}>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Date</label>
                  <input type="date" className="input" value={form.log_date}
                    onChange={e => setField('log_date', e.target.value)} required />
                </div>
                <div>
                  <label className="label">Time</label>
                  <input type="time" className="input" value={form.time_of_day ?? ''}
                    onChange={e => setField('time_of_day', e.target.value)} />
                </div>
              </div>
              <ScalePicker
                label="Pain Level"
                sublabel="1 = minimal · 5 = severe"
                value={form.pain_level}
                onChange={v => setField('pain_level', v)}
              />
              <ScalePicker
                label="Energy Level"
                sublabel="1 = very low · 5 = excellent"
                value={form.energy_level}
                onChange={v => setField('energy_level', v)}
              />
            </CollapsibleSection>

            {/* Group 2: Intake & Output */}
            <CollapsibleSection id="intake" title="Intake & Output" defaultOpen={true}>
              <div>
                <label className="label">Appetite</label>
                <select className="select" value={form.appetite} onChange={e => setField('appetite', e.target.value)}>
                  <option value="">— not noted —</option>
                  {['Excellent', 'Good', 'Fair', 'Poor', 'Refused'].map(v => <option key={v}>{v}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Water Intake</label>
                  <select className="select" value={form.water_intake} onChange={e => setField('water_intake', e.target.value)}>
                    <option value="">—</option>
                    {['Normal', 'Increased', 'Decreased', 'Minimal'].map(v => <option key={v}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Urine Color</label>
                  <select className="select" value={form.urine_color} onChange={e => setField('urine_color', e.target.value)}>
                    <option value="">—</option>
                    {['Clear', 'Pale yellow', 'Yellow', 'Dark yellow', 'Amber', 'Orange', 'Brown'].map(v => <option key={v}>{v}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Stool Quality</label>
                  <select className="select" value={form.stool_quality} onChange={e => setField('stool_quality', e.target.value)}>
                    <option value="">—</option>
                    {STOOL_OPTIONS.map(v => <option key={v}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Gum Color</label>
                  <select className="select" value={form.gum_color} onChange={e => setField('gum_color', e.target.value)}>
                    <option value="">—</option>
                    {['Pink (normal)', 'Pale pink', 'White/pale', 'Blue/gray', 'Yellow', 'Bright red'].map(v => <option key={v}>{v}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="label">Vomited</label>
                <select className="select" value={form.vomiting_type} onChange={e => setField('vomiting_type', e.target.value)}>
                  <option value="">— not noted —</option>
                  {['Yellow or Green', 'Blood — Fresh', 'Blood — Coffee Grounds', 'Undigested Food', 'Clear', 'Brown'].map(v => <option key={v}>{v}</option>)}
                </select>
              </div>
            </CollapsibleSection>

            {/* Group 3: Lump & Body */}
            <CollapsibleSection id="lump" title="Lump & Body" defaultOpen={false} summary={lumpFormSummary || undefined}>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="label !mb-0">Estimated Size ({lumpUnit})</label>
                  <UnitToggle unit={lumpUnit} onChange={changeLumpUnit} />
                </div>
                <input type="number" step="any" min="0" className="input" placeholder={lumpSizePlaceholder}
                  value={form.lump_size_cm} onChange={e => setField('lump_size_cm', e.target.value)} />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="label !mb-0">Belly ({bellyUnit})</label>
                  <UnitToggle unit={bellyUnit} onChange={changeBellyUnit} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label text-[11px]">Full Exhale</label>
                    <input type="number" step="any" min="0" className="input" placeholder={bellyPlaceholder}
                      value={form.belly_exhale} onChange={e => setField('belly_exhale', e.target.value)} />
                  </div>
                  <div>
                    <label className="label text-[11px]">Full Inhale</label>
                    <input type="number" step="any" min="0" className="input" placeholder={bellyPlaceholder}
                      value={form.belly_inhale} onChange={e => setField('belly_inhale', e.target.value)} />
                  </div>
                </div>
                <p className="text-[11px] text-bark-400 font-serif leading-snug mt-1">
                  Measure at widest point of lump. Two measurements per session for accuracy.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Texture</label>
                  <select className="select" value={form.lump_texture} onChange={e => setField('lump_texture', e.target.value)}>
                    <option value="">—</option>
                    {['Soft', 'Firm', 'Hard', 'Fluctuant', 'Smooth', 'Irregular', 'Movable', 'Fixed'].map(v => <option key={v}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Warmth</label>
                  <select className="select" value={form.lump_warmth} onChange={e => setField('lump_warmth', e.target.value)}>
                    <option value="">—</option>
                    {['Normal', 'Slightly warm', 'Warm', 'Hot'].map(v => <option key={v}>{v}</option>)}
                  </select>
                </div>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" className="w-4 h-4 accent-amber-700 rounded"
                  checked={form.left_side_distension} onChange={e => setField('left_side_distension', e.target.checked)} />
                <span className="text-sm font-serif text-bark-700">Left side distension noted</span>
              </label>
              <div>
                <label className="label">Lump Notes</label>
                <textarea className="textarea" rows={2}
                  placeholder="Changes in appearance, location, Isis's reaction to touch…"
                  value={form.lump_notes} onChange={e => setField('lump_notes', e.target.value)} />
              </div>
            </CollapsibleSection>

            {/* Group 4: Interventions */}
            <CollapsibleSection id="interventions" title="Interventions" defaultOpen={false}>
              <p className="text-xs text-bark-400 italic font-serif">No intervention fields configured.</p>
            </CollapsibleSection>

            {/* Group 5: General Notes */}
            <CollapsibleSection id="notes" title="General Notes" defaultOpen={false}>
              <textarea className="textarea" rows={3}
                placeholder="Overall mood, activity level, anything else…"
                value={form.general_notes} onChange={e => setField('general_notes', e.target.value)} />
            </CollapsibleSection>

          </div>

          <div className="pt-5">
            <button type="submit" disabled={submitting} className="btn-secondary w-full py-3 text-base">
              {submitting ? 'Saving…' : editingId ? 'Update Observation' : 'Save Observation'}
            </button>
          </div>
        </form>
      </div>

      {/* 7-day date strip */}
      <div className="card mt-6">
        <p className="section-title !mb-4">Recent History</p>
        <div className="flex items-center justify-end gap-3 mb-4">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-bark-400 font-serif uppercase tracking-wide">Lump</span>
            <UnitToggle unit={lumpUnit} onChange={changeLumpUnit} />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-bark-400 font-serif uppercase tracking-wide">Belly</span>
            <UnitToggle unit={bellyUnit} onChange={changeBellyUnit} />
          </div>
        </div>
        {loading ? (
          <p className="text-bark-400 italic text-sm font-serif">Loading…</p>
        ) : (
          <DateStrip
            logs={logs}
            lumpUnit={lumpUnit}
            bellyUnit={bellyUnit}
            onEdit={startEdit}
            onDelete={deleteEntry}
          />
        )}
      </div>
    </div>
  )
}
