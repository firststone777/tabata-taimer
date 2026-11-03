import { useState } from 'react'
import { Sheet } from './Sheet'
import './DurationSheet.css'

interface Props {
  open: boolean
  title: string
  seconds: number
  onClose: () => void
  onConfirm: (seconds: number) => void
}

/** Inserimento diretto di minuti e secondi. */
export function DurationSheet({ open, title, seconds, onClose, onConfirm }: Props) {
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <DurationForm seconds={seconds} onClose={onClose} onConfirm={onConfirm} />
    </Sheet>
  )
}

/** Montato solo a pannello aperto, così parte sempre dal valore attuale. */
function DurationForm({ seconds, onClose, onConfirm }: Omit<Props, 'open' | 'title'>) {
  const [m, setM] = useState(String(Math.floor(seconds / 60)))
  const [s, setS] = useState(String(seconds % 60))
  const total = Math.min(5999, (parseInt(m, 10) || 0) * 60 + (parseInt(s, 10) || 0))

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        onConfirm(total)
      }}
    >
      <div className="dur-fields">
        <label className="dur-field">
          <input inputMode="numeric" pattern="[0-9]*" maxLength={2} value={m} onChange={(e) => setM(e.target.value.replace(/\D/g, ''))} onFocus={(e) => e.target.select()} />
          <span>min</span>
        </label>
        <span className="display dur-colon" aria-hidden="true">
          :
        </span>
        <label className="dur-field">
          <input inputMode="numeric" pattern="[0-9]*" maxLength={2} value={s} onChange={(e) => setS(e.target.value.replace(/\D/g, ''))} onFocus={(e) => e.target.select()} />
          <span>sec</span>
        </label>
      </div>
      <div className="sheet-buttons">
        <button type="button" className="btn" onClick={onClose}>
          Annulla
        </button>
        <button type="submit" className="btn primary">
          Imposta
        </button>
      </div>
    </form>
  )
}
