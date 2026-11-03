import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useStore } from '../store'
import { Sheet } from '../components/Sheet'
import { buildSequence, startTimes } from '../engine/sequence'
import { cuesBetween, elapsedMs, newClock, nextTarget, pause, positionAt, prevTarget, seek, start, type ClockState, type Cue } from '../engine/clock'
import { formatDuration } from '../engine/format'
import { shortDuration } from '../engine/summary'
import type { Interval } from '../engine/types'
import { loadClips, playClip, setVolume, sounds, unlockAudio, type Clip } from '../audio/sound'
import { speak, stopSpeaking } from '../audio/voice'
import { createWakeLock } from '../audio/wakeLock'
import { music } from '../audio/music'
import './Timer.css'

const RING_R = 145
const RING_C = 2 * Math.PI * RING_R

const PHASE_CLIP: Record<Interval['kind'], Clip> = {
  prepare: 'preparati',
  work: 'via',
  rest: 'riposo',
  setRest: 'riposoLungo',
  cooldown: 'defaticamento',
}

/** Ritardo della voce dopo il segnale di cambio fase, così non si sovrappongono. */
const VOICE_DELAY = 0.45

export function Timer({ workoutId }: { workoutId: string }) {
  const workout = useStore((s) => s.workouts.find((w) => w.id === workoutId))
  const { settings, setSettings, save, navigate, addSession } = useStore()

  const seq = useMemo(() => (workout ? buildSequence(workout, settings) : []), [workout, settings])
  const starts = useMemo(() => startTimes(seq), [seq])

  const [clock, setClock] = useState<ClockState>(newClock)
  const [now, setNow] = useState(() => performance.now())
  const [muted, setMuted] = useState(false)
  const [confirmExit, setConfirmExit] = useState(false)
  const lastMs = useRef(0)
  const clockRef = useRef(clock)
  useLayoutEffect(() => {
    clockRef.current = clock
  }, [clock])
  const wake = useRef<ReturnType<typeof createWakeLock> | null>(null)

  const elapsed = elapsedMs(clock, now)
  const pos = positionAt(seq, starts, elapsed)
  const running = clock.runningSince !== null && !pos.done

  const audible = settings.sounds && !muted
  const talks = settings.voice && !muted
  const lastWork = useMemo(() => seq.findLastIndex((i) => i.kind === 'work'), [seq])

  /** Annuncio vocale di un intervallo: clip fissa, o nome dell'esercizio se richiesto. */
  const announce = useCallback(
    (index: number, delay = VOICE_DELAY) => {
      const iv = seq[index]
      if (!iv || !talks) return
      if (iv.kind === 'work' && settings.speakNames && iv.label !== 'Lavoro') speak(iv.label)
      else playClip(iv.kind === 'work' && index === lastWork && index > 0 ? 'ultimo' : PHASE_CLIP[iv.kind], delay)
    },
    [seq, talks, settings.speakNames, lastWork],
  )

  const playCue = useCallback(
    (c: Cue) => {
      if (c.type === 'countdown') {
        if (audible) sounds.tick()
      } else if (c.type === 'halfway') {
        if (audible) sounds.halfway()
        if (talks) playClip('meta', 0.2)
      } else if (c.type === 'phase') {
        if (audible) (c.interval.kind === 'work' ? sounds.work : sounds.rest)()
        announce(c.index, audible ? VOICE_DELAY : 0)
      } else {
        if (audible) sounds.finish()
        if (talks) playClip('fine', 0.9)
      }
    },
    [audible, talks, announce],
  )

  // avvio automatico: il tocco che ha aperto il timer ha già sbloccato l'audio
  useEffect(() => {
    if (!workout || seq.length === 0) return
    const t = performance.now()
    setClock(start(newClock(), t))
    lastMs.current = 0
    startedAt.current = Date.now()
    save({ ...workout, lastUsedAt: Date.now() })
    const first = seq[0]
    if (settings.sounds) (first.kind === 'work' ? sounds.work : sounds.rest)()
    // le clip si caricano dal tocco di avvio: la prima volta possono servire alcuni ms
    void Promise.resolve(loadClips()).then(() => announce(0, 0.3))
    // solo al montaggio
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => setVolume(settings.volume), [settings.volume])

  // schermo acceso durante l'esecuzione
  useEffect(() => {
    if (!settings.keepAwake) return
    const w = createWakeLock()
    wake.current = w
    return () => {
      w.dispose()
      wake.current = null
    }
  }, [settings.keepAwake])
  useEffect(() => {
    if (running) wake.current?.enable()
    else wake.current?.disable()
  }, [running])

  // ciclo di aggiornamento + segnali
  useEffect(() => {
    if (!running) return
    let raf = 0
    const frame = () => {
      const t = performance.now()
      const ms = elapsedMs(clockRef.current, t)
      const cues = cuesBetween(seq, starts, lastMs.current, ms, { countdown: settings.countdown, halfway: settings.halfway })
      lastMs.current = ms
      cues.forEach(playCue)
      setNow(t)
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [running, seq, starts, settings.countdown, settings.halfway, playCue])

  // chiamata, blocco schermo, cambio app: pausa
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === 'hidden' && settings.pauseOnHide) {
        setClock((c) => pause(c, performance.now()))
        stopSpeaking()
      }
    }
    document.addEventListener('visibilitychange', onHide)
    return () => document.removeEventListener('visibilitychange', onHide)
  }, [settings.pauseOnHide])

  useEffect(() => stopSpeaking, [])

  // musica per intervallo: segue fase e pausa
  const phaseKind = running ? pos.interval?.kind ?? null : null
  useEffect(() => {
    if (settings.music) music.setPhase(phaseKind)
  }, [settings.music, phaseKind])
  useEffect(() => () => music.pause(), [])

  // statistiche: una sessione a fine allenamento, o all'uscita dopo almeno 30 s
  const startedAt = useRef(0)
  const recorded = useRef(false)
  const record = useCallback(
    (completed: boolean, ms: number) => {
      if (recorded.current || !workout) return
      recorded.current = true
      void addSession({ workoutId: workout.id, workoutName: workout.name, startedAt: startedAt.current, activeSeconds: Math.round(ms / 1000), completed })
    },
    [workout, addSession],
  )
  const totalTimelineMs = starts[starts.length - 1]
  useEffect(() => {
    if (pos.done) record(true, totalTimelineMs)
  }, [pos.done, record, totalTimelineMs])

  if (!workout) return null

  const toggle = () => {
    unlockAudio()
    const t = performance.now()
    setNow(t)
    setClock((c) => (c.runningSince === null ? start(c, t) : pause(c, t)))
  }

  const jump = (toMs: number) => {
    const t = performance.now()
    lastMs.current = toMs
    setNow(t)
    setClock((c) => seek(c, toMs, t))
    const p = positionAt(seq, starts, toMs)
    if (p.interval) announce(p.index, 0)
  }

  const restart = () => {
    startedAt.current = Date.now()
    recorded.current = false
    const t = performance.now()
    lastMs.current = 0
    setNow(t)
    setClock(start(newClock(), t))
    announce(0, 0)
  }

  const exit = () => {
    if (!pos.done && pos.totalElapsedMs >= 30_000) record(false, pos.totalElapsedMs)
    stopSpeaking()
    navigate({ name: 'tabs' })
  }
  const requestExit = () => (pos.done || !settings.confirmExit ? exit() : setConfirmExit(true))

  if (pos.done) {
    return (
      <div className="timer t-done">
        <div className="done-body">
          <svg width="72" height="72" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <path d="M7.5 12.5l3 3 6-7" />
          </svg>
          <h1 className="display done-title">Completato</h1>
          <p className="done-sub">{workout.name}</p>
          <p className="display num done-time">{formatDuration(starts[starts.length - 1] / 1000)}</p>
          <p className="done-sub">{seq.filter((i) => i.kind === 'work').length} intervalli di lavoro</p>
        </div>
        <div className="done-actions">
          <button className="btn" onClick={restart}>
            Ripeti
          </button>
          <button className="btn primary" onClick={exit}>
            Fine
          </button>
        </div>
      </div>
    )
  }

  const iv = pos.interval!
  const progress = pos.intoMs / (iv.duration * 1000)
  const upcoming = seq.slice(pos.index + 1, pos.index + 3)
  const big = pos.display >= 60 ? shortDuration(pos.display) : String(pos.display)
  const where =
    iv.cycle > 0 ? `ciclo ${iv.cycle} di ${iv.cycles}${iv.sets > 1 ? ` · set ${iv.set} di ${iv.sets}` : ''}` : iv.kind === 'setRest' ? `set ${iv.set} di ${iv.sets} fatto` : ''
  const totalMs = starts[starts.length - 1]

  return (
    <div className={`timer t-${iv.kind}`}>
      <header className="t-header">
        <button className="t-icon" aria-label="Termina allenamento" onClick={requestExit}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
        <span className="t-where">
          {workout.name}
          {where && ` · ${where}`}
        </span>
        <button className="t-icon" aria-label={muted ? 'Riattiva audio' : 'Silenzia'} aria-pressed={muted} onClick={() => setMuted((m) => !m)}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M11 5L6 9H3v6h3l5 4V5z" />
            {muted ? <path d="M16 9l5 6M21 9l-5 6" /> : <path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" />}
          </svg>
        </button>
      </header>

      <div className="t-progress">
        <div className="t-bar" role="progressbar" aria-label="Avanzamento allenamento" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round((elapsed / totalMs) * 100)}>
          <div style={{ width: `${(elapsed / totalMs) * 100}%` }} />
        </div>
        <div className="num t-times">
          <span>{formatDuration(Math.floor(pos.totalElapsedMs / 1000))} trascorsi</span>
          <span>{formatDuration(Math.ceil(pos.totalRemainingMs / 1000))} rimanenti</span>
        </div>
      </div>

      <div className="t-ring" aria-live="off">
        <svg viewBox="0 0 310 310" aria-hidden="true">
          <circle className="ring-track" cx="155" cy="155" r={RING_R} />
          <circle className="ring-fill" cx="155" cy="155" r={RING_R} strokeDasharray={RING_C} strokeDashoffset={RING_C * progress} transform="rotate(-90 155 155)" />
        </svg>
        <div className="t-center">
          <span className="t-phase">{running ? phaseName(iv) : 'IN PAUSA'}</span>
          <span className={big.length > 2 ? 'display num t-count long' : 'display num t-count'}>{big}</span>
          {iv.kind === 'work' && iv.label !== 'Lavoro' && <span className="display t-label">{iv.label}</span>}
          {iv.kind !== 'work' && upcoming[0]?.kind === 'work' && <span className="t-next-hint">Poi: {upcoming[0].label}</span>}
        </div>
      </div>

      <section className="t-upcoming" aria-label="Prossimi intervalli">
        {upcoming.length > 0 && <span className="t-up-title">A SEGUIRE</span>}
        {upcoming.map((u, i) => (
          <div key={pos.index + 1 + i} className={i === 0 ? 't-up first' : 't-up'}>
            <span className={`t-up-dot k-${u.kind}`} aria-hidden="true" />
            <span className="t-up-label">{u.label}</span>
            <span className="display num">{shortDuration(u.duration)}</span>
          </div>
        ))}
      </section>

      <footer className="t-controls">
        <button className="t-ctrl" aria-label="Intervallo precedente" onClick={() => jump(prevTarget(starts, pos.index, pos.intoMs))}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M6 5h2v14H6zM20 5.8v12.4a.8.8 0 0 1-1.2.7L9.5 12.7a.8.8 0 0 1 0-1.4l9.3-6.2a.8.8 0 0 1 1.2.7z" />
          </svg>
        </button>
        <button className="t-main" aria-label={running ? 'Pausa' : 'Riprendi'} onClick={toggle}>
          {running ? (
            <svg width="30" height="30" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <rect x="6" y="5" width="4" height="14" rx="1" />
              <rect x="14" y="5" width="4" height="14" rx="1" />
            </svg>
          ) : (
            <svg width="30" height="30" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.2-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z" />
            </svg>
          )}
        </button>
        <button className="t-ctrl" aria-label="Intervallo successivo" onClick={() => jump(nextTarget(starts, pos.index))}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M16 5h2v14h-2zM4 5.8v12.4a.8.8 0 0 0 1.2.7l9.3-6.2a.8.8 0 0 0 0-1.4L5.2 5.1A.8.8 0 0 0 4 5.8z" />
          </svg>
        </button>
      </footer>

      <Sheet open={confirmExit} onClose={() => setConfirmExit(false)} title="Terminare l’allenamento?">
        <p className="confirm-text">I progressi di questa sessione andranno persi.</p>
        <div className="sheet-buttons">
          <button className="btn" onClick={() => setConfirmExit(false)}>
            Continua
          </button>
          <button className="btn danger" onClick={exit}>
            Termina
          </button>
        </div>
        <button
          className="btn"
          style={{ width: '100%', marginTop: 10, border: 'none', color: 'var(--muted)' }}
          onClick={() => {
            void setSettings({ confirmExit: false })
            exit()
          }}
        >
          Termina e non chiedere più
        </button>
      </Sheet>
    </div>
  )
}

function phaseName(iv: Interval): string {
  return { prepare: 'PREPARATI', work: 'LAVORO', rest: 'RIPOSO', setRest: 'RIPOSO LUNGO', cooldown: 'DEFATICAMENTO' }[iv.kind]
}
