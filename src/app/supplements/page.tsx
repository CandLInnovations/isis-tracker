'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import {
  SUPPLEMENT_GROUPS, ALL_SUPPLEMENTS, ON_ORDER_IDS,
  type Supplement, todayStr, formatDateDisplay,
} from '@/lib/supplements'

type ActiveMap = Record<string, boolean>   // supplement_id -> active
type TakenSet  = Set<string>               // supplement_ids taken today

export default function SupplementsPage() {
  const today = todayStr()
  const [takenIds, setTakenIds] = useState<TakenSet>(new Set())
  const [activeMap, setActiveMap] = useState<ActiveMap>(() => {
    const m: ActiveMap = {}
    for (const s of ALL_SUPPLEMENTS) m[s.id] = s.active
    return m
  })
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const [suppLog, config] = await Promise.all([
      supabase.from('supplement_logs').select('taken_ids').eq('log_date', today).maybeSingle(),
      supabase.from('supplement_config').select('supplement_id, active'),
    ])

    if (suppLog.data?.taken_ids) setTakenIds(new Set(suppLog.data.taken_ids))

    if (config.data && config.data.length > 0) {
      const m: ActiveMap = {}
      for (const s of ALL_SUPPLEMENTS) m[s.id] = s.active // start from defaults
      for (const row of config.data) m[row.supplement_id] = row.active
      setActiveMap(m)
    }
    setLoading(false)
  }, [today])

  useEffect(() => { load() }, [load])

  async function toggleTaken(id: string) {
    const next = new Set(takenIds)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setTakenIds(next)
    const arr = Array.from(next)
    await supabase.from('supplement_logs').upsert(
      { log_date: today, taken_ids: arr, updated_at: new Date().toISOString() },
      { onConflict: 'log_date' }
    )
  }

  async function toggleActive(id: string) {
    const next = !activeMap[id]
    setActiveMap(prev => ({ ...prev, [id]: next }))
    await supabase.from('supplement_config').upsert(
      { supplement_id: id, active: next, updated_at: new Date().toISOString() },
      { onConflict: 'supplement_id' }
    )
  }

  async function markGroupAll(ids: string[], done: boolean) {
    const next = new Set(takenIds)
    if (done) ids.forEach(id => next.add(id))
    else ids.forEach(id => next.delete(id))
    setTakenIds(next)
    await supabase.from('supplement_logs').upsert(
      { log_date: today, taken_ids: Array.from(next), updated_at: new Date().toISOString() },
      { onConflict: 'log_date' }
    )
  }

  const activeSupps = ALL_SUPPLEMENTS.filter(s => activeMap[s.id] && !ON_ORDER_IDS.includes(s.id))
  const totalActive = activeSupps.length
  const takenCount  = activeSupps.filter(s => takenIds.has(s.id)).length
  const pct = totalActive > 0 ? Math.round((takenCount / totalActive) * 100) : 0

  if (loading) {
    return <div className="text-bark-400 italic font-serif py-12 text-center">Loading supplements…</div>
  }

  return (
    <div>
      <h1 className="page-title">Daily Supplements</h1>
      <p className="page-subtitle">{formatDateDisplay(today)}</p>

      {/* Progress bar */}
      <div className="card mb-6">
        <div className="flex items-end justify-between mb-2">
          <div>
            <p className="text-xs text-bark-500 uppercase tracking-wide">Today&apos;s Progress</p>
            <p className="text-2xl font-serif font-bold text-bark-800">
              {takenCount} <span className="text-base font-normal text-bark-400">/ {totalActive} active</span>
            </p>
          </div>
          <p className={`text-lg font-serif font-bold ${pct === 100 ? 'text-moss-600' : 'text-bark-500'}`}>
            {pct}%
          </p>
        </div>
        <div className="bg-bark-100 rounded-full h-3 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${pct === 100 ? 'bg-moss-500' : 'bg-bark-400'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        {pct === 100 && (
          <p className="text-moss-600 text-xs font-serif mt-2 font-semibold">✓ All active supplements given for today!</p>
        )}
      </div>

      {/* 3 Supplements on order alert */}
      <div className="mb-6 bg-amber-100 border border-amber-400 rounded-xl p-3 flex items-start gap-2">
        <span className="text-amber-700">📦</span>
        <p className="text-amber-700 text-xs font-serif">
          <strong>On Order:</strong> Vitamin E Succinate · Turkey Tail · Quercetin —
          toggle the switch below to activate when they arrive.
        </p>
      </div>

      {/* Supplement groups */}
      {SUPPLEMENT_GROUPS.map(group => {
        const groupSupps = group.supplements
        const activeInGroup = groupSupps.filter(s => activeMap[s.id])
        const activeNonOrder = activeInGroup.filter(s => !ON_ORDER_IDS.includes(s.id))
        const allTaken = activeNonOrder.length > 0 && activeNonOrder.every(s => takenIds.has(s.id))
        const groupIds = activeNonOrder.map(s => s.id)

        return (
          <div key={group.key} className="card mb-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="section-title mb-0">{group.label}</h2>
              {groupIds.length > 0 && (
                <button
                  onClick={() => markGroupAll(groupIds, !allTaken)}
                  className={`text-xs font-serif px-2 py-1 rounded-md border transition-colors ${allTaken ? 'border-bark-300 text-bark-500 hover:bg-bark-50' : 'border-moss-500 text-moss-600 hover:bg-moss-50'}`}
                >
                  {allTaken ? 'Unmark All' : 'Mark All Done'}
                </button>
              )}
            </div>

            <div className="space-y-2">
              {groupSupps.map((supp: Supplement) => {
                const isActive = activeMap[supp.id]
                const isOnOrder = ON_ORDER_IDS.includes(supp.id)
                const isTaken = takenIds.has(supp.id)

                return (
                  <div
                    key={supp.id}
                    className={`flex items-center gap-3 p-2 rounded-lg transition-colors ${isActive && !isOnOrder ? 'hover:bg-bark-50' : 'opacity-50'}`}
                  >
                    {/* Taken checkbox (only for active, non-on-order) */}
                    {isActive && !isOnOrder ? (
                      <button
                        onClick={() => toggleTaken(supp.id)}
                        className={`w-5 h-5 flex-shrink-0 rounded border-2 flex items-center justify-center transition-all ${
                          isTaken
                            ? 'bg-moss-500 border-moss-500'
                            : 'border-bark-300 hover:border-moss-400'
                        }`}
                        aria-label={`Toggle ${supp.name}`}
                      >
                        {isTaken && <span className="text-white text-xs">✓</span>}
                      </button>
                    ) : (
                      <div className="w-5 h-5 flex-shrink-0 rounded border-2 border-bark-200 bg-bark-50" />
                    )}

                    {/* Name + dose */}
                    <div className="flex-1 min-w-0">
                      <span className={`font-serif text-sm ${isTaken ? 'line-through text-bark-400' : 'text-bark-800'}`}>
                        {supp.name}
                      </span>
                      <span className="text-bark-400 text-xs ml-1.5">{supp.dose}</span>
                      {supp.note && (
                        <span className="text-bark-400 text-xs ml-1.5 italic">{supp.note}</span>
                      )}
                      {isOnOrder && (
                        <span className="ml-1.5 text-amber-600 text-xs font-semibold">on order</span>
                      )}
                    </div>

                    {/* Active toggle */}
                    <button
                      onClick={() => toggleActive(supp.id)}
                      title={isActive ? 'Deactivate' : 'Activate'}
                      className={`relative w-9 h-5 rounded-full flex-shrink-0 transition-all duration-200 ${isActive ? 'bg-moss-500' : 'bg-bark-200'}`}
                      aria-label={`${isActive ? 'Deactivate' : 'Activate'} ${supp.name}`}
                    >
                      <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all duration-200 ${isActive ? 'left-[18px]' : 'left-0.5'}`} />
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}

      <p className="text-xs text-bark-400 italic text-center mt-4">
        Fenbendazole 400mg is tracked separately on the Fenben page.
      </p>
    </div>
  )
}
