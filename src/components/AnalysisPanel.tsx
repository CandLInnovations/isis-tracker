'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { isFenbenOnDay, todayStr } from '@/lib/supplements'

type ObsRow = { log_date: string; pain_level: number | null; energy_level: number | null; lump_size_cm: number | null }
type DoseRow = { dose_date: string; given: boolean }

type Analysis = {
  // Pain
  painLast7: number | null
  painPrev7: number | null
  // Energy
  energyLast7: number | null
  energyPrev7: number | null
  // Lump
  lumpFirst: { date: string; cm: number } | null
  lumpLatest: { date: string; cm: number } | null
  // Fenben compliance
  fenbenGiven: number
  fenbenTotal: number
  // Gabapentin
  gabaLast7: number
  gabaPrev7: number
  gabaHasHistory: boolean
  // Topical
  lastTopicalAt: string | null
}

function avg(nums: number[]): number | null {
  if (!nums.length) return null
  return nums.reduce((a, b) => a + b, 0) / nums.length
}

function daysAgo(dateStr: string): number {
  const d = new Date(dateStr + 'T00:00:00')
  return Math.floor((Date.now() - d.getTime()) / 86400000)
}

type TrendDir = 'Improving' | 'Stable' | 'Declining'

function TrendBadge({ trend }: { trend: TrendDir }) {
  const cfg: Record<TrendDir, { bg: string; icon: string }> = {
    Improving: { bg: 'bg-moss-100 text-moss-700 border border-moss-200', icon: '↗' },
    Stable:    { bg: 'bg-amber-100 text-amber-700 border border-amber-200', icon: '→' },
    Declining: { bg: 'bg-rose-100 text-rose-700 border border-rose-200',   icon: '↘' },
  }
  const { bg, icon } = cfg[trend]
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-serif font-semibold ${bg}`}>
      {icon} {trend}
    </span>
  )
}

function painTrend(last: number | null, prev: number | null): TrendDir {
  if (last == null || prev == null) return 'Stable'
  const diff = last - prev
  if (diff < -0.2) return 'Improving' // lower pain = better
  if (diff >  0.2) return 'Declining'
  return 'Stable'
}

function energyTrend(last: number | null, prev: number | null): TrendDir {
  if (last == null || prev == null) return 'Stable'
  const diff = last - prev
  if (diff >  0.2) return 'Improving' // higher energy = better
  if (diff < -0.2) return 'Declining'
  return 'Stable'
}

function lumpTrend(first: number | null, latest: number | null): TrendDir {
  if (first == null || latest == null) return 'Stable'
  const diff = latest - first
  if (diff < -0.1) return 'Improving'
  if (diff >  0.1) return 'Declining'
  return 'Stable'
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-3 border-b border-bark-100 last:border-0">
      <p className="text-xs text-bark-500 font-serif uppercase tracking-wide flex-shrink-0 pt-0.5">{label}</p>
      <div className="text-right">{children}</div>
    </div>
  )
}

export default function AnalysisPanel() {
  const [analysis, setAnalysis] = useState<Analysis | null>(null)
  const [loading, setLoading] = useState(true)
  const today = todayStr()

  useEffect(() => {
    async function load() {
      const fourteenAgo = new Date(); fourteenAgo.setDate(fourteenAgo.getDate() - 14)
      const fourteenAgoStr = fourteenAgo.toISOString().split('T')[0]
      const ninetyAgo = new Date(); ninetyAgo.setDate(ninetyAgo.getDate() - 90)
      const ninetyAgoStr = ninetyAgo.toISOString().split('T')[0]
      const sevenAgo = new Date(); sevenAgo.setDate(sevenAgo.getDate() - 7)
      const sevenAgoTs = sevenAgo.toISOString()
      const fourteenAgoTs = fourteenAgo.toISOString()

      const [obsRes, lumpRes, fenSettings, fenDoses, gabaRes, gabaOlderRes, topRes] = await Promise.all([
        supabase.from('observation_logs')
          .select('log_date, pain_level, energy_level, lump_size_cm')
          .gte('log_date', fourteenAgoStr).order('log_date', { ascending: false }),
        supabase.from('observation_logs')
          .select('log_date, lump_size_cm')
          .not('lump_size_cm', 'is', null)
          .order('log_date', { ascending: true }),
        supabase.from('fenben_settings').select('cycle_start_date').eq('id', 1).limit(1),
        supabase.from('fenben_doses').select('dose_date, given').gte('dose_date', ninetyAgoStr),
        supabase.from('gabapentin_logs').select('given_at').gte('given_at', fourteenAgoTs),
        supabase.from('gabapentin_logs').select('given_at').lt('given_at', sevenAgoTs).limit(1),
        supabase.from('topical_logs').select('applied_at').order('applied_at', { ascending: false }).limit(1),
      ])

      const obs: ObsRow[] = obsRes.data ?? []
      const last7obs = obs.filter(o => daysAgo(o.log_date) <= 7)
      const prev7obs = obs.filter(o => daysAgo(o.log_date) > 7 && daysAgo(o.log_date) <= 14)

      // Lump first/latest
      const lumpRows = (lumpRes.data ?? []).filter(r => r.lump_size_cm != null)
      const lumpFirst  = lumpRows[0]  ? { date: lumpRows[0].log_date,  cm: Number(lumpRows[0].lump_size_cm)  } : null
      const lumpLatest = lumpRows.at(-1) ? { date: lumpRows.at(-1)!.log_date, cm: Number(lumpRows.at(-1)!.lump_size_cm) } : null

      // Fenben compliance
      let fenbenGiven = 0, fenbenTotal = 0
      const cycleStart = (fenSettings.data ?? [])[0]?.cycle_start_date
      if (cycleStart) {
        const doses: DoseRow[] = fenDoses.data ?? []
        const doseMap: Record<string, boolean> = {}
        for (const d of doses) doseMap[d.dose_date] = d.given

        const start = new Date(Math.max(new Date(cycleStart + 'T00:00:00').getTime(), ninetyAgo.getTime()))
        const end   = new Date(today + 'T00:00:00')
        const cur   = new Date(start)
        while (cur <= end) {
          const ds = cur.toISOString().split('T')[0]
          if (isFenbenOnDay(cycleStart, ds)) {
            fenbenTotal++
            if (doseMap[ds] === true) fenbenGiven++
          }
          cur.setDate(cur.getDate() + 1)
        }
      }

      // Gabapentin
      const gabaAll: { given_at: string }[] = gabaRes.data ?? []
      const gabaLast7 = gabaAll.filter(g => new Date(g.given_at) >= sevenAgo).length
      const gabaPrev7 = gabaAll.filter(g => new Date(g.given_at) < sevenAgo).length
      const gabaHasHistory = (gabaOlderRes.data?.length ?? 0) > 0

      setAnalysis({
        painLast7:    avg(last7obs.map(o => o.pain_level).filter((v): v is number => v != null)),
        painPrev7:    avg(prev7obs.map(o => o.pain_level).filter((v): v is number => v != null)),
        energyLast7:  avg(last7obs.map(o => o.energy_level).filter((v): v is number => v != null)),
        energyPrev7:  avg(prev7obs.map(o => o.energy_level).filter((v): v is number => v != null)),
        lumpFirst, lumpLatest,
        fenbenGiven, fenbenTotal,
        gabaLast7, gabaPrev7, gabaHasHistory,
        lastTopicalAt: (topRes.data ?? [])[0]?.applied_at ?? null,
      })
      setLoading(false)
    }
    load()
  }, [today])

  if (loading) {
    return <div className="card h-24 flex items-center justify-center"><p className="text-bark-400 italic text-sm">Loading analysis…</p></div>
  }
  if (!analysis) return null

  const {
    painLast7, painPrev7, energyLast7, energyPrev7,
    lumpFirst, lumpLatest,
    fenbenGiven, fenbenTotal,
    gabaLast7, gabaPrev7, gabaHasHistory,
    lastTopicalAt,
  } = analysis

  const fenbenPct = fenbenTotal > 0 ? Math.round((fenbenGiven / fenbenTotal) * 100) : null
  const hoursSinceTopical = lastTopicalAt
    ? Math.round((Date.now() - new Date(lastTopicalAt).getTime()) / 3600000)
    : null
  const lumpDiff = lumpFirst && lumpLatest ? lumpLatest.cm - lumpFirst.cm : null
  const gabaSignal: TrendDir = !gabaHasHistory ? 'Stable'
    : gabaLast7 > gabaPrev7 ? 'Declining'
    : gabaLast7 < gabaPrev7 ? 'Improving'
    : 'Stable'

  return (
    <div className="card">
      <p className="section-title">Progress Analysis</p>
      <div className="divide-y divide-bark-100">

        {/* Pain */}
        <Row label="Pain Trend">
          <div className="flex items-center gap-2 justify-end flex-wrap">
            <TrendBadge trend={painTrend(painLast7, painPrev7)} />
            {painLast7 != null && (
              <p className="text-xs text-bark-500 font-serif">
                7d avg {painLast7.toFixed(1)}
                {painPrev7 != null && ` · prev {painPrev7.toFixed(1)}`}
              </p>
            )}
            {painLast7 == null && <p className="text-xs text-bark-400 italic">Not enough data</p>}
          </div>
        </Row>

        {/* Energy */}
        <Row label="Energy Trend">
          <div className="flex items-center gap-2 justify-end flex-wrap">
            <TrendBadge trend={energyTrend(energyLast7, energyPrev7)} />
            {energyLast7 != null && (
              <p className="text-xs text-bark-500 font-serif">
                7d avg {energyLast7.toFixed(1)}
                {energyPrev7 != null && ` · prev ${energyPrev7.toFixed(1)}`}
              </p>
            )}
            {energyLast7 == null && <p className="text-xs text-bark-400 italic">Not enough data</p>}
          </div>
        </Row>

        {/* Lump */}
        <Row label="Lump Size">
          {lumpFirst && lumpLatest ? (
            <div className="space-y-0.5">
              <div className="flex items-center gap-2 justify-end">
                <TrendBadge trend={lumpTrend(lumpFirst.cm, lumpLatest.cm)} />
                {lumpDiff != null && (
                  <span className="text-xs text-bark-500 font-serif">
                    {lumpDiff > 0 ? '+' : ''}{lumpDiff.toFixed(1)} cm total
                  </span>
                )}
              </div>
              <p className="text-xs text-bark-400 font-serif">
                First {lumpFirst.cm} cm → Now {lumpLatest.cm} cm
              </p>
            </div>
          ) : (
            <p className="text-xs text-bark-400 italic">No lump measurements yet</p>
          )}
        </Row>

        {/* Fenben compliance */}
        <Row label="Fenben Compliance">
          {fenbenTotal > 0 ? (
            <div className="space-y-1.5 min-w-[160px]">
              <div className="flex items-center justify-end gap-2">
                <span className={`text-sm font-serif font-bold ${fenbenPct! >= 90 ? 'text-moss-700' : fenbenPct! >= 70 ? 'text-amber-700' : 'text-rose-700'}`}>
                  {fenbenPct}%
                </span>
                <span className="text-xs text-bark-400">{fenbenGiven}/{fenbenTotal} ON days</span>
              </div>
              <div className="bg-bark-100 rounded-full h-1.5 overflow-hidden w-full">
                <div
                  className={`h-full rounded-full ${fenbenPct! >= 90 ? 'bg-moss-500' : fenbenPct! >= 70 ? 'bg-amber-500' : 'bg-rose-500'}`}
                  style={{ width: `${fenbenPct}%` }}
                />
              </div>
            </div>
          ) : (
            <p className="text-xs text-bark-400 italic">Set cycle start to track</p>
          )}
        </Row>

        {/* Gabapentin */}
        <Row label="Gabapentin Use">
          <div className="flex items-center gap-2 justify-end flex-wrap">
            <TrendBadge trend={gabaSignal} />
            <p className="text-xs text-bark-500 font-serif">
              {gabaLast7} dose{gabaLast7 !== 1 ? 's' : ''} this week
              {gabaPrev7 > 0 && ` · ${gabaPrev7} last week`}
            </p>
          </div>
          {gabaSignal === 'Declining' && (
            <p className="text-xs text-rose-600 mt-1 font-serif">↑ Increasing frequency — pain may be escalating</p>
          )}
        </Row>

        {/* Topical */}
        <Row label="Last Topical">
          {hoursSinceTopical != null ? (
            <div className="flex items-center gap-2 justify-end flex-wrap">
              {hoursSinceTopical > 14 && (
                <span className="text-xs bg-amber-100 text-amber-700 border border-amber-300 px-2 py-0.5 rounded-full font-serif">⚠ Overdue</span>
              )}
              <span className={`text-sm font-serif font-semibold ${hoursSinceTopical > 14 ? 'text-amber-700' : 'text-moss-700'}`}>
                {hoursSinceTopical < 1 ? '< 1 hr ago' : `${hoursSinceTopical} hr${hoursSinceTopical !== 1 ? 's' : ''} ago`}
              </span>
            </div>
          ) : (
            <p className="text-xs text-bark-400 italic">No applications logged</p>
          )}
        </Row>

      </div>
    </div>
  )
}
