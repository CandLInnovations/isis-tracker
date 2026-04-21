'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { SUPPLEMENT_GROUPS, ALL_SUPPLEMENTS, ON_ORDER_IDS, type Supplement, todayStr, formatDateDisplay } from '@/lib/supplements'
import { PencilIcon } from '@/components/Icons'

type ConfigRow = {
  supplement_id: string
  active: boolean
  name_override: string | null
  dose_override: string | null
  notes: string | null
}

type ConfigMap = Record<string, Omit<ConfigRow, 'supplement_id'>>
type ActiveMap  = Record<string, boolean>

export default function SupplementsPage() {
  const today = todayStr()
  const [takenIds, setTakenIds] = useState<Set<string>>(new Set())
  const [activeMap, setActiveMap]  = useState<ActiveMap>(() => {
    const m: ActiveMap = {}; for (const s of ALL_SUPPLEMENTS) m[s.id] = s.active; return m
  })
  const [configMap, setConfigMap] = useState<ConfigMap>({})
  const [loading, setLoading] = useState(true)

  // Edit modal
  const [editing, setEditing] = useState<Supplement | null>(null)
  const [editName, setEditName] = useState('')
  const [editDose, setEditDose] = useState('')
  const [editNotes, setEditNotes] = useState('')
  const [editSaving, setEditSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const [suppLog, config] = await Promise.all([
      supabase.from('supplement_logs').select('taken_ids').eq('log_date', today).limit(1),
      supabase.from('supplement_config').select('supplement_id, active, name_override, dose_override, notes'),
    ])
    if (suppLog.data?.[0]?.taken_ids) setTakenIds(new Set(suppLog.data[0].taken_ids))
    if (config.data?.length) {
      const am: ActiveMap  = {}; for (const s of ALL_SUPPLEMENTS) am[s.id] = s.active
      const cm: ConfigMap  = {}
      for (const row of config.data) {
        am[row.supplement_id] = row.active
        cm[row.supplement_id] = { active: row.active, name_override: row.name_override ?? null, dose_override: row.dose_override ?? null, notes: row.notes ?? null }
      }
      setActiveMap(am); setConfigMap(cm)
    }
    setLoading(false)
  }, [today])

  useEffect(() => { load() }, [load])

  async function toggleTaken(id: string) {
    const next = new Set(takenIds)
    if (next.has(id)) next.delete(id); else next.add(id)
    setTakenIds(next)
    await supabase.from('supplement_logs').upsert({ log_date: today, taken_ids: Array.from(next), updated_at: new Date().toISOString() }, { onConflict: 'log_date' })
  }

  async function toggleActive(id: string) {
    const next = !activeMap[id]
    setActiveMap(prev => ({ ...prev, [id]: next }))
    const existing = configMap[id]
    await supabase.from('supplement_config').upsert({
      supplement_id: id, active: next,
      name_override: existing?.name_override ?? null,
      dose_override: existing?.dose_override ?? null,
      notes: existing?.notes ?? null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'supplement_id' })
  }

  async function markGroupAll(ids: string[], done: boolean) {
    const next = new Set(takenIds)
    if (done) ids.forEach(id => next.add(id)); else ids.forEach(id => next.delete(id))
    setTakenIds(next)
    await supabase.from('supplement_logs').upsert({ log_date: today, taken_ids: Array.from(next), updated_at: new Date().toISOString() }, { onConflict: 'log_date' })
  }

  function openEdit(supp: Supplement) {
    const cfg = configMap[supp.id]
    setEditing(supp)
    setEditName(cfg?.name_override ?? supp.name)
    setEditDose(cfg?.dose_override ?? supp.dose)
    setEditNotes(cfg?.notes ?? '')
  }

  async function saveEdit() {
    if (!editing) return
    setEditSaving(true)
    const existing = configMap[editing.id]
    await supabase.from('supplement_config').upsert({
      supplement_id: editing.id,
      active: activeMap[editing.id] ?? editing.active,
      name_override: editName !== editing.name ? editName : null,
      dose_override: editDose !== editing.dose ? editDose : null,
      notes: editNotes || null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'supplement_id' })
    setConfigMap(prev => ({
      ...prev,
      [editing.id]: {
        active: activeMap[editing.id] ?? editing.active,
        name_override: editName !== editing.name ? editName : null,
        dose_override: editDose !== editing.dose ? editDose : null,
        notes: editNotes || null,
      }
    }))
    setEditing(null)
    setEditSaving(false)
  }

  function displayName(s: Supplement): string { return configMap[s.id]?.name_override ?? s.name }
  function displayDose(s: Supplement): string { return configMap[s.id]?.dose_override ?? s.dose }
  function displayNotes(s: Supplement): string | null { return configMap[s.id]?.notes ?? null }

  const activeSupps = ALL_SUPPLEMENTS.filter(s => activeMap[s.id] && !ON_ORDER_IDS.includes(s.id))
  const takenCount  = activeSupps.filter(s => takenIds.has(s.id)).length
  const pct = activeSupps.length > 0 ? Math.round((takenCount / activeSupps.length) * 100) : 0

  if (loading) return <div className="text-bark-400 italic font-serif py-12 text-center">Loading supplements…</div>

  return (
    <div>
      <h1 className="page-title">Daily Supplements</h1>
      <p className="page-subtitle">{formatDateDisplay(today)}</p>

      {/* Progress */}
      <div className="card mb-6">
        <div className="flex items-end justify-between mb-2">
          <div>
            <p className="text-xs text-bark-500 uppercase tracking-wide">Today&apos;s Progress</p>
            <p className="text-2xl font-serif font-bold text-bark-800">
              {takenCount} <span className="text-base font-normal text-bark-400">/ {activeSupps.length} active</span>
            </p>
          </div>
          <p className={`text-lg font-serif font-bold ${pct === 100 ? 'text-moss-600' : 'text-bark-500'}`}>{pct}%</p>
        </div>
        <div className="bg-bark-100 rounded-full h-3 overflow-hidden">
          <div className={`h-full rounded-full transition-all duration-500 ${pct === 100 ? 'bg-moss-500' : 'bg-bark-400'}`} style={{ width: `${pct}%` }} />
        </div>
        {pct === 100 && <p className="text-moss-600 text-xs font-serif mt-2 font-semibold">✓ All active supplements given for today!</p>}
      </div>

      <div className="mb-6 bg-amber-100 border border-amber-400 rounded-xl p-3 flex items-start gap-2">
        <span className="text-amber-700">📦</span>
        <p className="text-amber-700 text-xs font-serif">
          <strong>On Order:</strong> Vitamin E Succinate · Turkey Tail · Quercetin — toggle to activate when they arrive.
        </p>
      </div>

      {/* Supplement groups */}
      {SUPPLEMENT_GROUPS.map(group => {
        const groupActive = group.supplements.filter(s => activeMap[s.id] && !ON_ORDER_IDS.includes(s.id))
        const allTaken = groupActive.length > 0 && groupActive.every(s => takenIds.has(s.id))
        return (
          <div key={group.key} className="card mb-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="section-title mb-0">{group.label}</h2>
              {groupActive.length > 0 && (
                <button onClick={() => markGroupAll(groupActive.map(s => s.id), !allTaken)}
                  className={`text-xs font-serif px-2 py-1 rounded-md border transition-colors ${allTaken ? 'border-bark-300 text-bark-500 hover:bg-bark-50' : 'border-moss-500 text-moss-600 hover:bg-moss-50'}`}>
                  {allTaken ? 'Unmark All' : 'Mark All Done'}
                </button>
              )}
            </div>
            <div className="space-y-2">
              {group.supplements.map((supp: Supplement) => {
                const isActive  = activeMap[supp.id]
                const isOnOrder = ON_ORDER_IDS.includes(supp.id)
                const isTaken   = takenIds.has(supp.id)
                const name      = displayName(supp)
                const dose      = displayDose(supp)
                const suppNotes = displayNotes(supp)
                return (
                  <div key={supp.id} className={`flex items-center gap-3 p-2 rounded-lg transition-colors ${isActive && !isOnOrder ? 'hover:bg-bark-50' : 'opacity-50'}`}>
                    {/* Checkbox */}
                    {isActive && !isOnOrder ? (
                      <button onClick={() => toggleTaken(supp.id)}
                        className={`w-5 h-5 flex-shrink-0 rounded border-2 flex items-center justify-center transition-all ${isTaken ? 'bg-moss-500 border-moss-500' : 'border-bark-300 hover:border-moss-400'}`}>
                        {isTaken && <span className="text-white text-xs">✓</span>}
                      </button>
                    ) : (
                      <div className="w-5 h-5 flex-shrink-0 rounded border-2 border-bark-200 bg-bark-50" />
                    )}
                    {/* Name + dose */}
                    <div className="flex-1 min-w-0">
                      <span className={`font-serif text-sm ${isTaken ? 'line-through text-bark-400' : 'text-bark-800'}`}>{name}</span>
                      <span className="text-bark-400 text-xs ml-1.5">{dose}</span>
                      {suppNotes && <span className="text-bark-400 text-xs ml-1.5 italic">— {suppNotes}</span>}
                      {isOnOrder && <span className="ml-1.5 text-amber-600 text-xs font-semibold">on order</span>}
                    </div>
                    {/* Edit button */}
                    <button onClick={() => openEdit(supp)} className="p-1.5 rounded text-bark-300 hover:text-bark-600 hover:bg-bark-100 transition-colors flex-shrink-0" title={`Edit ${name}`}>
                      <PencilIcon />
                    </button>
                    {/* Active toggle */}
                    <button onClick={() => toggleActive(supp.id)} title={isActive ? 'Deactivate' : 'Activate'}
                      className={`relative w-9 h-5 rounded-full flex-shrink-0 transition-all duration-200 ${isActive ? 'bg-moss-500' : 'bg-bark-200'}`}>
                      <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all duration-200 ${isActive ? 'left-[18px]' : 'left-0.5'}`} />
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}

      <p className="text-xs text-bark-400 italic text-center mt-4">Fenbendazole 400mg is tracked separately on the Fenben page.</p>

      {/* Edit modal */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setEditing(null)}>
          <div className="absolute inset-0 bg-bark-900/40 backdrop-blur-sm" />
          <div className="relative bg-cream border border-bark-200 rounded-2xl shadow-xl p-6 w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <h3 className="font-serif font-semibold text-bark-800 text-base mb-4">Edit Supplement</h3>
            <div className="space-y-3">
              <div>
                <label className="label">Name</label>
                <input className="input" value={editName} onChange={e => setEditName(e.target.value)} />
              </div>
              <div>
                <label className="label">Dose</label>
                <input className="input" value={editDose} onChange={e => setEditDose(e.target.value)} />
              </div>
              <div>
                <label className="label">Notes (shown next to dose)</label>
                <input className="input" placeholder="e.g. give with food" value={editNotes} onChange={e => setEditNotes(e.target.value)} />
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={saveEdit} disabled={editSaving} className="btn-secondary flex-1">
                {editSaving ? 'Saving…' : 'Save'}
              </button>
              <button onClick={() => setEditing(null)} className="btn-ghost flex-1">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
