'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { getCycleDayNumber, isFenbenOnDay, todayStr, formatDateDisplay } from '@/lib/supplements'

type DoseLog = Record<string, boolean> // date -> given

function getMonthDays(year: number, month: number): Date[] {
  const days: Date[] = []
  const d = new Date(year, month, 1)
  while (d.getMonth() === month) {
    days.push(new Date(d))
    d.setDate(d.getDate() + 1)
  }
  return days
}

function dateStr(d: Date): string {
  return d.toISOString().split('T')[0]
}

export default function FenbenPage() {
  const today = todayStr()
  const [cycleStart, setCycleStart] = useState<string | null>(null)
  const [startInput, setStartInput] = useState('')
  const [doses, setDoses] = useState<DoseLog>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Log dose form
  const [logDate, setLogDate] = useState(today)
  const [logNote, setLogNote] = useState('')

  const now = new Date()
  const [viewYear, setViewYear] = useState(now.getFullYear())
  const [viewMonth, setViewMonth] = useState(now.getMonth())

  const load = useCallback(async () => {
    setLoading(true)
    const [settings, doseLogs] = await Promise.all([
      supabase.from('fenben_settings').select('cycle_start_date').eq('id', 1).maybeSingle(),
      supabase.from('fenben_doses').select('dose_date, given'),
    ])
    if (settings.data) setCycleStart(settings.data.cycle_start_date)
    const doseMap: DoseLog = {}
    for (const row of doseLogs.data ?? []) doseMap[row.dose_date] = row.given
    setDoses(doseMap)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function saveCycleStart() {
    if (!startInput) return
    setSaving(true)
    await supabase.from('fenben_settings').upsert({ id: 1, cycle_start_date: startInput }, { onConflict: 'id' })
    setCycleStart(startInput)
    setSaving(false)
  }

  async function logDose(date: string, given: boolean) {
    await supabase.from('fenben_doses').upsert(
      { dose_date: date, given, notes: logNote || null },
      { onConflict: 'dose_date' }
    )
    setDoses(prev => ({ ...prev, [date]: given }))
    setLogNote('')
  }

  const monthDays = getMonthDays(viewYear, viewMonth)
  const firstDow = new Date(viewYear, viewMonth, 1).getDay()
  const blanks = Array(firstDow).fill(null)

  function getDayClass(dateS: string): string {
    if (!cycleStart) return 'bg-bark-50 text-bark-400'
    const isOn = isFenbenOnDay(cycleStart, dateS)
    const isPast = dateS < today
    const isToday = dateS === today
    const given = doses[dateS]

    if (!isOn) return `bg-bark-100 text-bark-500 ${isToday ? 'ring-2 ring-bark-400' : ''}`
    if (isToday) return 'bg-moss-500 text-white ring-2 ring-moss-700 font-bold'
    if (dateS > today) return 'bg-moss-100 text-moss-700'
    if (given === true) return 'bg-moss-500 text-white'
    if (given === false) return 'bg-amber-600 text-white'
    if (isPast) return 'bg-amber-100 text-amber-700 ring-1 ring-amber-400'
    return 'bg-moss-100 text-moss-700'
  }

  function getDayLabel(dateS: string): string {
    if (!cycleStart) return ''
    const day = getCycleDayNumber(cycleStart, dateS)
    if (day < 1) return ''
    return day <= 3 ? `ON ${day}` : 'OFF'
  }

  const todayIsOn    = cycleStart ? isFenbenOnDay(cycleStart, today) : null
  const todayCycleDay = cycleStart ? getCycleDayNumber(cycleStart, today) : null

  const selectedIsOn     = cycleStart ? isFenbenOnDay(cycleStart, logDate) : null
  const selectedCycleDay = cycleStart ? getCycleDayNumber(cycleStart, logDate) : null
  const selectedGiven    = doses[logDate]

  const monthName = new Date(viewYear, viewMonth, 1).toLocaleString('en-US', { month: 'long', year: 'numeric' })

  return (
    <div>
      <h1 className="page-title">Fenbendazole Tracker</h1>
      <p className="page-subtitle">3 days ON · 4 days OFF · 400mg per dose with raw meal</p>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Left column */}
        <div className="space-y-4">

          {/* Cycle settings */}
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
            <input
              type="date"
              className="input mb-2"
              value={startInput}
              onChange={e => setStartInput(e.target.value)}
            />
            <button
              onClick={saveCycleStart}
              disabled={saving || !startInput}
              className="btn-primary w-full"
            >
              {saving ? 'Saving…' : cycleStart ? 'Update Cycle Start' : 'Set Cycle Start'}
            </button>
          </div>

          {/* Today's status */}
          {cycleStart && (
            <div className="card">
              <p className="section-title">Today</p>
              <p className="text-xs text-bark-500 mb-2">{formatDateDisplay(today)}</p>
              <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${todayIsOn ? 'bg-moss-500 text-white' : 'bg-bark-100 text-bark-600'}`}>
                <span className="text-lg">{todayIsOn ? '🟢' : '⬜'}</span>
                <div>
                  <p className="font-serif font-semibold text-sm">
                    {todayIsOn ? 'Fenben ON Day' : 'Rest Day (OFF)'}
                  </p>
                  <p className="text-xs opacity-80">Day {todayCycleDay} of 7-day cycle</p>
                </div>
              </div>
              {!todayIsOn && todayCycleDay && (
                <p className="text-xs text-bark-500 italic mt-2">
                  Next ON period begins in {7 - todayCycleDay} day(s).
                </p>
              )}
            </div>
          )}

          {/* Log dose — always visible once cycle is set */}
          {cycleStart && (
            <div className="card">
              <p className="section-title">Log a Dose</p>

              <label className="label">Date</label>
              <input
                type="date"
                className="input mb-3"
                value={logDate}
                onChange={e => setLogDate(e.target.value)}
              />

              {/* Show cycle status for selected date */}
              {selectedCycleDay !== null && selectedCycleDay >= 1 && (
                <div className={`flex items-center gap-2 px-2 py-1.5 rounded-md mb-3 text-xs font-serif ${selectedIsOn ? 'bg-moss-100 text-moss-700' : 'bg-bark-100 text-bark-500'}`}>
                  <span>{selectedIsOn ? '🟢' : '⬜'}</span>
                  <span>
                    {selectedIsOn ? `ON Day ${selectedCycleDay}` : 'OFF / Rest Day'}
                    {logDate === today ? ' (today)' : ''}
                  </span>
                  {selectedGiven === true && <span className="ml-auto font-semibold text-moss-600">✓ logged</span>}
                  {selectedGiven === false && <span className="ml-auto font-semibold text-amber-600">✗ skipped</span>}
                </div>
              )}

              {!selectedIsOn && (
                <p className="text-xs text-bark-400 italic mb-3">
                  This is a rest day — fenben is not scheduled. You can still log if needed.
                </p>
              )}

              <label className="label">Notes (optional)</label>
              <input
                className="input mb-3"
                placeholder="e.g. mixed with sardines"
                value={logNote}
                onChange={e => setLogNote(e.target.value)}
              />

              <div className="flex gap-2">
                <button
                  onClick={() => logDose(logDate, true)}
                  className="btn-secondary flex-1"
                >
                  ✓ Dose Given
                </button>
                <button
                  onClick={() => logDose(logDate, false)}
                  className="btn-ghost flex-1"
                >
                  ✗ Skipped
                </button>
              </div>
            </div>
          )}

          {/* Legend */}
          <div className="card">
            <p className="section-title">Calendar Legend</p>
            <div className="space-y-1.5 text-xs font-serif">
              {[
                { cls: 'bg-moss-500 text-white', label: 'ON day — dose given' },
                { cls: 'bg-amber-100 text-amber-700 ring-1 ring-amber-400', label: 'ON day — not yet logged' },
                { cls: 'bg-amber-600 text-white', label: 'ON day — dose skipped' },
                { cls: 'bg-moss-100 text-moss-700', label: 'ON day — upcoming' },
                { cls: 'bg-bark-100 text-bark-500', label: 'OFF / rest day' },
              ].map(({ cls, label }) => (
                <div key={label} className="flex items-center gap-2">
                  <span className={`w-4 h-4 rounded flex-shrink-0 ${cls}`} />
                  <span className="text-bark-600">{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Calendar + history */}
        <div className="lg:col-span-2">
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <button
                onClick={() => {
                  if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1) }
                  else setViewMonth(m => m - 1)
                }}
                className="btn-ghost px-3 py-1"
              >←</button>
              <h2 className="font-serif text-bark-800 font-semibold">{monthName}</h2>
              <button
                onClick={() => {
                  if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1) }
                  else setViewMonth(m => m + 1)
                }}
                className="btn-ghost px-3 py-1"
              >→</button>
            </div>

            <div className="grid grid-cols-7 gap-1 mb-1">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                <div key={d} className="text-center text-xs text-bark-400 font-serif py-1">{d}</div>
              ))}
            </div>

            {loading ? (
              <div className="text-center text-bark-400 italic py-8">Loading calendar…</div>
            ) : (
              <div className="grid grid-cols-7 gap-1">
                {blanks.map((_, i) => <div key={`b${i}`} />)}
                {monthDays.map(day => {
                  const ds = dateStr(day)
                  const label = getDayLabel(ds)
                  const cls = getDayClass(ds)
                  const isSelected = ds === logDate

                  return (
                    <button
                      key={ds}
                      onClick={() => setLogDate(ds)}
                      className={`rounded-lg p-1 text-center transition-all ${cls} ${isSelected ? 'ring-2 ring-bark-600 ring-offset-1' : ''}`}
                      title={`${formatDateDisplay(ds)}${label ? ` — ${label}` : ''}`}
                    >
                      <div className="text-sm font-serif">{day.getDate()}</div>
                      {label && <div className="text-[9px] leading-tight opacity-80 mt-0.5">{label}</div>}
                    </button>
                  )
                })}
              </div>
            )}

            <p className="text-xs text-bark-400 italic text-center mt-3">
              Click any day to select it for logging
            </p>
          </div>

          {/* Dose history */}
          <div className="card mt-4">
            <p className="section-title">Dose Log</p>
            {Object.entries(doses).length === 0 ? (
              <p className="text-bark-400 italic text-sm">No doses logged yet.</p>
            ) : (
              <div className="space-y-1.5">
                {Object.entries(doses)
                  .sort(([a], [b]) => b.localeCompare(a))
                  .slice(0, 30)
                  .map(([date, given]) => (
                    <div key={date} className="flex items-center gap-3 text-sm">
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${given ? 'bg-moss-500' : 'bg-amber-500'}`} />
                      <span className="text-bark-700 font-serif">{formatDateDisplay(date)}</span>
                      <span className={`text-xs ${given ? 'text-moss-600' : 'text-amber-600'}`}>
                        {given ? 'Given' : 'Skipped'}
                      </span>
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
