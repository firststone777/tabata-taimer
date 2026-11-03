import { useEffect, useRef, useState, type PointerEvent as RPointerEvent } from 'react'
import { useStore } from '../store'
import { WorkoutCard } from '../components/WorkoutCard'
import { ActionList, Sheet, type SheetAction } from '../components/Sheet'
import { newWorkout } from '../data/defaults'
import { shareWorkout } from '../data/share'
import { formatDuration } from '../engine/format'
import { workoutSummary } from '../engine/summary'
import type { Workout } from '../engine/types'
import { primeMedia } from '../audio/start'
import './Home.css'

const logo = `${import.meta.env.BASE_URL}icons/icon-192.png`
const GAP = 14
const LONG_PRESS_MS = 450

type Filter = 'all' | 'favorites' | 'recent'
type Panel = { kind: 'actions' | 'notes' | 'delete'; workout: Workout } | null

interface Drag {
  from: number
  to: number
  dy: number
  startY: number
  mids: number[]
  height: number
}

export function Home() {
  const { workouts, settings, storageError, save, remove, duplicate, move, navigate } = useStore()
  const [filter, setFilter] = useState<Filter>('all')
  const [panel, setPanel] = useState<Panel>(null)
  const [notes, setNotes] = useState('')
  const [toast, setToast] = useState('')
  const [drag, setDrag] = useState<Drag | null>(null)

  const listRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<Drag | null>(null)
  const press = useRef<{ timer: number; y: number; index: number } | null>(null)
  const suppressClick = useRef(false)

  const visible =
    filter === 'favorites'
      ? workouts.filter((w) => w.favorite)
      : filter === 'recent'
        ? workouts.filter((w) => w.lastUsedAt > 0).sort((a, b) => b.lastUsedAt - a.lastUsedAt)
        : workouts
  const totalMin = Math.round(workouts.reduce((s, w) => s + workoutSummary(w, settings).total, 0) / 60)

  // Durante il trascinamento iOS non deve scorrere la pagina.
  useEffect(() => {
    const el = listRef.current
    if (!el) return
    const block = (e: TouchEvent) => dragRef.current && e.preventDefault()
    el.addEventListener('touchmove', block, { passive: false })
    return () => el.removeEventListener('touchmove', block)
  }, [])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(''), 2200)
    return () => clearTimeout(t)
  }, [toast])

  const updateDrag = (d: Drag | null) => {
    dragRef.current = d
    setDrag(d)
  }

  function onPointerDown(e: RPointerEvent<HTMLElement>, index: number) {
    if (filter !== 'all' || (e.target as Element).closest('.icon-btn, .play-btn')) return
    const y = e.clientY
    const target = e.currentTarget
    const pointerId = e.pointerId
    press.current = {
      y,
      index,
      timer: window.setTimeout(() => {
        const cards = [...(listRef.current?.querySelectorAll<HTMLElement>('.wcard') ?? [])]
        const rects = cards.map((c) => c.getBoundingClientRect())
        target.setPointerCapture?.(pointerId)
        updateDrag({ from: index, to: index, dy: 0, startY: y, mids: rects.map((r) => r.top + r.height / 2), height: rects[index].height })
      }, LONG_PRESS_MS),
    }
  }

  function onPointerMove(e: RPointerEvent) {
    const d = dragRef.current
    if (!d) {
      if (press.current && Math.abs(e.clientY - press.current.y) > 8) cancelPress()
      return
    }
    const dy = e.clientY - d.startY
    const center = d.mids[d.from] + dy
    let to = d.from
    d.mids.forEach((m, i) => {
      if (i < d.from && center < m) to = Math.min(to, i)
      if (i > d.from && center > m) to = Math.max(to, i)
    })
    updateDrag({ ...d, dy, to })
  }

  function onPointerUp() {
    cancelPress()
    const d = dragRef.current
    if (!d) return
    suppressClick.current = true
    setTimeout(() => (suppressClick.current = false), 50)
    updateDrag(null)
    if (d.to !== d.from) move(d.from, d.to)
  }

  function cancelPress() {
    if (press.current) clearTimeout(press.current.timer)
    press.current = null
  }

  function cardStyle(i: number) {
    if (!drag) return undefined
    if (i === drag.from) return { transform: `translateY(${drag.dy}px) scale(1.02)` }
    const shift = drag.height + GAP
    if (drag.from < drag.to && i > drag.from && i <= drag.to) return { transform: `translateY(${-shift}px)` }
    if (drag.to < drag.from && i >= drag.to && i < drag.from) return { transform: `translateY(${shift}px)` }
    return undefined
  }

  const guard = (fn: () => void) => () => !suppressClick.current && fn()

  async function create() {
    const w = newWorkout()
    await save(w)
    navigate({ name: 'editor', workoutId: w.id, isNew: true })
  }

  const actions = (w: Workout): SheetAction[] => [
    { label: 'Modifica', icon: <path d="M4 20h4L19 9l-4-4L4 16v4zM14 6l4 4" />, onSelect: () => (setPanel(null), navigate({ name: 'editor', workoutId: w.id })) },
    {
      label: w.favorite ? 'Togli dai preferiti' : 'Aggiungi ai preferiti',
      icon: <path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z" />,
      onSelect: () => (setPanel(null), save({ ...w, favorite: !w.favorite })),
    },
    { label: 'Note', icon: <path d="M6 3h9l4 4v14H6zM9 11h7M9 15h7M9 7h3" />, onSelect: () => (setNotes(w.notes), setPanel({ kind: 'notes', workout: w })) },
    {
      label: 'Duplica',
      icon: <path d="M9 9h11v11H9zM5 15H4V4h11v1" />,
      onSelect: () => (setPanel(null), duplicate(w.id), setToast('Allenamento duplicato')),
    },
    {
      label: 'Condividi',
      icon: <path d="M12 3v12M7 8l5-5 5 5M5 13v7h14v-7" />,
      onSelect: async () => {
        setPanel(null)
        if ((await shareWorkout(w)) === 'downloaded') setToast('File scaricato')
      },
    },
    { label: 'Elimina', danger: true, icon: <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" />, onSelect: () => setPanel({ kind: 'delete', workout: w }) },
  ]

  return (
    <div className="home">
      <header className="home-header">
        <img src={logo} alt="" className="home-logo" />
        <div>
          <h1 className="display home-title">
            Tabata t<span className="ai">AI</span>mer
          </h1>
          <p className="home-sub">
            {workouts.length === 0
              ? 'Nessun allenamento'
              : `${workouts.length} ${workouts.length === 1 ? 'allenamento' : 'allenamenti'} · ${totalMin} min totali`}
          </p>
        </div>
      </header>

      {storageError && (
        <p className="storage-warn" role="alert">
          Il salvataggio non è disponibile su questo browser: le modifiche andranno perse alla chiusura.
        </p>
      )}

      {workouts.length > 0 && (
        <div className="chips" role="group" aria-label="Filtra">
          {(
            [
              ['all', 'Tutti'],
              ['favorites', 'Preferiti'],
              ['recent', 'Recenti'],
            ] as const
          ).map(([id, label]) => (
            <button key={id} className={filter === id ? 'chip on' : 'chip'} aria-pressed={filter === id} onClick={() => setFilter(id)}>
              {label}
            </button>
          ))}
        </div>
      )}

      <div ref={listRef} className="wlist" onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}>
        {visible.map((w, i) => (
          <WorkoutCard
            key={w.id}
            workout={w}
            dragging={drag?.from === i}
            style={cardStyle(i)}
            onPointerDown={(e) => onPointerDown(e, i)}
            onOpen={guard(() => navigate({ name: 'editor', workoutId: w.id }))}
            onPlay={() => {
              primeMedia(settings)
              navigate({ name: 'timer', workoutId: w.id })
            }}
            onMore={() => setPanel({ kind: 'actions', workout: w })}
          />
        ))}
        {visible.length === 0 && (
          <section className="empty">
            <p className="display empty-title">{filter === 'all' ? 'Il tempo è tuo.' : 'Niente qui, per ora.'}</p>
            <p className="empty-text">
              {filter === 'all'
                ? 'Crea il primo allenamento con «Nuovo».'
                : filter === 'favorites'
                  ? 'Aggiungi un preferito dal menu ⋯ di un allenamento.'
                  : 'Gli allenamenti avviati compariranno qui.'}
            </p>
          </section>
        )}
        {filter === 'all' && workouts.length > 1 && <p className="hint">Tieni premuto un allenamento per spostarlo</p>}
      </div>

      <button className="fab" onClick={create}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
          <path d="M12 5v14M5 12h14" />
        </svg>
        Nuovo
      </button>

      <Sheet open={panel?.kind === 'actions'} onClose={() => setPanel(null)} title={panel?.workout.name}>
        {panel && <ActionList actions={actions(panel.workout)} />}
      </Sheet>

      <Sheet open={panel?.kind === 'notes'} onClose={() => setPanel(null)} title="Note">
        <label className="visually-hidden" htmlFor="notes">
          Note
        </label>
        <textarea id="notes" className="notes-input" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Esercizi, carichi, sensazioni…" rows={6} />
        <div className="sheet-buttons">
          <button className="btn" onClick={() => setPanel(null)}>
            Annulla
          </button>
          <button className="btn primary" onClick={() => panel && (save({ ...panel.workout, notes }), setPanel(null))}>
            Salva
          </button>
        </div>
      </Sheet>

      <Sheet open={panel?.kind === 'delete'} onClose={() => setPanel(null)} title="Eliminare l’allenamento?">
        {panel && (
          <p className="confirm-text">
            «{panel.workout.name}» ({formatDuration(workoutSummary(panel.workout, settings).total)}) verrà eliminato definitivamente.
          </p>
        )}
        <div className="sheet-buttons">
          <button className="btn" onClick={() => setPanel(null)}>
            Annulla
          </button>
          <button className="btn danger" onClick={() => panel && (remove(panel.workout.id), setPanel(null))}>
            Elimina
          </button>
        </div>
      </Sheet>

      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </div>
  )
}
