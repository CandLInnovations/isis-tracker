'use client'

import { useEffect, useState } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { supabase } from '@/lib/supabase'

type DataPoint = {
  displayDate: string
  pain?: number
  energy?: number
  lump?: number
}

export default function TrendChart() {
  const [data, setData] = useState<DataPoint[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const from = new Date()
      from.setDate(from.getDate() - 30)
      const fromStr = from.toISOString().split('T')[0]

      const { data: rows } = await supabase
        .from('observation_logs')
        .select('log_date, pain_level, energy_level, lump_size_cm')
        .gte('log_date', fromStr)
        .order('log_date', { ascending: true })

      setData(
        (rows ?? []).map(r => ({
          displayDate: new Date(r.log_date + 'T00:00:00').toLocaleDateString('en-US', {
            month: 'short', day: 'numeric',
          }),
          ...(r.pain_level   != null ? { pain:   r.pain_level }   : {}),
          ...(r.energy_level != null ? { energy: r.energy_level } : {}),
          ...(r.lump_size_cm != null ? { lump:   Number(r.lump_size_cm) } : {}),
        }))
      )
      setLoading(false)
    }
    load()
  }, [])

  if (loading) {
    return (
      <div className="card h-40 flex items-center justify-center">
        <p className="text-bark-400 italic text-sm">Loading trend data…</p>
      </div>
    )
  }

  const meaningful = data.filter(d => d.pain != null || d.energy != null || d.lump != null)
  if (meaningful.length < 3) {
    return (
      <div className="card h-40 flex items-center justify-center text-center">
        <p className="text-bark-400 italic text-sm px-4">
          Log a few observations to see trends here.
        </p>
      </div>
    )
  }

  const hasLump = data.some(d => d.lump != null)

  return (
    <div className="card">
      <p className="section-title">30-Day Trends</p>
      <ResponsiveContainer width="100%" height={270}>
        <LineChart data={data} margin={{ top: 5, right: hasLump ? 45 : 10, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e8dfd4" />
          <XAxis
            dataKey="displayDate"
            tick={{ fontFamily: 'Georgia, serif', fontSize: 11, fill: '#6b340f' }}
            interval="preserveStartEnd"
          />
          <YAxis
            yAxisId="scale"
            domain={[1, 5]}
            ticks={[1, 2, 3, 4, 5]}
            tick={{ fontFamily: 'Georgia, serif', fontSize: 11, fill: '#6b340f' }}
            width={24}
          />
          {hasLump && (
            <YAxis
              yAxisId="cm"
              orientation="right"
              tick={{ fontFamily: 'Georgia, serif', fontSize: 11, fill: '#6b340f' }}
              tickFormatter={v => `${v}cm`}
              width={40}
            />
          )}
          <Tooltip
            contentStyle={{
              fontFamily: 'Georgia, serif', fontSize: 12,
              borderColor: '#e8dfd4', borderRadius: 8, background: '#fdf8f0',
            }}
            labelStyle={{ color: '#4a240b', fontWeight: 'bold', marginBottom: 4 }}
            formatter={(value, name) => {
              const v = Number(value)
              if (name === 'Lump (cm)') return [`${v} cm`, name] as [string, string]
              return [`${v}/5`, name] as [string, string]
            }}
          />
          <Legend wrapperStyle={{ fontFamily: 'Georgia, serif', fontSize: 12, paddingTop: 8 }} />
          <Line
            yAxisId="scale" type="monotone" dataKey="pain" name="Pain"
            stroke="#c0392b" strokeWidth={2} dot={{ r: 3, fill: '#c0392b' }}
            connectNulls activeDot={{ r: 5 }}
          />
          <Line
            yAxisId="scale" type="monotone" dataKey="energy" name="Energy"
            stroke="#558548" strokeWidth={2} dot={{ r: 3, fill: '#558548' }}
            connectNulls activeDot={{ r: 5 }}
          />
          {hasLump && (
            <Line
              yAxisId="cm" type="monotone" dataKey="lump" name="Lump (cm)"
              stroke="#9e7248" strokeWidth={2} dot={{ r: 3, fill: '#9e7248' }}
              connectNulls activeDot={{ r: 5 }}
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
