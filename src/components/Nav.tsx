'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV_LINKS = [
  { href: '/',             label: 'Dashboard' },
  { href: '/fenben',       label: 'Fenben' },
  { href: '/supplements',  label: 'Supplements' },
  { href: '/topical',      label: 'Topical' },
  { href: '/medications',  label: 'Gabapentin' },
  { href: '/observations', label: 'Observations' },
  { href: '/weight',       label: 'Weight' },
]

export default function Nav() {
  const pathname = usePathname()

  return (
    <header className="sticky top-0 z-50 bg-bark-800 shadow-md">
      <div className="max-w-6xl mx-auto px-4">
        {/* Top bar */}
        <div className="flex items-center gap-3 py-3 border-b border-bark-700">
          <span className="text-2xl">🐾</span>
          <div>
            <span className="text-cream font-serif text-xl font-bold tracking-wide">Isis</span>
            <span className="text-bark-300 font-serif text-xs ml-2">Great Dane · Protocol Tracker</span>
          </div>
        </div>

        {/* Nav links */}
        <nav className="flex overflow-x-auto gap-1 py-1.5 scrollbar-none">
          {NAV_LINKS.map(({ href, label }) => {
            const active = href === '/' ? pathname === '/' : pathname.startsWith(href)
            return (
              <Link
                key={href}
                href={href}
                className={`whitespace-nowrap px-3 py-1.5 rounded-md text-sm font-serif transition-colors duration-150 ${
                  active
                    ? 'bg-bark-600 text-cream'
                    : 'text-bark-200 hover:bg-bark-700 hover:text-cream'
                }`}
              >
                {label}
              </Link>
            )
          })}
        </nav>
      </div>
    </header>
  )
}
