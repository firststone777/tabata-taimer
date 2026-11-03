import type { Interval } from './types'

/**
 * Orologio dell'allenamento basato su timestamp, non su tick: se iOS sospende
 * la pagina, alla ripresa la posizione è comunque corretta.
 */
export interface ClockState {
  /** ms accumulati prima dell'ultima ripresa */
  baseMs: number
  /** timestamp (ms) dell'ultima ripresa, null se in pausa */
  runningSince: number | null
}

export const newClock = (): ClockState => ({ baseMs: 0, runningSince: null })

export function elapsedMs(c: ClockState, now: number): number {
  return c.baseMs + (c.runningSince === null ? 0 : now - c.runningSince)
}

export const start = (c: ClockState, now: number): ClockState =>
  c.runningSince === null ? { ...c, runningSince: now } : c

export const pause = (c: ClockState, now: number): ClockState =>
  c.runningSince === null ? c : { baseMs: elapsedMs(c, now), runningSince: null }

export const seek = (c: ClockState, toMs: number, now: number): ClockState => ({
  baseMs: toMs,
  runningSince: c.runningSince === null ? null : now,
})

export interface Position {
  index: number
  interval: Interval | undefined
  /** ms trascorsi nell'intervallo corrente */
  intoMs: number
  /** ms rimanenti nell'intervallo corrente */
  remainingMs: number
  /** secondi da mostrare (arrotondati per eccesso, come un countdown) */
  display: number
  totalElapsedMs: number
  totalRemainingMs: number
  done: boolean
}

/** Posizione nella sequenza dato il tempo trascorso. starts viene da startTimes(). */
export function positionAt(seq: Interval[], starts: number[], ms: number): Position {
  const end = starts[starts.length - 1]
  const t = Math.min(Math.max(ms, 0), end)
  if (t >= end || seq.length === 0) {
    return { index: seq.length, interval: undefined, intoMs: 0, remainingMs: 0, display: 0, totalElapsedMs: end, totalRemainingMs: 0, done: true }
  }
  // ricerca binaria dell'ultimo inizio <= t
  let lo = 0
  let hi = seq.length - 1
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1
    if (starts[mid] <= t) lo = mid
    else hi = mid - 1
  }
  const intoMs = t - starts[lo]
  const remainingMs = seq[lo].duration * 1000 - intoMs
  return {
    index: lo,
    interval: seq[lo],
    intoMs,
    remainingMs,
    display: Math.ceil(remainingMs / 1000),
    totalElapsedMs: t,
    totalRemainingMs: end - t,
    done: false,
  }
}

/** Salto all'intervallo successivo (ms di destinazione). */
export function nextTarget(starts: number[], index: number): number {
  return starts[Math.min(index + 1, starts.length - 1)]
}

/** Indietro: se sei oltre i primi 2 s riparte l'intervallo corrente, altrimenti il precedente. */
export function prevTarget(starts: number[], index: number, intoMs: number): number {
  if (intoMs > 2000 || index === 0) return starts[index]
  return starts[index - 1]
}

export type Cue =
  | { type: 'phase'; index: number; interval: Interval }
  | { type: 'countdown'; index: number; seconds: number }
  | { type: 'halfway'; index: number }
  | { type: 'finish' }

/**
 * Segnali da emettere passando da fromMs a toMs. Se il salto è più lungo di
 * maxCatchUpMs (pagina sospesa) i segnali vecchi vengono scartati: si suona
 * solo l'ultimo evento, non una raffica.
 */
export function cuesBetween(
  seq: Interval[],
  starts: number[],
  fromMs: number,
  toMs: number,
  opts: { countdown: number; halfway: boolean; maxCatchUpMs?: number } = { countdown: 3, halfway: false },
): Cue[] {
  if (toMs <= fromMs) return []
  const end = starts[starts.length - 1]
  const cues: Cue[] = []
  const crossed = (t: number) => fromMs < t && t <= toMs

  seq.forEach((iv, i) => {
    const s = starts[i]
    if (s > toMs || starts[i + 1] <= fromMs) return
    if (i > 0 && crossed(s)) cues.push({ type: 'phase', index: i, interval: iv })
    for (let k = Math.min(opts.countdown, iv.duration - 1); k >= 1; k--) {
      if (crossed(starts[i + 1] - k * 1000)) cues.push({ type: 'countdown', index: i, seconds: k })
    }
    if (opts.halfway && iv.kind === 'work' && iv.duration >= 20 && crossed(s + (iv.duration * 1000) / 2)) {
      cues.push({ type: 'halfway', index: i })
    }
  })
  if (crossed(end)) cues.push({ type: 'finish' })

  const maxCatchUp = opts.maxCatchUpMs ?? 1500
  return toMs - fromMs > maxCatchUp ? cues.slice(-1) : cues
}
