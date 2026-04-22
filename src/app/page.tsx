'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import {
  isFenbenOnDay, getCycleDayNumber, daysUntilPhaseChange,
  todayStr, formatDateDisplay, formatTimeDisplay,
} from '@/lib/supplements'
import TrendChart from '@/components/TrendChart'
import AnalysisPanel from '@/components/AnalysisPanel'

type DashboardData = {
  cycleStart: string | null
  dosingMode: string
  takenIds: string[]
  totalActive: number
  onOrderCount: number
  needOrderCount: number
  onOrderNames: string[]
  needOrderNames: string[]
  lastTopical: { applied_at: string; products: string[] } | null
  latestObservation: { log_date: string; pain_level: number | null; energy_level: number | null } | null
  gabapentinLast7: number
  gabapentinLastDose: string | null
}

const EMPTY: DashboardData = {
  cycleStart: null,
  dosingMode: 'continuous',
  takenIds: [],
  totalActive: 0,
  onOrderCount: 0,
  needOrderCount: 0,
  onOrderNames: [],
  needOrderNames: [],
  lastTopical: null,
  latestObservation: null,
  gabapentinLast7: 0,
  gabapentinLastDose: null,
}

function PainDot({ level }: { level: number | null }) {
  if (!level) return <span className="text-bark-400 text-sm">Not logged</span>
  const colors = ['', 'bg-moss-500', 'bg-moss-400', 'bg-amber-400', 'bg-amber-600', 'bg-rose-500']
  const labels = ['', 'Minimal', 'Mild', 'Moderate', 'Significant', 'Severe']
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-white text-xs ${colors[level]}`}>
      {labels[level]} ({level}/5)
    </span>
  )
}

export default function Dashboard() {
  const [data, setData] = useState<DashboardData>(EMPTY)
  const [loading, setLoading] = useState(true)
  const today = todayStr()

  useEffect(() => {
    async function load() {
      try {
        const sevenDaysAgo = new Date()
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
        const sevenDaysAgoStr = sevenDaysAgo.toISOString()

        const [settings, suppLog, suppCounts, topical, obs, gaba] = await Promise.all([
          supabase.from('fenben_settings').select('cycle_start_date, dosing_mode').eq('id', 1).limit(1),
          supabase.from('supplement_logs').select('taken_ids').eq('log_date', today).limit(1),
          supabase.from('supplement_config').select('supplement_id, name, name_override, status').not('group_id', 'is', null),
          supabase.from('topical_logs').select('applied_at, products').order('applied_at', { ascending: false }).limit(1),
          supabase.from('observation_logs').select('log_date, pain_level, energy_level').order('log_date', { ascending: false }).limit(1),
          supabase.from('gabapentin_logs').select('given_at').gte('given_at', sevenDaysAgoStr).order('given_at', { ascending: false }),
        ])

        const allSupps = suppCounts.data ?? []
        const totalActive = allSupps.filter(s => s.status === 'active').length
        const onOrderItems = allSupps.filter(s => s.status === 'on_order')
        const needOrderItems = allSupps.filter(s => s.status === 'need_to_order')

        setData({
          cycleStart:       settings.data?.[0]?.cycle_start_date ?? null,
          dosingMode:       settings.data?.[0]?.dosing_mode ?? 'continuous',
          takenIds:         suppLog.data?.[0]?.taken_ids ?? [],
          totalActive,
          onOrderCount:     onOrderItems.length,
          needOrderCount:   needOrderItems.length,
          onOrderNames:     onOrderItems.map(s => s.name_override ?? s.name ?? s.supplement_id),
          needOrderNames:   needOrderItems.map(s => s.name_override ?? s.name ?? s.supplement_id),
          lastTopical:      topical.data?.[0] ?? null,
          latestObservation: obs.data?.[0] ?? null,
          gabapentinLast7:  gaba.data?.length ?? 0,
          gabapentinLastDose: gaba.data?.[0]?.given_at ?? null,
        })
      } catch (err) {
        console.error('Dashboard load error:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [today])

  const taken = data.takenIds.length
  const suppPct = data.totalActive > 0 ? Math.round((taken / data.totalActive) * 100) : 0

  const fenbenOn = data.cycleStart && data.dosingMode === 'cycling' ? isFenbenOnDay(data.cycleStart, today) : null
  const cycleDay = data.cycleStart && data.dosingMode === 'cycling' ? getCycleDayNumber(data.cycleStart, today) : null
  const daysLeft = data.cycleStart && data.dosingMode === 'cycling' ? daysUntilPhaseChange(data.cycleStart, today) : null

  const daysSinceTopical = data.lastTopical
    ? Math.floor((Date.now() - new Date(data.lastTopical.applied_at).getTime()) / 86400000)
    : null

  const hoursSinceGaba = data.gabapentinLastDose
    ? Math.round((Date.now() - new Date(data.gabapentinLastDose).getTime()) / 3600000)
    : null

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <p className="text-bark-400 font-serif italic">Loading Isis&apos;s data…</p>
      </div>
    )
  }

  return (
    <div>
      <h1 className="page-title">Good day, Isis 🌿</h1>
      <p className="page-subtitle">{formatDateDisplay(today)}</p>

      {/* Protocol status banner */}
      <div className="card mb-4 bg-bark-800 border-bark-700">
        <p className="text-xs text-bark-300 uppercase tracking-wide font-serif mb-2">Protocol Status</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
          <div>
            <p className="text-[10px] text-bark-400 uppercase tracking-wide font-serif">Fenben Mode</p>
            <p className={`text-sm font-serif font-semibold mt-0.5 ${data.dosingMode === 'continuous' ? 'text-rose-300' : 'text-moss-300'}`}>
              {data.dosingMode === 'continuous' ? 'Continuous' : 'Cycling'}
            </p>
          </div>
          <div>
            <p className="text-[10px] text-bark-400 uppercase tracking-wide font-serif">Last Gabapentin</p>
            <p className="text-sm font-serif font-semibold text-cream mt-0.5">
              {hoursSinceGaba != null ? (hoursSinceGaba < 1 ? '<1 hr ago' : `${hoursSinceGaba}h ago`) : 'None this week'}
            </p>
          </div>
          <div>
            <p className="text-[10px] text-bark-400 uppercase tracking-wide font-serif">Last DMSO Pack</p>
            <p className="text-sm font-serif font-semibold text-cream mt-0.5">
              {daysSinceTopical != null
                ? daysSinceTopical === 0 ? 'Today' : daysSinceTopical === 1 ? 'Yesterday' : `${daysSinceTopical}d ago`
                : 'Not logged'}
            </p>
          </div>
          <div>
            <p className="text-[10px] text-bark-400 uppercase tracking-wide font-serif">Supplements</p>
            <p className="text-sm font-serif font-semibold text-cream mt-0.5">
              {taken}/{data.totalActive} <span className="text-bark-400 font-normal text-xs">({suppPct}%)</span>
            </p>
          </div>
        </div>
      </div>

      {/* Inventory alerts */}
      {(data.onOrderCount > 0 || data.needOrderCount > 0) && (
        <div className="mb-4 space-y-2">
          {data.needOrderCount > 0 && (
            <div className="bg-rose-50 border border-rose-300 rounded-xl p-3 flex items-start gap-3">
              <span className="text-rose-600 text-lg mt-0.5">🛒</span>
              <div className="flex-1">
                <p className="font-serif font-semibold text-rose-700 text-sm">
                  {data.needOrderCount} supplement{data.needOrderCount !== 1 ? 's' : ''} need ordering
                </p>
                <p className="text-rose-600 text-xs mt-0.5 leading-relaxed">
                  {data.needOrderNames.slice(0, 5).join(' · ')}{data.needOrderCount > 5 ? ` + ${data.needOrderCount - 5} more` : ''}
                </p>
              </div>
              <Link href="/inventory" className="text-xs text-rose-700 underline font-serif flex-shrink-0">Inventory →</Link>
            </div>
          )}
          {data.onOrderCount > 0 && (
            <div className="bg-amber-50 border border-amber-300 rounded-xl p-3 flex items-start gap-3">
              <span className="text-amber-600 text-lg mt-0.5">📦</span>
              <div className="flex-1">
                <p className="font-serif font-semibold text-amber-700 text-sm">
                  {data.onOrderCount} supplement{data.onOrderCount !== 1 ? 's' : ''} on order
                </p>
                <p className="text-amber-600 text-xs mt-0.5 leading-relaxed">
                  {data.onOrderNames.join(' · ')}
                </p>
              </div>
              <Link href="/inventory" className="text-xs text-amber-700 underline font-serif flex-shrink-0">Inventory →</Link>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">

        {/* Fenben Card */}
        <Link href="/fenben" className="card hover:shadow-md transition-shadow">
          <p className="label">Fenbendazole</p>
          {data.dosingMode === 'continuous' ? (
            <>
              <div className="inline-flex items-center gap-2 mt-1 px-3 py-1.5 rounded-full text-sm font-serif font-semibold bg-rose-100 text-rose-700">
                <span>💊</span>
                <span>Continuous Daily</span>
              </div>
              <p className="text-xs text-bark-500 mt-2">444mg daily with fat — cycling suspended</p>
            </>
          ) : data.cycleStart ? (
            <>
              <div className={`inline-flex items-center gap-2 mt-1 px-3 py-1.5 rounded-full text-sm font-serif font-semibold ${fenbenOn ? 'bg-moss-500 text-white' : 'bg-bark-100 text-bark-600'}`}>
                <span>{fenbenOn ? '🟢' : '⬜'}</span>
                <span>{fenbenOn ? 'ON Day' : 'OFF Day'}</span>
              </div>
              <p className="text-xs text-bark-500 mt-2">
                Day {cycleDay} of 7 cycle · {daysLeft} day{daysLeft !== 1 ? 's' : ''} until {fenbenOn ? 'rest' : 'next dose'}
              </p>
            </>
          ) : (
            <div className="mt-2">
              <p className="text-bark-500 text-sm italic">Cycle start not set.</p>
              <p className="text-moss-600 text-xs mt-1 underline">Set it in the Fenben page →</p>
            </div>
          )}
        </Link>

        {/* Supplement Progress */}
        <Link href="/supplements" className="card hover:shadow-md transition-shadow">
          <p className="label">Today&apos;s Supplements</p>
          <p className="text-2xl font-serif font-bold text-bark-800 mt-1">
            {taken} <span className="text-base font-normal text-bark-500">/ {data.totalActive}</span>
          </p>
          <div className="mt-3 bg-bark-100 rounded-full h-2 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${suppPct === 100 ? 'bg-moss-500' : 'bg-bark-400'}`}
              style={{ width: `${suppPct}%` }}
            />
          </div>
          <p className="text-xs text-bark-500 mt-1.5">{suppPct}% complete</p>
        </Link>

        {/* Last Topical */}
        <Link href="/topical" className="card hover:shadow-md transition-shadow">
          <p className="label">Last DMSO Pack</p>
          {data.lastTopical ? (
            <>
              <p className="text-lg font-serif font-semibold text-bark-800 mt-1">
                {daysSinceTopical === 0 ? 'Today' : daysSinceTopical === 1 ? 'Yesterday' : `${daysSinceTopical} days ago`}
              </p>
              <p className="text-xs text-bark-500 mt-1">{formatTimeDisplay(data.lastTopical.applied_at)}</p>
              <p className="text-xs text-bark-400 mt-1 truncate">{data.lastTopical.products.join(', ')}</p>
            </>
          ) : (
            <p className="text-bark-500 text-sm italic mt-2">No applications logged yet.</p>
          )}
        </Link>

        {/* Latest Pain Level */}
        <Link href="/observations" className="card hover:shadow-md transition-shadow">
          <p className="label">Latest Pain Level</p>
          <div className="mt-2">
            <PainDot level={data.latestObservation?.pain_level ?? null} />
          </div>
          {data.latestObservation && (
            <p className="text-xs text-bark-400 mt-2">
              Logged {formatDateDisplay(data.latestObservation.log_date)}
              {data.latestObservation.energy_level && <> · Energy {data.latestObservation.energy_level}/5</>}
            </p>
          )}
          {!data.latestObservation && (
            <p className="text-bark-500 text-sm italic mt-2">No observations yet.</p>
          )}
        </Link>

        {/* Gabapentin */}
        <Link href="/medications" className="card hover:shadow-md transition-shadow">
          <p className="label">Gabapentin (Last 7 Days)</p>
          <p className="text-2xl font-serif font-bold text-bark-800 mt-1">
            {data.gabapentinLast7}{' '}
            <span className="text-base font-normal text-bark-500">dose{data.gabapentinLast7 !== 1 ? 's' : ''}</span>
          </p>
          {data.gabapentinLastDose ? (
            <p className="text-xs text-bark-500 mt-2">
              Last: {formatDateDisplay(data.gabapentinLastDose.split('T')[0])} at {formatTimeDisplay(data.gabapentinLastDose)}
              {hoursSinceGaba != null && <span className="text-bark-400"> ({hoursSinceGaba}h ago)</span>}
            </p>
          ) : (
            <p className="text-xs text-bark-400 mt-2 italic">None given this week — good sign!</p>
          )}
        </Link>

        {/* Quick nav */}
        <div className="card bg-bark-50 border-bark-200">
          <p className="label">Quick Links</p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {[
              { href: '/weight',      icon: '⚖️', label: 'Log Weight' },
              { href: '/topical',     icon: '🫙', label: 'Log Topical' },
              { href: '/medications', icon: '💊', label: 'Log Gabapentin' },
              { href: '/observations',icon: '📋', label: 'Log Vitals' },
              { href: '/inventory',   icon: '📦', label: 'Inventory' },
              { href: '/fenben',      icon: '💉', label: 'Log Fenben' },
            ].map(({ href, icon, label }) => (
              <Link key={href} href={href}
                className="flex items-center gap-1.5 text-xs text-bark-700 hover:text-bark-900 font-serif py-1 px-2 rounded-md hover:bg-bark-100 transition-colors">
                <span>{icon}</span><span>{label}</span>
              </Link>
            ))}
          </div>
        </div>

      </div>

      <div className="mt-6"><TrendChart /></div>
      <div className="mt-4"><AnalysisPanel /></div>
    </div>
  )
}
