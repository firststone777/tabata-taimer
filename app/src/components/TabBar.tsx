import type { ReactNode } from 'react'
import './TabBar.css'

export type Tab = 'workouts' | 'stats' | 'settings'

const tabs: { id: Tab; label: string; icon: ReactNode }[] = [
  {
    id: 'workouts',
    label: 'Allenamenti',
    icon: (
      <>
        <circle cx="12" cy="13" r="8" />
        <path d="M12 9v4l2.5 2M10 2h4" />
      </>
    ),
  },
  {
    id: 'stats',
    label: 'Statistiche',
    icon: <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />,
  },
  {
    id: 'settings',
    label: 'Impostazioni',
    icon: (
      <>
        <path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0" />
        <circle cx="16" cy="6" r="2" />
        <circle cx="10" cy="12" r="2" />
        <circle cx="18" cy="18" r="2" />
      </>
    ),
  },
]

export function TabBar({ active, onChange }: { active: Tab; onChange: (t: Tab) => void }) {
  return (
    <nav className="tabbar" aria-label="Navigazione principale">
      {tabs.map((t) => (
        <button
          key={t.id}
          className={t.id === active ? 'tab active' : 'tab'}
          aria-current={t.id === active ? 'page' : undefined}
          onClick={() => onChange(t.id)}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            {t.icon}
          </svg>
          {t.label}
        </button>
      ))}
    </nav>
  )
}
