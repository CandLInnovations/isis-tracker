'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import {
  isFenbenOnDay, getCycleDayNumber, daysUntilPhaseChange,
  todayStr, formatDateDisplay, formatTimeDisplay,
  ALL_SUPPLEMENTS, ON_ORDER_IDS,
} from '@/lib/supplements'

type DashboardData = {
  cycleStart: string | null
  takenIds: string[]
  lastTopical: { applied_at: string; products: string[] } | null
  latestObservation: { log_date: string; pain_level: number | null; energy_level: number | null } | null
  gabapentinLast7: number
  gabapentinLastDose: string | null
}

const EMPTY: DashboardData = {
  cycleStart: null,
  takenIds: [],
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
      const sevenDaysAgo = new Date()
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
      const sevenDaysAgoStr = sevenDaysAgo.toISOString()

      const [settings, suppLog, topical, obs, gaba] = await Promise.all([
        supabase.from('fenben_settings').select('cycle_start_date').eq('id', 1).maybeSingle(),
        supabase.from('supplement_logs').select('taken_ids').eq('log_date', today).maybeSingle(),
        supabase.from('topical_logs').select('applied_at, products').order('applied_at', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('observation_logs').select('log_date, pain_level, energy_level').order('log_date', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('gabapentin_logs').select('given_at').gte('given_at', sevenDaysAgoStr).order('given_at', { ascending: false }),
      ])

      setData({
        cycleStart: settings.data?.cycle_start_date ?? null,
        takenIds: suppLog.data?.taken_ids ?? [],
        lastTopical: topical.data ?? null,
        latestObservation: obs.data ?? null,
        gabapentinLast7: gaba.data?.length ?? 0,
        gabapentinLastDose: gaba.data?.[0]?.given_at ?? null,
      })
      setLoading(false)
    }
    load()
  }, [today])

  const activeSupps = ALL_SUPPLEMENTS.filter(s => !ON_ORDER_IDS.includes(s.id) && s.active)
  const totalActive = activeSupps.length
  const taken = data.takenIds.length
  const suppPct = totalActive > 0 ? Math.round((taken / totalActive) * 100) : 0

  const fenbenOn = data.cycleStart ? isFenbenOnDay(data.cycleStart, today) : null
  const cycleDay = data.cycleStart ? getCycleDayNumber(data.cycleStart, today) : null
  const daysLeft = data.cycleStart ? daysUntilPhaseChange(data.cycleStart, today) : null

  const daysSinceTopical = data.lastTopical
    ? Math.floor((Date.now() - new Date(data.lastTopical.applied_at).getTime()) / 86400000)
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

      {/* Alert: supplements on order */}
      <div className="mb-6 bg-amber-100 border border-amber-400 rounded-xl p-4 flex gap-3 items-start">
        <span className="text-amber-700 text-lg mt-0.5">📦</span>
        <div>
          <p className="font-serif font-semibold text-amber-700 text-sm">3 Supplements On Order</p>
          <p className="text-amber-600 text-xs mt-0.5">
            Vitamin E Succinate · Turkey Tail · Quercetin — activate them in Supplements once they arrive.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">

        {/* Fenben Card */}
        <Link href="/fenben" className="card hover:shadow-md transition-shadow">
          <p className="label">Fenbendazole Cycle</p>
          {data.cycleStart ? (
            <>
              <div className={`inline-flex items-center gap-2 mt-1 px-3 py-1.5 rounded-full text-sm font-serif font-semibold ${fenbenOn ? 'bg-moss-500 text-white' : 'bg-bark-100 text-bark-600'}`}>
                <span>{fenbenOn ? '🟢' : '⬜'}</span>
                <span>{fenbenOn ? 'ON Day' : 'OFF Day'}</span>
              </div>
              <p className="text-xs text-bark-500 mt-2">
                Day {cycleDay} of 7 cycle · {daysLeft} day{daysLeft !== 1 ? 's' : ''} until {fenbenOn ? 'rest' : 'next dose'}
              </p>
              <p className="text-xs text-bark-400 mt-1">Cycle started {formatDateDisplay(data.cycleStart)}</p>
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
            {taken} <span className="text-base font-normal text-bark-500">/ {totalActive}</span>
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
          <p className="label">Last Topical Application</p>
          {data.lastTopical ? (
            <>
              <p className="text-lg font-serif font-semibold text-bark-800 mt-1">
                {daysSinceTopical === 0 ? 'Today' : daysSinceTopical === 1 ? 'Yesterday' : `${daysSinceTopical} days ago`}
              </p>
              <p className="text-xs text-bark-500 mt-1">
                {formatTimeDisplay(data.lastTopical.applied_at)}
              </p>
              <p className="text-xs text-bark-400 mt-1 truncate">
                {data.lastTopical.products.join(', ')}
              </p>
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
              {data.latestObservation.energy_level && (
                <> · Energy {data.latestObservation.energy_level}/5</>
              )}
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
            <span className="text-base font-normal text-bark-500">
              dose{data.gabapentinLast7 !== 1 ? 's' : ''}
            </span>
          </p>
          {data.gabapentinLastDose ? (
            <p className="text-xs text-bark-500 mt-2">
              Last given: {formatDateDisplay(data.gabapentinLastDose.split('T')[0])} at{' '}
              {formatTimeDisplay(data.gabapentinLastDose)}
            </p>
          ) : (
            <p className="text-xs text-bark-400 mt-2 italic">None given this week — good sign!</p>
          )}
        </Link>

        {/* Quick nav card */}
        <div className="card bg-bark-50 border-bark-200">
          <p className="label">Quick Links</p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {[
              { href: '/weight', icon: '⚖️', label: 'Log Weight' },
              { href: '/topical', icon: '🫙', label: 'Log Topical' },
              { href: '/medications', icon: '💊', label: 'Log Gabapentin' },
              { href: '/observations', icon: '📋', label: 'Log Vitals' },
            ].map(({ href, icon, label }) => (
              <Link
                key={href}
                href={href}
                className="flex items-center gap-1.5 text-xs text-bark-700 hover:text-bark-900 font-serif py-1 px-2 rounded-md hover:bg-bark-100 transition-colors"
              >
                <span>{icon}</span>
                <span>{label}</span>
              </Link>
            ))}
          </div>
        </div>

      </div>
    </div>
  )
}
