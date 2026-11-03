import { useEffect, type ReactNode } from 'react'
import './Sheet.css'

interface Props {
  open: boolean
  onClose: () => void
  title?: string
  children: ReactNode
}

/** Pannello che sale dal basso, chiuso toccando lo sfondo o con Esc. */
export function Sheet({ open, onClose, title, children }: Props) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-grip" aria-hidden="true" />
        {title && <h2 className="sheet-title">{title}</h2>}
        {children}
      </div>
    </div>
  )
}

export interface SheetAction {
  label: string
  icon: ReactNode
  onSelect: () => void
  danger?: boolean
}

export function ActionList({ actions }: { actions: SheetAction[] }) {
  return (
    <ul className="sheet-actions">
      {actions.map((a) => (
        <li key={a.label}>
          <button className={a.danger ? 'sheet-action danger' : 'sheet-action'} onClick={a.onSelect}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              {a.icon}
            </svg>
            {a.label}
          </button>
        </li>
      ))}
    </ul>
  )
}
