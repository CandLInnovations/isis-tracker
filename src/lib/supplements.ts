export type Supplement = {
  id: string
  name: string
  dose: string
  active: boolean
  note?: string
  onOrder?: boolean
}

export type SupplementGroup = {
  label: string
  key: 'morning' | 'evening' | 'meal'
  supplements: Supplement[]
}

export const SUPPLEMENT_GROUPS: SupplementGroup[] = [
  {
    label: 'Morning Treat',
    key: 'morning',
    supplements: [
      { id: 'am_turmeric',      name: 'Turmeric',               dose: '1.5–2 tsp',  active: true },
      { id: 'am_black_pepper',  name: 'Black Pepper',            dose: '¼ tsp',      active: true },
      { id: 'am_ginger',        name: 'Ginger',                  dose: '¼ tsp',      active: true },
      { id: 'am_ashwagandha',   name: 'Ashwagandha',             dose: '300–500mg',  active: true },
      { id: 'am_barberry',      name: 'Barberry Root Bark',      dose: '1 tsp',      active: true },
      { id: 'am_milk_thistle',  name: 'Milk Thistle Seed',       dose: '1 tsp',      active: true },
      { id: 'am_vitex',         name: 'Vitex Berry',             dose: '¼ tsp',      active: true },
      { id: 'am_msm',           name: 'MSM',                     dose: '1000mg',     active: true },
      { id: 'am_chondroitin',   name: 'Chondroitin',             dose: '800–1200mg', active: true },
      { id: 'am_cbd',           name: 'CBD Isolate',             dose: '1 dropper',  active: true },
      { id: 'am_dandelion',     name: 'Dandelion Root',          dose: '1 tsp',      active: true },
      { id: 'am_creatine',      name: 'Creatine Micronized',     dose: '1 tsp',      active: true },
      { id: 'am_citicoline',    name: 'Citicoline Sodium',       dose: '¼ tsp',      active: true },
      { id: 'am_apricot',       name: 'Bitter Apricot Seeds',    dose: 'few seeds',  active: true },
      { id: 'am_frankincense',  name: 'Frankincense Resin Powder', dose: '⅛ tsp (300–500mg)', active: true },
      { id: 'am_vit_e',         name: 'Vitamin E Succinate',     dose: '400IU',      active: false, onOrder: true },
      { id: 'am_turkey_tail',   name: 'Turkey Tail',             dose: '500–1000mg', active: false, onOrder: true },
      { id: 'am_quercetin',     name: 'Quercetin',               dose: '500mg',      active: false, onOrder: true },
    ],
  },
  {
    label: 'Evening Treat',
    key: 'evening',
    supplements: [
      { id: 'pm_turmeric',      name: 'Turmeric',               dose: '1.5–2 tsp',  active: true },
      { id: 'pm_boswellia',     name: 'Boswellia',              dose: '500mg',      active: true },
      { id: 'pm_cats_claw',     name: "Cat's Claw",             dose: '300mg',      active: true },
      { id: 'pm_milk_thistle',  name: 'Milk Thistle Seed',      dose: '1 tsp',      active: true },
      { id: 'pm_nettle',        name: 'Nettle',                 dose: '1 tsp',      active: true },
      { id: 'pm_apricot',       name: 'Bitter Apricot Seeds',   dose: 'few seeds',  active: true },
    ],
  },
  {
    label: 'With Raw Meal',
    key: 'meal',
    supplements: [
      { id: 'meal_gelatin',  name: 'Grass Fed Gelatin',  dose: '1 tbsp',  active: true },
    ],
  },
]

export const ALL_SUPPLEMENTS: Supplement[] = SUPPLEMENT_GROUPS.flatMap(g => g.supplements)

export const ON_ORDER_IDS = ['am_vit_e', 'am_turkey_tail', 'am_quercetin']

// Fenben cycle utilities
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
  if (day <= 3) return 3 - day + 1 // days remaining in ON phase
  return 7 - day + 1               // days remaining in OFF phase
}

export function todayStr(): string {
  return new Date().toISOString().split('T')[0]
}

export function formatDateDisplay(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
}

export function formatTimeDisplay(isoStr: string): string {
  const d = new Date(isoStr)
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
}

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
