'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { getCycleDayNumber, isFenbenOnDay, todayStr, formatDateDisplay } from '@/lib/supplements'
import { PencilIcon, TrashIcon } from '@/components/Icons'

type DoseLog = { date: string; given: boolean; notes: string | null }
type DosingMode = 'cycling' | 'continuous'

function localDateStr(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function getMonthDays(year: number, month: number): Date[] {
  const days: Date[] = []
  const d = new Date(year, month, 1)
  while (d.getMonth() === month) { days.push(new Date(d)); d.setDate(d.getDate() + 1) }
  return days
}

export default function FenbenPage() {
  const today = todayStr()
  const [cycleStart, setCycleStart] = useState<string | null>(null)
  const [dosingMode, setDosingMode] = useState<DosingMode>('continuous')
  const [startInput, setStartInput] = useState('')
  const [doses, setDoses] = useState<DoseLog[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [logDate, setLogDate] = useState(today)
  const [logNote, setLogNote] = useState('')
  const [editingDate, setEditingDate] = useState<string | null>(null)

  const now = new Date()
  const [viewYear, setViewYear]   = useState(now.getFullYear())
  const [viewMonth, setViewMonth] = useState(now.getMonth())

  const load = useCallback(async () => {
    setLoading(true)
    const [settings, doseLogs] = await Promise.all([
      supabase.from('fenben_settings').select('cycle_start_date, dosing_mode').eq('id', 1).limit(1),
      supabase.from('fenben_doses').select('dose_date, given, notes').order('dose_date', { ascending: false }),
    ])
    if (settings.data?.[0]) {
      setCycleStart(settings.data[0].cycle_start_date)
      setDosingMode((settings.data[0].dosing_mode as DosingMode) ?? 'continuous')
    }
    setDoses((doseLogs.data ?? []).map(r => ({ date: r.dose_date, given: r.given, notes: r.notes })))
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function saveCycleStart() {
    if (!startInput) return
    setSaving(true)
    await supabase.from('fenben_settings').upsert(
      { id: 1, cycle_start_date: startInput, dosing_mode: dosingMode },
      { onConflict: 'id' }
    )
    setCycleStart(startInput)
    setSaving(false)
  }

  async function saveDosingMode(mode: DosingMode) {
    setDosingMode(mode)
    await supabase.from('fenben_settings').upsert(
      { id: 1, cycle_start_date: cycleStart ?? today, dosing_mode: mode },
      { onConflict: 'id' }
    )
  }

  async function logDose(date: string, given: boolean) {
    await supabase.from('fenben_doses').upsert(
      { dose_date: date, given, notes: logNote || null },
      { onConflict: 'dose_date' }
    )
    setDoses(prev => {
      const next = prev.filter(d => d.date !== date)
      return [{ date, given, notes: logNote || null }, ...next].sort((a, b) => b.date.localeCompare(a.date))
    })
    setLogNote('')
    setEditingDate(null)
  }

  async function deleteEntry(date: string) {
    if (!confirm(`Delete dose log for ${formatDateDisplay(date)}?`)) return
    await supabase.from('fenben_doses').delete().eq('dose_date', date)
    setDoses(prev => prev.filter(d => d.date !== date))
  }

  function startEdit(dose: DoseLog) {
    setEditingDate(dose.date)
    setLogDate(dose.date)
    setLogNote(dose.notes ?? '')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const doseMap: Record<string, boolean> = {}
  for (const d of doses) doseMap[d.date] = d.given

  const monthDays = getMonthDays(viewYear, viewMonth)
  const firstDow  = new Date(viewYear, viewMonth, 1).getDay()
  const blanks    = Array(firstDow).fill(null)
  const monthName = new Date(viewYear, viewMonth, 1).toLocaleString('en-US', { month: 'long', year: 'numeric' })

  function getDayClass(ds: string): string {
    const isToday = ds === today
    const given   = doseMap[ds]
    const isSelected = ds === logDate
    const ring = isSelected ? ' ring-2 ring-bark-600 ring-offset-1' : isToday ? ' ring-2 ring-moss-700' : ''

    if (dosingMode === 'continuous') {
      if (given === true)  return `bg-moss-500 text-white${ring}`
      if (given === false) return `bg-amber-600 text-white${ring}`
      if (isToday)         return `bg-moss-100 text-moss-700 font-bold${ring}`
      if (ds < today)      return `bg-amber-50 text-amber-600 ring-1 ring-amber-300${ring}`
      return `bg-bark-50 text-bark-400${ring}`
    }

    // Cycling mode
    if (!cycleStart) return `bg-bark-50 text-bark-400${ring}`
    const isOn = isFenbenOnDay(cycleStart, ds)
    if (!isOn)           return `bg-bark-100 text-bark-500${ring}`
    if (isToday)         return `bg-moss-500 text-white font-bold${ring}`
    if (ds > today)      return `bg-moss-100 text-moss-700${ring}`
    if (given === true)  return `bg-moss-500 text-white${ring}`
    if (given === false) return `bg-amber-600 text-white${ring}`
    if (ds < today)      return `bg-amber-100 text-amber-700 ring-1 ring-amber-400${ring}`
    return `bg-moss-100 text-moss-700${ring}`
  }

  function getDayLabel(ds: string): string {
    if (dosingMode === 'continuous') {
      if (doseMap[ds] === true)  return 'given'
      if (doseMap[ds] === false) return 'skip'
      return ''
    }
    if (!cycleStart) return ''
    const day = getCycleDayNumber(cycleStart, ds)
    if (day < 1) return ''
    return day <= 3 ? `ON ${day}` : 'OFF'
  }

  const todayIsOn = cycleStart && dosingMode === 'cycling' ? isFenbenOnDay(cycleStart, today) : null
  const todayCycleDay = cycleStart && dosingMode === 'cycling' ? getCycleDayNumber(cycleStart, today) : null
  const selectedIsOn  = cycleStart && dosingMode === 'cycling' ? isFenbenOnDay(cycleStart, logDate) : null
  const selectedEntry = doses.find(d => d.date === logDate)

  return (
    <div>
      <h1 className="page-title">Fenbendazole Tracker</h1>
      <p className="page-subtitle">444mg daily with fat · anti-cancer protocol</p>

      {/* Dosing mode toggle */}
      <div className="card mb-4">
        <p className="label mb-2">Dosing Protocol</p>
        <div className="flex gap-2">
          {(['continuous', 'cycling'] as DosingMode[]).map(mode => (
            <button key={mode} onClick={() => saveDosingMode(mode)}
              className={`flex-1 py-2 rounded-lg border text-sm font-serif transition-all ${dosingMode === mode
                ? mode === 'continuous' ? 'bg-rose-600 border-rose-600 text-white font-semibold'
                  : 'bg-moss-500 border-moss-500 text-white font-semibold'
                : 'border-bark-200 text-bark-600 hover:bg-bark-50'}`}>
              {mode === 'continuous' ? 'Continuous (current)' : 'Cycling (3 on / 4 off)'}
            </button>
          ))}
        </div>
        {dosingMode === 'continuous' && (
          <p className="text-xs text-rose-700 italic mt-2 font-serif">
            ⚠ Continuous dosing — cycling suspended. 444mg daily with fat. Cycling paused due to acute protocol.
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="space-y-4">

          {/* Cycling mode: cycle settings */}
          {dosingMode === 'cycling' && (
            <div className="card">
              <p className="section-title">Cycle Settings</p>
              {cycleStart ? (
                <div className="mb-3 p-2 bg-moss-50 border border-moss-200 rounded-lg">
                  <p className="text-xs text-moss-700">Cycle started</p>
                  <p className="text-sm font-serif font-semibold text-moss-800">{formatDateDisplay(cycleStart)}</p>
                </div>
              ) : (
                <p className="text-sm text-bark-500 italic mb-3">No cycle start date set.</p>
              )}
              <label className="label">Set / Update Cycle Start Date</label>
              <input type="date" className="input mb-2" value={startInput} onChange={e => setStartInput(e.target.value)} />
              <button onClick={saveCycleStart} disabled={saving || !startInput} className="btn-primary w-full">
                {saving ? 'Saving…' : cycleStart ? 'Update Cycle Start' : 'Set Cycle Start'}
              </button>
            </div>
          )}

          {/* Today's status */}
          <div className="card">
            <p className="section-title">Today</p>
            <p className="text-xs text-bark-500 mb-2">{formatDateDisplay(today)}</p>
            {dosingMode === 'continuous' ? (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-rose-50 border border-rose-200">
                <span className="text-lg">💊</span>
                <div>
                  <p className="font-serif font-semibold text-sm text-rose-800">Daily Dose Day</p>
                  <p className="text-xs text-rose-600 opacity-80">444mg with fat — continuous protocol</p>
                </div>
                {doseMap[today] !== undefined && (
                  <span className={`ml-auto text-xs font-semibold font-serif ${doseMap[today] ? 'text-moss-600' : 'text-amber-600'}`}>
                    {doseMap[today] ? '✓ given' : '✗ skipped'}
                  </span>
                )}
              </div>
            ) : cycleStart ? (
              <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${todayIsOn ? 'bg-moss-500 text-white' : 'bg-bark-100 text-bark-600'}`}>
                <span className="text-lg">{todayIsOn ? '🟢' : '⬜'}</span>
                <div>
                  <p className="font-serif font-semibold text-sm">{todayIsOn ? 'Fenben ON Day' : 'Rest Day (OFF)'}</p>
                  <p className="text-xs opacity-80">Day {todayCycleDay} of 7-day cycle</p>
                </div>
              </div>
            ) : (
              <p className="text-bark-500 text-sm italic">Set cycle start date above.</p>
            )}
          </div>

          {/* Log dose form */}
          <div className="card">
            <p className="section-title">{editingDate ? 'Edit Dose' : 'Log a Dose'}</p>
            {editingDate && (
              <div className="mb-3 flex items-center justify-between bg-bark-50 rounded-lg px-3 py-2">
                <span className="text-xs text-bark-500 font-serif italic">Editing {formatDateDisplay(editingDate)}…</span>
                <button onClick={() => { setEditingDate(null); setLogNote('') }} className="text-xs text-bark-500 hover:text-bark-700 underline font-serif">Cancel</button>
              </div>
            )}
            <label className="label">Date</label>
            <input type="date" className="input mb-3" value={logDate}
              onChange={e => { setLogDate(e.target.value); setEditingDate(null) }} />

            {dosingMode === 'cycling' && selectedIsOn !== null && (
              <div className={`flex items-center gap-2 px-2 py-1.5 rounded-md mb-3 text-xs font-serif ${selectedIsOn ? 'bg-moss-100 text-moss-700' : 'bg-bark-100 text-bark-500'}`}>
                <span>{selectedIsOn ? '🟢' : '⬜'}</span>
                <span>{selectedIsOn ? 'ON Day' : 'OFF / Rest Day'}{logDate === today ? ' (today)' : ''}</span>
                {selectedEntry && (
                  <span className={`ml-auto font-semibold ${selectedEntry.given ? 'text-moss-600' : 'text-amber-600'}`}>
                    {selectedEntry.given ? '✓ given' : '✗ skipped'}
                  </span>
                )}
              </div>
            )}
            {dosingMode === 'cycling' && selectedIsOn === false && (
              <p className="text-xs text-bark-400 italic mb-3">Rest day — you can still log if needed.</p>
            )}

            <label className="label">Notes (optional)</label>
            <input className="input mb-3" placeholder="e.g. mixed with sardines" value={logNote} onChange={e => setLogNote(e.target.value)} />
            <div className="flex gap-2">
              <button onClick={() => logDose(logDate, true)}  className="btn-secondary flex-1">✓ Dose Given</button>
              <button onClick={() => logDose(logDate, false)} className="btn-ghost flex-1">✗ Skipped</button>
            </div>
          </div>

          {/* Calendar legend */}
          <div className="card">
            <p className="section-title">Calendar Legend</p>
            <div className="space-y-1.5 text-xs font-serif">
              {(dosingMode === 'continuous' ? [
                { cls: 'bg-moss-500 text-white', label: 'Dose given' },
                { cls: 'bg-amber-600 text-white', label: 'Dose skipped' },
                { cls: 'bg-moss-100 text-moss-700', label: 'Today — not yet logged' },
                { cls: 'bg-amber-50 text-amber-600 ring-1 ring-amber-300', label: 'Past day — not logged' },
              ] : [
                { cls: 'bg-moss-500 text-white', label: 'ON day — dose given' },
                { cls: 'bg-amber-100 text-amber-700 ring-1 ring-amber-400', label: 'ON day — not yet logged' },
                { cls: 'bg-amber-600 text-white', label: 'ON day — dose skipped' },
                { cls: 'bg-moss-100 text-moss-700', label: 'ON day — upcoming' },
                { cls: 'bg-bark-100 text-bark-500', label: 'OFF / rest day' },
              ]).map(({ cls, label }) => (
                <div key={label} className="flex items-center gap-2">
                  <span className={`w-4 h-4 rounded flex-shrink-0 ${cls}`} />
                  <span className="text-bark-600">{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Calendar + history */}
        <div className="lg:col-span-2">
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <button onClick={() => { if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y-1) } else setViewMonth(m => m-1) }} className="btn-ghost px-3 py-1">←</button>
              <h2 className="font-serif text-bark-800 font-semibold">{monthName}</h2>
              <button onClick={() => { if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y+1) } else setViewMonth(m => m+1) }} className="btn-ghost px-3 py-1">→</button>
            </div>
            <div className="grid grid-cols-7 gap-1 mb-1">
              {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => (
                <div key={d} className="text-center text-xs text-bark-400 font-serif py-1">{d}</div>
              ))}
            </div>
            {loading ? (
              <div className="text-center text-bark-400 italic py-8">Loading…</div>
            ) : (
              <div className="grid grid-cols-7 gap-1">
                {blanks.map((_, i) => <div key={`b${i}`} />)}
                {monthDays.map(day => {
                  const ds = localDateStr(day)
                  return (
                    <button key={ds} onClick={() => setLogDate(ds)}
                      className={`rounded-lg p-1 text-center transition-all ${getDayClass(ds)}`}
                      title={formatDateDisplay(ds)}>
                      <div className="text-sm font-serif">{day.getDate()}</div>
                      {getDayLabel(ds) && <div className="text-[9px] leading-tight opacity-80 mt-0.5">{getDayLabel(ds)}</div>}
                    </button>
                  )
                })}
              </div>
            )}
            <p className="text-xs text-bark-400 italic text-center mt-3">Click any day to select it for logging</p>
          </div>

          <div className="card mt-4">
            <p className="section-title">Dose Log</p>
            {doses.length === 0 ? (
              <p className="text-bark-400 italic text-sm">No doses logged yet.</p>
            ) : (
              <div className="space-y-1.5">
                {doses.slice(0, 30).map(dose => (
                  <div key={dose.date} className="flex items-center gap-3">
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${dose.given ? 'bg-moss-500' : 'bg-amber-500'}`} />
                    <span className="text-sm font-serif text-bark-700 flex-1">{formatDateDisplay(dose.date)}</span>
                    <span className={`text-xs ${dose.given ? 'text-moss-600' : 'text-amber-600'}`}>{dose.given ? 'Given' : 'Skipped'}</span>
                    {dose.notes && <span className="text-xs text-bark-400 italic truncate max-w-[120px]">{dose.notes}</span>}
                    <button onClick={() => startEdit(dose)} className="p-1 rounded text-bark-400 hover:text-bark-700 hover:bg-bark-100 transition-colors" title="Edit">
                      <PencilIcon />
                    </button>
                    <button onClick={() => deleteEntry(dose.date)} className="p-1 rounded text-bark-300 hover:text-rose-600 hover:bg-rose-50 transition-colors" title="Delete">
                      <TrashIcon />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
