import { useEffect, useLayoutEffect, useRef } from 'react'
import { shortDuration } from '../engine/summary'
import './Stepper.css'

interface Props {
  label: string
  value: number
  onChange: (v: number) => void
  min?: number
  max?: number
  /** se true il valore è in secondi e si mostra come durata */
  time?: boolean
  /** tocco sul valore: apre l'inserimento diretto */
  onValueTap?: () => void
}

/** −/+ con ripetizione accelerata tenendo premuto. */
export function Stepper({ label, value, onChange, min = 0, max = 5999, time, onValueTap }: Props) {
  const valueRef = useRef(value)
  const timer = useRef<number | null>(null)
  useLayoutEffect(() => {
    valueRef.current = value
  }, [value])

  const stop = () => {
    if (timer.current !== null) clearTimeout(timer.current)
    timer.current = null
  }
  useEffect(() => stop, [])

  const step = (dir: 1 | -1, count: number) => {
    // dopo qualche ripetizione i tempi avanzano di 5 s
    const inc = time && count > 8 ? 5 : 1
    let next = valueRef.current + dir * inc
    if (inc === 5) next = dir > 0 ? Math.ceil(next / 5) * 5 : Math.floor(next / 5) * 5
    next = Math.min(max, Math.max(min, next))
    if (next !== valueRef.current) {
      valueRef.current = next
      onChange(next)
    }
  }

  const startHold = (dir: 1 | -1) => {
    stop()
    step(dir, 0)
    let count = 0
    const tick = () => {
      count++
      step(dir, count)
      timer.current = window.setTimeout(tick, count > 8 ? 70 : 140)
    }
    timer.current = window.setTimeout(tick, 400)
  }

  const shown = time ? (value === 0 ? '—' : shortDuration(value)) : String(value)

  return (
    <div className="stepper">
      <button
        className="step-btn minus"
        aria-label={`Diminuisci ${label}`}
        disabled={value <= min}
        onPointerDown={() => startHold(-1)}
        onPointerUp={stop}
        onPointerLeave={stop}
        onPointerCancel={stop}
        onContextMenu={(e) => e.preventDefault()}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
          <path d="M5 12h14" />
        </svg>
      </button>
      <button className="display num step-value" aria-label={`${label}: ${shown}. Tocca per inserire`} onClick={onValueTap} disabled={!onValueTap}>
        {shown}
      </button>
      <button
        className="step-btn plus"
        aria-label={`Aumenta ${label}`}
        disabled={value >= max}
        onPointerDown={() => startHold(1)}
        onPointerUp={stop}
        onPointerLeave={stop}
        onPointerCancel={stop}
        onContextMenu={(e) => e.preventDefault()}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
          <path d="M12 5v14M5 12h14" />
        </svg>
      </button>
    </div>
  )
}
