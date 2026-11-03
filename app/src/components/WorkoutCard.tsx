import type { CSSProperties, PointerEventHandler } from 'react'
import type { Workout } from '../engine/types'
import { formatDuration } from '../engine/format'
import { phaseColor, workoutSummary } from '../engine/summary'
import { useStore } from '../store'
import './WorkoutCard.css'

interface Props {
  workout: Workout
  onOpen: () => void
  onPlay: () => void
  onMore: () => void
  style?: CSSProperties
  dragging?: boolean
  onPointerDown?: PointerEventHandler<HTMLElement>
}

export function WorkoutCard({ workout: w, onOpen, onPlay, onMore, style, dragging, onPointerDown }: Props) {
  const settings = useStore((st) => st.settings)
  const s = workoutSummary(w, settings)
  return (
    <article className={dragging ? 'wcard dragging' : 'wcard'} style={style} onPointerDown={onPointerDown}>
      <div className="wcard-top">
        <button className="wcard-open" onClick={onOpen}>
          <h2 className="display wcard-name">
            {w.favorite && (
              <svg className="wcard-star" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-label="Preferito" role="img">
                <path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z" />
              </svg>
            )}
            {w.name}
          </h2>
          <span className="wcard-detail">{s.detail}</span>
        </button>
        <button className="icon-btn" aria-label={`Altre azioni per ${w.name}`} onClick={onMore}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <circle cx="5" cy="12" r="2" />
            <circle cx="12" cy="12" r="2" />
            <circle cx="19" cy="12" r="2" />
          </svg>
        </button>
      </div>
      <div className="wcard-bar" aria-hidden="true">
        {s.segments.map((seg, i) => (
          <span key={i} style={{ flexGrow: seg.grow, background: phaseColor[seg.kind] }} />
        ))}
      </div>
      <div className="wcard-bottom">
        <div className="wcard-total">
          <span className="display num wcard-time">{formatDuration(s.total)}</span>
          <span className="wcard-intervals">{s.intervals} intervalli</span>
        </div>
        <button className="play-btn" aria-label={`Avvia ${w.name}`} onClick={onPlay}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.2-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z" />
          </svg>
        </button>
      </div>
    </article>
  )
}
