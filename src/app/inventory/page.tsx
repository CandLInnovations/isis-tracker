'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { type SuppRow, type SupplementStatus, suppDisplayName, suppDisplayDose } from '@/lib/supplements'

type Tab = 'watchlist' | 'reorder' | 'sidelined'

function DaysRemainingBadge({ days }: { days: number | null }) {
  if (days == null) return <span className="text-bark-400 text-xs italic">not set</span>
  if (days <= 10)  return <span className="text-xs px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 border border-rose-200 font-serif font-semibold">{days}d left</span>
  if (days <= 30)  return <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200 font-serif">{days}d left</span>
  return <span className="text-xs px-2 py-0.5 rounded-full bg-moss-100 text-moss-700 border border-moss-200 font-serif">{days}d left</span>
}

export default function InventoryPage() {
  const [tab, setTab] = useState<Tab>('watchlist')
  const [supps, setSupps] = useState<SuppRow[]>([])
  const [loading, setLoading] = useState(true)
  const [editingDays, setEditingDays] = useState<Record<string, string>>({})
  const [savingId, setSavingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('supplement_config')
      .select('*')
      .not('group_id', 'is', null)
      .order('display_order')
    setSupps(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function saveDaysRemaining(id: string, val: string) {
    const days = val ? parseInt(val) : null
    setSavingId(id)
    await supabase.from('supplement_config').update({ estimated_days_remaining: days, updated_at: new Date().toISOString() }).eq('supplement_id', id)
    setSupps(prev => prev.map(s => s.supplement_id === id ? { ...s, estimated_days_remaining: days } : s))
    setEditingDays(prev => { const n = { ...prev }; delete n[id]; return n })
    setSavingId(null)
  }

  async function saveSource(id: string, source: string) {
    await supabase.from('supplement_config').update({ preferred_source: source || null, updated_at: new Date().toISOString() }).eq('supplement_id', id)
    setSupps(prev => prev.map(s => s.supplement_id === id ? { ...s, preferred_source: source || null } : s))
  }

  async function saveReorderNotes(id: string, notes: string) {
    await supabase.from('supplement_config').update({ reorder_notes: notes || null, updated_at: new Date().toISOString() }).eq('supplement_id', id)
    setSupps(prev => prev.map(s => s.supplement_id === id ? { ...s, reorder_notes: notes || null } : s))
  }

  async function markOrdered(id: string) {
    await supabase.from('supplement_config').update({ status: 'on_order' as SupplementStatus, updated_at: new Date().toISOString() }).eq('supplement_id', id)
    setSupps(prev => prev.map(s => s.supplement_id === id ? { ...s, status: 'on_order' as SupplementStatus } : s))
  }

  async function markReceived(id: string) {
    await supabase.from('supplement_config').update({ status: 'active' as SupplementStatus, updated_at: new Date().toISOString() }).eq('supplement_id', id)
    setSupps(prev => prev.map(s => s.supplement_id === id ? { ...s, status: 'active' as SupplementStatus } : s))
  }

  async function markActive(id: string) {
    await supabase.from('supplement_config').update({ status: 'active' as SupplementStatus, updated_at: new Date().toISOString() }).eq('supplement_id', id)
    setSupps(prev => prev.map(s => s.supplement_id === id ? { ...s, status: 'active' as SupplementStatus } : s))
  }

  const active   = supps.filter(s => s.status === 'active')
  const onOrder  = supps.filter(s => s.status === 'on_order')
  const needOrder = supps.filter(s => s.status === 'need_to_order')
  const sidelined = supps.filter(s => s.status === 'sidelined')

  const lowStock = active.filter(s => s.estimated_days_remaining != null && s.estimated_days_remaining <= 10)
  const midStock = active.filter(s => s.estimated_days_remaining != null && s.estimated_days_remaining > 10 && s.estimated_days_remaining <= 30)

  if (loading) return <div className="text-bark-400 italic font-serif py-12 text-center">Loading inventory…</div>

  return (
    <div>
      <h1 className="page-title">Inventory</h1>
      <p className="page-subtitle">Stock levels, reorder queue, and sidelined supplements</p>

      {/* Alert summary */}
      {(lowStock.length > 0 || needOrder.length > 0 || onOrder.length > 0) && (
        <div className="card mb-5 space-y-2">
          {lowStock.length > 0 && (
            <div className="flex items-center gap-2 text-rose-700">
              <span className="text-sm">🔴</span>
              <p className="text-sm font-serif"><strong>{lowStock.length} supplement{lowStock.length !== 1 ? 's' : ''} running low</strong> (≤10 days remaining)</p>
            </div>
          )}
          {midStock.length > 0 && (
            <div className="flex items-center gap-2 text-amber-700">
              <span className="text-sm">🟡</span>
              <p className="text-sm font-serif"><strong>{midStock.length} supplement{midStock.length !== 1 ? 's' : ''}</strong> getting low (10–30 days)</p>
            </div>
          )}
          {needOrder.length > 0 && (
            <div className="flex items-center gap-2 text-rose-600">
              <span className="text-sm">🛒</span>
              <p className="text-sm font-serif"><strong>{needOrder.length} supplement{needOrder.length !== 1 ? 's' : ''} need to be ordered</strong></p>
            </div>
          )}
          {onOrder.length > 0 && (
            <div className="flex items-center gap-2 text-amber-600">
              <span className="text-sm">📦</span>
              <p className="text-sm font-serif"><strong>{onOrder.length} supplement{onOrder.length !== 1 ? 's' : ''} on order</strong> — expected soon</p>
            </div>
          )}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-0 mb-5 border-b border-bark-200">
        {([
          { key: 'watchlist', label: `Watch List (${active.length})` },
          { key: 'reorder',   label: `Reorder (${needOrder.length + onOrder.length})` },
          { key: 'sidelined', label: `Sidelined (${sidelined.length})` },
        ] as { key: Tab; label: string }[]).map(({ key, label }) => (
          <button key={key} onClick={() => setTab(key)}
            className={`px-4 py-2.5 text-sm font-serif transition-colors ${tab === key
              ? 'border-b-2 border-bark-700 text-bark-800 font-semibold -mb-px'
              : 'text-bark-500 hover:text-bark-700'}`}>
            {label}
          </button>
        ))}
      </div>

      {/* ── WATCH LIST ── */}
      {tab === 'watchlist' && (
        <div className="space-y-2">
          <p className="text-xs text-bark-500 italic mb-3">Set estimated days remaining for active supplements. Items in red zone will trigger alerts.</p>
          {active.length === 0 && (
            <div className="card text-center py-8"><p className="text-bark-400 italic text-sm">No active supplements.</p></div>
          )}
          {active.map(s => {
            const isEditing = editingDays[s.supplement_id] !== undefined
            return (
              <div key={s.supplement_id} className="card py-3">
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <p className="font-serif text-sm text-bark-800 font-semibold">{suppDisplayName(s)}</p>
                    <p className="text-bark-400 text-xs">{suppDisplayDose(s)}</p>
                  </div>
                  <DaysRemainingBadge days={s.estimated_days_remaining} />
                  {isEditing ? (
                    <div className="flex items-center gap-1">
                      <input
                        type="number" min={0} max={365}
                        className="w-16 border border-bark-200 rounded px-2 py-1 text-xs bg-cream text-bark-900 focus:outline-none focus:ring-1 focus:ring-bark-400"
                        value={editingDays[s.supplement_id]}
                        onChange={e => setEditingDays(prev => ({ ...prev, [s.supplement_id]: e.target.value }))}
                        placeholder="days"
                      />
                      <button
                        onClick={() => saveDaysRemaining(s.supplement_id, editingDays[s.supplement_id])}
                        disabled={savingId === s.supplement_id}
                        className="text-xs px-2 py-1 bg-moss-500 text-white rounded font-serif">
                        {savingId === s.supplement_id ? '…' : 'Save'}
                      </button>
                      <button
                        onClick={() => setEditingDays(prev => { const n = { ...prev }; delete n[s.supplement_id]; return n })}
                        className="text-xs px-2 py-1 border border-bark-300 text-bark-600 rounded font-serif">
                        ✕
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setEditingDays(prev => ({ ...prev, [s.supplement_id]: String(s.estimated_days_remaining ?? '') }))}
                      className="text-xs text-bark-500 hover:text-bark-700 underline font-serif">
                      set days
                    </button>
                  )}
                </div>
                {/* Source */}
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-[10px] text-bark-400 uppercase tracking-wide font-serif w-12 flex-shrink-0">Source</span>
                  <input
                    type="text"
                    className="flex-1 text-xs border border-bark-100 rounded px-2 py-1 bg-bark-50 text-bark-700 focus:outline-none focus:ring-1 focus:ring-bark-300"
                    placeholder="HerbCo, Amazon, Toniiq, Local…"
                    defaultValue={s.preferred_source ?? ''}
                    onBlur={e => { if (e.target.value !== (s.preferred_source ?? '')) saveSource(s.supplement_id, e.target.value) }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── REORDER ── */}
      {tab === 'reorder' && (
        <div className="space-y-4">
          {/* Need to order */}
          {needOrder.length > 0 && (
            <div>
              <p className="text-xs text-bark-500 uppercase tracking-wide font-serif mb-2">Needs Ordering ({needOrder.length})</p>
              <div className="space-y-2">
                {needOrder.map(s => (
                  <div key={s.supplement_id} className="card py-3 border-rose-100">
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-serif text-sm text-bark-800 font-semibold">{suppDisplayName(s)}</p>
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-rose-100 text-rose-700 border border-rose-200 font-serif">needs order</span>
                          {s.notes?.toLowerCase().includes('priority') && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-rose-600 text-white font-serif font-semibold">URGENT</span>
                          )}
                        </div>
                        <p className="text-bark-400 text-xs mt-0.5">{suppDisplayDose(s)}{s.notes ? ` — ${s.notes}` : ''}</p>
                        <input
                          type="text"
                          className="mt-2 w-full text-xs border border-bark-100 rounded px-2 py-1 bg-bark-50 text-bark-700 focus:outline-none focus:ring-1 focus:ring-bark-300"
                          placeholder="Source, link, or notes…"
                          defaultValue={s.reorder_notes ?? ''}
                          onBlur={e => { if (e.target.value !== (s.reorder_notes ?? '')) saveReorderNotes(s.supplement_id, e.target.value) }}
                        />
                      </div>
                      <button onClick={() => markOrdered(s.supplement_id)}
                        className="flex-shrink-0 text-xs px-2 py-1.5 bg-amber-500 text-white rounded font-serif hover:bg-amber-600 transition-colors">
                        Mark Ordered
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* On order */}
          {onOrder.length > 0 && (
            <div>
              <p className="text-xs text-bark-500 uppercase tracking-wide font-serif mb-2">On Order — In Transit ({onOrder.length})</p>
              <div className="space-y-2">
                {onOrder.map(s => (
                  <div key={s.supplement_id} className="card py-3 border-amber-100 bg-amber-50/30">
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-serif text-sm text-bark-800 font-semibold">{suppDisplayName(s)}</p>
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200 font-serif">incoming</span>
                        </div>
                        <p className="text-bark-400 text-xs mt-0.5">{suppDisplayDose(s)}</p>
                        <input
                          type="text"
                          className="mt-2 w-full text-xs border border-bark-100 rounded px-2 py-1 bg-white text-bark-700 focus:outline-none focus:ring-1 focus:ring-bark-300"
                          placeholder="Expected arrival, tracking info…"
                          defaultValue={s.reorder_notes ?? ''}
                          onBlur={e => { if (e.target.value !== (s.reorder_notes ?? '')) saveReorderNotes(s.supplement_id, e.target.value) }}
                        />
                      </div>
                      <button onClick={() => markReceived(s.supplement_id)}
                        className="flex-shrink-0 text-xs px-2 py-1.5 bg-moss-500 text-white rounded font-serif hover:bg-moss-600 transition-colors">
                        Mark Received
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {needOrder.length === 0 && onOrder.length === 0 && (
            <div className="card text-center py-8">
              <p className="text-bark-400 italic text-sm">Nothing on the reorder list.</p>
            </div>
          )}
        </div>
      )}

      {/* ── SIDELINED ── */}
      {tab === 'sidelined' && (
        <div className="space-y-2">
          <p className="text-xs text-bark-500 italic mb-3">These are available but not currently in the active protocol.</p>
          {sidelined.length === 0 && (
            <div className="card text-center py-8"><p className="text-bark-400 italic text-sm">No sidelined supplements.</p></div>
          )}
          {sidelined.map(s => (
            <div key={s.supplement_id} className="card py-3 opacity-80">
              <div className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-serif text-sm text-bark-600 italic">{suppDisplayName(s)}</p>
                  <p className="text-bark-400 text-xs">{suppDisplayDose(s)}{s.notes ? ` — ${s.notes}` : ''}</p>
                </div>
                <button onClick={() => markActive(s.supplement_id)}
                  className="flex-shrink-0 text-xs px-3 py-1.5 border border-moss-400 text-moss-700 rounded font-serif hover:bg-moss-50 transition-colors">
                  Activate
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
