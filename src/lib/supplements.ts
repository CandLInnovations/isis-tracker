// ─── Supplement system types ────────────────────────────────────────────────

export type SupplementStatus = 'active' | 'on_order' | 'need_to_order' | 'sidelined'

export type GroupRow = {
  id: string
  name: string
  display_order: number
  icon: string | null
}

export type SuppRow = {
  supplement_id: string
  name: string | null
  dose: string | null
  status: SupplementStatus
  group_id: string | null
  display_order: number
  notes: string | null
  name_override: string | null
  dose_override: string | null
  estimated_days_remaining: number | null
  last_restocked_date: string | null
  preferred_source: string | null
  reorder_notes: string | null
  active: boolean
}

export function suppDisplayName(s: SuppRow): string {
  return s.name_override ?? s.name ?? s.supplement_id
}

export function suppDisplayDose(s: SuppRow): string {
  return s.dose_override ?? s.dose ?? ''
}

export const STATUS_CONFIG: Record<SupplementStatus, { label: string; cls: string }> = {
  active:        { label: '',            cls: '' },
  on_order:      { label: 'incoming',    cls: 'bg-amber-100 text-amber-700 border border-amber-200' },
  need_to_order: { label: 'needs order', cls: 'bg-rose-100 text-rose-700 border border-rose-200' },
  sidelined:     { label: 'sidelined',   cls: 'bg-bark-100 text-bark-400 border border-bark-200' },
}

// ─── Fenben cycle utilities ──────────────────────────────────────────────────

export function getCycleDayNumber(startDateStr: string, targetDateStr: string): number {
  const start = new Date(startDateStr + 'T00:00:00')
  const target = new Date(targetDateStr + 'T00:00:00')
  const diffDays = Math.floor((target.getTime() - start.getTime()) / 86400000)
  if (diffDays < 0) return -1
  return (diffDays % 7) + 1 // 1–7
}

export function isFenbenOnDay(startDateStr: string, targetDateStr: string): boolean {
  const day = getCycleDayNumber(startDateStr, targetDateStr)
  return day >= 1 && day <= 3
}

export function daysUntilPhaseChange(startDateStr: string, targetDateStr: string): number {
  const day = getCycleDayNumber(startDateStr, targetDateStr)
  if (day < 1) return 0
  if (day <= 3) return 3 - day + 1
  return 7 - day + 1
}

// ─── Date / time utilities ───────────────────────────────────────────────────

export function todayStr(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function formatDateDisplay(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
}

export function formatTimeDisplay(isoStr: string): string {
  const d = new Date(isoStr)
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
}

// ─── Static protocol data ────────────────────────────────────────────────────

export const TOPICAL_PRODUCTS = [
  'Manuka Honey',
  'DMSO/Castor Blend',
  'Frankincense EO',
  'Melissa EO',
  'Rosemary EO',
  'Lavender EO',
  'Peppermint EO',
  'Arnica Salve',
]

export const SKIN_REACTIONS = ['None', 'Mild redness', 'Moderate redness', 'Itching', 'Burning sensation']

export const GABAPENTIN_REASONS = [
  'Limping / lameness',
  'Visible discomfort',
  'Restlessness',
  'Night pacing',
  'Crying / vocalizing',
  'Reluctance to move',
  'Other',
]
