'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import {
  todayStr, formatDateDisplay,
  type GroupRow, type SuppRow, type SupplementStatus,
  suppDisplayName, suppDisplayDose, STATUS_CONFIG,
} from '@/lib/supplements'
import { PencilIcon, TrashIcon } from '@/components/Icons'

export default function SupplementsPage() {
  const today = todayStr()
  const [groups, setGroups] = useState<GroupRow[]>([])
  const [supps, setSupps] = useState<SuppRow[]>([])
  const [takenIds, setTakenIds] = useState<Set<string>>(new Set())
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [tab, setTab] = useState<'checklist' | 'manage'>('checklist')
  const [loading, setLoading] = useState(true)

  const [editing, setEditing] = useState<SuppRow | null>(null)
  const [editName, setEditName] = useState('')
  const [editDose, setEditDose] = useState('')
  const [editNotes, setEditNotes] = useState('')
  const [editSaving, setEditSaving] = useState(false)

  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const [groupsRes, suppsRes, logRes] = await Promise.all([
      supabase.from('supplement_groups').select('*').order('display_order'),
      supabase.from('supplement_config').select('*').not('group_id', 'is', null).order('display_order'),
      supabase.from('supplement_logs').select('taken_ids').eq('log_date', today).limit(1),
    ])
    setGroups(groupsRes.data ?? [])
    setSupps(suppsRes.data ?? [])
    setTakenIds(new Set(logRes.data?.[0]?.taken_ids ?? []))
    setLoading(false)
  }, [today])

  useEffect(() => { load() }, [load])

  async function toggleTaken(id: string) {
    const next = new Set(takenIds)
    if (next.has(id)) next.delete(id); else next.add(id)
    setTakenIds(next)
    await supabase.from('supplement_logs').upsert(
      { log_date: today, taken_ids: Array.from(next), updated_at: new Date().toISOString() },
      { onConflict: 'log_date' }
    )
  }

  async function markGroupAll(ids: string[], done: boolean) {
    const next = new Set(takenIds)
    if (done) ids.forEach(id => next.add(id)); else ids.forEach(id => next.delete(id))
    setTakenIds(next)
    await supabase.from('supplement_logs').upsert(
      { log_date: today, taken_ids: Array.from(next), updated_at: new Date().toISOString() },
      { onConflict: 'log_date' }
    )
  }

  async function changeStatus(supplementId: string, status: SupplementStatus) {
    setSupps(prev => prev.map(s => s.supplement_id === supplementId ? { ...s, status } : s))
    await supabase.from('supplement_config').update({ status, updated_at: new Date().toISOString() }).eq('supplement_id', supplementId)
  }

  async function moveGroup(groupId: string, dir: 'up' | 'down') {
    const idx = groups.findIndex(g => g.id === groupId)
    const otherIdx = dir === 'up' ? idx - 1 : idx + 1
    if (otherIdx < 0 || otherIdx >= groups.length) return
    const a = groups[idx], b = groups[otherIdx]
    await Promise.all([
      supabase.from('supplement_groups').update({ display_order: b.display_order }).eq('id', a.id),
      supabase.from('supplement_groups').update({ display_order: a.display_order }).eq('id', b.id),
    ])
    setGroups(prev => {
      const next = [...prev]
      next[idx] = { ...a, display_order: b.display_order }
      next[otherIdx] = { ...b, display_order: a.display_order }
      return next.sort((x, y) => x.display_order - y.display_order)
    })
  }

  async function saveGroupRename(id: string) {
    if (!renameValue.trim()) return
    await supabase.from('supplement_groups').update({ name: renameValue.trim() }).eq('id', id)
    setGroups(prev => prev.map(g => g.id === id ? { ...g, name: renameValue.trim() } : g))
    setRenamingId(null)
  }

  async function addGroup() {
    const maxOrder = groups.reduce((m, g) => Math.max(m, g.display_order), 0)
    const { data } = await supabase.from('supplement_groups')
      .insert({ name: 'New Group', display_order: maxOrder + 1 })
      .select().limit(1)
    if (data?.[0]) setGroups(prev => [...prev, data[0]])
  }

  async function deleteGroup(id: string) {
    if (!confirm('Delete this group?')) return
    await supabase.from('supplement_groups').delete().eq('id', id)
    setGroups(prev => prev.filter(g => g.id !== id))
  }

  function openEdit(s: SuppRow) {
    setEditing(s)
    setEditName(suppDisplayName(s))
    setEditDose(suppDisplayDose(s))
    setEditNotes(s.notes ?? '')
  }

  async function saveEdit() {
    if (!editing) return
    setEditSaving(true)
    const canonName = editing.name ?? editing.supplement_id
    const canonDose = editing.dose ?? ''
    await supabase.from('supplement_config').update({
      name_override: editName !== canonName ? editName : null,
      dose_override: editDose !== canonDose ? editDose : null,
      notes: editNotes || null,
      updated_at: new Date().toISOString(),
    }).eq('supplement_id', editing.supplement_id)
    setSupps(prev => prev.map(s => s.supplement_id === editing.supplement_id ? {
      ...s,
      name_override: editName !== canonName ? editName : null,
      dose_override: editDose !== canonDose ? editDose : null,
      notes: editNotes || null,
    } : s))
    setEditing(null)
    setEditSaving(false)
  }

  function groupSupps(groupId: string): SuppRow[] {
    return supps.filter(s => s.group_id === groupId).sort((a, b) => a.display_order - b.display_order)
  }

  const activeSupps = supps.filter(s => s.status === 'active')
  const takenCount = activeSupps.filter(s => takenIds.has(s.supplement_id)).length
  const totalActive = activeSupps.length
  const pct = totalActive > 0 ? Math.round((takenCount / totalActive) * 100) : 0
  const onOrderCount = supps.filter(s => s.status === 'on_order').length
  const needOrderCount = supps.filter(s => s.status === 'need_to_order').length

  if (loading) return (
    <div className="text-bark-400 italic font-serif py-12 text-center">Loading supplements…</div>
  )

  return (
    <div>
      <h1 className="page-title">Daily Supplements</h1>
      <p className="page-subtitle">{formatDateDisplay(today)}</p>

      {/* Tabs */}
      <div className="flex gap-0 mb-5 border-b border-bark-200">
        {(['checklist', 'manage'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-5 py-2.5 text-sm font-serif capitalize transition-colors ${tab === t
              ? 'border-b-2 border-bark-700 text-bark-800 font-semibold -mb-px'
              : 'text-bark-500 hover:text-bark-700'}`}>
            {t === 'checklist' ? 'Checklist' : 'Manage'}
          </button>
        ))}
      </div>

      {/* ── CHECKLIST TAB ── */}
      {tab === 'checklist' && (
        <>
          {/* Overall progress */}
          <div className="card mb-4">
            <div className="flex items-end justify-between mb-2">
              <div>
                <p className="text-xs text-bark-500 uppercase tracking-wide">Today&apos;s Progress</p>
                <p className="text-2xl font-serif font-bold text-bark-800">
                  {takenCount} <span className="text-base font-normal text-bark-400">/ {totalActive} active</span>
                </p>
              </div>
              <p className={`text-lg font-serif font-bold ${pct === 100 ? 'text-moss-600' : 'text-bark-500'}`}>{pct}%</p>
            </div>
            <div className="bg-bark-100 rounded-full h-3 overflow-hidden">
              <div className={`h-full rounded-full transition-all duration-500 ${pct === 100 ? 'bg-moss-500' : 'bg-bark-400'}`}
                style={{ width: `${pct}%` }} />
            </div>
            {pct === 100 && <p className="text-moss-600 text-xs font-serif mt-2 font-semibold">✓ All active supplements given for today!</p>}
          </div>

          {/* Inventory alerts */}
          {(onOrderCount > 0 || needOrderCount > 0) && (
            <div className="mb-4 space-y-2">
              {onOrderCount > 0 && (
                <div className="bg-amber-50 border border-amber-300 rounded-xl p-3 flex items-center gap-2">
                  <span className="text-amber-600">📦</span>
                  <p className="text-amber-700 text-xs font-serif">
                    <strong>{onOrderCount} supplement{onOrderCount !== 1 ? 's' : ''} on order</strong> — will appear on checklist when activated in Manage tab
                  </p>
                </div>
              )}
              {needOrderCount > 0 && (
                <div className="bg-rose-50 border border-rose-300 rounded-xl p-3 flex items-center gap-2">
                  <span className="text-rose-600">🛒</span>
                  <p className="text-rose-700 text-xs font-serif">
                    <strong>{needOrderCount} supplement{needOrderCount !== 1 ? 's' : ''} need{needOrderCount === 1 ? 's' : ''} ordering</strong> — see Inventory page
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Per-group checklist */}
          {groups.map(group => {
            const gActive = groupSupps(group.id).filter(s => s.status === 'active')
            const gPending = groupSupps(group.id).filter(s => s.status === 'on_order' || s.status === 'need_to_order')
            if (gActive.length === 0 && gPending.length === 0) return null
            const isCollapsed = collapsed.has(group.id)
            const gTaken = gActive.filter(s => takenIds.has(s.supplement_id)).length
            const allTaken = gActive.length > 0 && gTaken === gActive.length

            return (
              <div key={group.id} className="card mb-3">
                {/* Group header */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCollapsed(prev => { const n = new Set(prev); n.has(group.id) ? n.delete(group.id) : n.add(group.id); return n })}
                    className="flex-1 flex items-center gap-2 text-left min-w-0">
                    <span className="font-serif font-semibold text-bark-800 text-sm truncate">{group.name}</span>
                    <span className="text-xs text-bark-400 font-serif flex-shrink-0">{gTaken}/{gActive.length}</span>
                    <span className="text-bark-400 text-xs ml-auto flex-shrink-0">{isCollapsed ? '▶' : '▼'}</span>
                  </button>
                  {!isCollapsed && gActive.length > 0 && (
                    <button onClick={() => markGroupAll(gActive.map(s => s.supplement_id), !allTaken)}
                      className={`text-xs font-serif px-2 py-1 rounded border flex-shrink-0 transition-colors ${allTaken ? 'border-bark-300 text-bark-500 hover:bg-bark-50' : 'border-moss-500 text-moss-600 hover:bg-moss-50'}`}>
                      {allTaken ? 'Unmark All' : 'Mark All Done'}
                    </button>
                  )}
                </div>

                {/* Group progress bar */}
                {!isCollapsed && gActive.length > 0 && (
                  <div className="mt-2 mb-3 bg-bark-100 rounded-full h-1.5 overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${gTaken === gActive.length ? 'bg-moss-500' : 'bg-bark-300'}`}
                      style={{ width: `${Math.round((gTaken / gActive.length) * 100)}%` }} />
                  </div>
                )}

                {!isCollapsed && (
                  <div className="space-y-1 mt-2">
                    {/* Active supplements */}
                    {gActive.map(s => {
                      const taken = takenIds.has(s.supplement_id)
                      return (
                        <div key={s.supplement_id}
                          className="flex items-center gap-3 px-2 py-1.5 rounded-lg hover:bg-bark-50 transition-colors cursor-pointer"
                          onClick={() => toggleTaken(s.supplement_id)}>
                          <div className={`w-5 h-5 flex-shrink-0 rounded border-2 flex items-center justify-center transition-all ${taken ? 'bg-moss-500 border-moss-500' : 'border-bark-300 hover:border-moss-400'}`}>
                            {taken && <span className="text-white text-xs leading-none">✓</span>}
                          </div>
                          <div className="flex-1 min-w-0">
                            <span className={`font-serif text-sm ${taken ? 'line-through text-bark-400' : 'text-bark-800'}`}>
                              {suppDisplayName(s)}
                            </span>
                            <span className="text-bark-400 text-xs ml-1.5">{suppDisplayDose(s)}</span>
                            {s.notes && (
                              <span className="text-bark-400 text-xs ml-1.5 italic">— {s.notes}</span>
                            )}
                          </div>
                        </div>
                      )
                    })}

                    {/* Non-active items shown as reference */}
                    {gPending.length > 0 && gActive.length > 0 && (
                      <div className="border-t border-bark-100 mt-2 pt-2" />
                    )}
                    {gPending.map(s => (
                      <div key={s.supplement_id} className="flex items-center gap-3 px-2 py-1 rounded-lg opacity-55">
                        <div className="w-5 h-5 flex-shrink-0 rounded border-2 border-bark-200 bg-bark-50" />
                        <div className="flex-1 min-w-0">
                          <span className="font-serif text-sm text-bark-500 italic">{suppDisplayName(s)}</span>
                          <span className="text-bark-400 text-xs ml-1.5">{suppDisplayDose(s)}</span>
                        </div>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-serif whitespace-nowrap flex-shrink-0 ${STATUS_CONFIG[s.status]?.cls}`}>
                          {STATUS_CONFIG[s.status]?.label}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </>
      )}

      {/* ── MANAGE TAB ── */}
      {tab === 'manage' && (
        <div className="space-y-4">
          {groups.map((group, gIdx) => {
            const gSupps = groupSupps(group.id)
            const isRenaming = renamingId === group.id
            return (
              <div key={group.id} className="card">
                {/* Group header */}
                <div className="flex items-center gap-2 mb-3">
                  {isRenaming ? (
                    <input
                      className="input flex-1 text-sm py-1"
                      value={renameValue}
                      onChange={e => setRenameValue(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') saveGroupRename(group.id); if (e.key === 'Escape') setRenamingId(null) }}
                      autoFocus
                    />
                  ) : (
                    <h2 className="font-serif font-semibold text-bark-800 flex-1 text-sm">{group.name}</h2>
                  )}
                  <div className="flex items-center gap-1 flex-shrink-0 text-sm">
                    {isRenaming ? (
                      <>
                        <button onClick={() => saveGroupRename(group.id)} className="px-2 py-1 bg-moss-500 text-white rounded text-xs font-serif">Save</button>
                        <button onClick={() => setRenamingId(null)} className="px-2 py-1 border border-bark-300 text-bark-600 rounded text-xs font-serif">Cancel</button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => { setRenamingId(group.id); setRenameValue(group.name) }}
                          className="p-1.5 rounded text-bark-400 hover:text-bark-700 hover:bg-bark-100 transition-colors" title="Rename">
                          <PencilIcon />
                        </button>
                        <button onClick={() => moveGroup(group.id, 'up')} disabled={gIdx === 0}
                          className="p-1.5 rounded text-bark-400 hover:text-bark-700 hover:bg-bark-100 disabled:opacity-25 transition-colors" title="Move up">↑</button>
                        <button onClick={() => moveGroup(group.id, 'down')} disabled={gIdx === groups.length - 1}
                          className="p-1.5 rounded text-bark-400 hover:text-bark-700 hover:bg-bark-100 disabled:opacity-25 transition-colors" title="Move down">↓</button>
                        {gSupps.length === 0 && (
                          <button onClick={() => deleteGroup(group.id)}
                            className="p-1.5 rounded text-bark-300 hover:text-rose-600 hover:bg-rose-50 transition-colors" title="Delete empty group">
                            <TrashIcon />
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {/* Supplement rows */}
                <div className="space-y-1.5">
                  {gSupps.length === 0 && (
                    <p className="text-xs text-bark-400 italic px-1">No supplements in this group yet.</p>
                  )}
                  {gSupps.map(s => (
                    <div key={s.supplement_id}
                      className={`flex items-center gap-2 px-2 py-2 rounded-lg border ${s.status === 'sidelined' ? 'border-bark-100 bg-bark-50/50' : 'border-bark-100'}`}>
                      <div className="flex-1 min-w-0">
                        <p className={`font-serif text-sm leading-snug ${s.status === 'sidelined' ? 'italic text-bark-400' : 'text-bark-800'}`}>
                          {suppDisplayName(s)}
                        </p>
                        <p className="text-bark-400 text-xs">
                          {suppDisplayDose(s)}{s.notes ? ` — ${s.notes}` : ''}
                        </p>
                      </div>
                      <select
                        value={s.status}
                        onChange={e => changeStatus(s.supplement_id, e.target.value as SupplementStatus)}
                        className="text-xs border border-bark-200 rounded px-1.5 py-1 bg-cream text-bark-700 font-serif flex-shrink-0 focus:outline-none focus:ring-1 focus:ring-bark-400">
                        <option value="active">active</option>
                        <option value="on_order">on order</option>
                        <option value="need_to_order">needs order</option>
                        <option value="sidelined">sidelined</option>
                      </select>
                      <button onClick={() => openEdit(s)}
                        className="p-1.5 rounded text-bark-400 hover:text-bark-700 hover:bg-bark-100 flex-shrink-0 transition-colors">
                        <PencilIcon />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}

          <button onClick={addGroup}
            className="w-full border-2 border-dashed border-bark-200 rounded-xl py-3 text-bark-500 hover:text-bark-700 hover:border-bark-400 transition-colors text-sm font-serif">
            + Add Group
          </button>
        </div>
      )}

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
                <input className="input" placeholder="e.g. give with fat" value={editNotes} onChange={e => setEditNotes(e.target.value)} />
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
