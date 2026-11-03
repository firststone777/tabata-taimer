import { buildSequence, totalSeconds } from './sequence'
import type { PhaseKind, SequenceOptions, Workout } from './types'

/** 45 → "45s", 60 → "1:00" */
export function shortDuration(s: number): string {
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

export interface Segment {
  kind: PhaseKind
  grow: number
}

export function workoutSummary(w: Workout, opts?: SequenceOptions) {
  const seq = buildSequence(w, opts)
  const parts =
    w.mode === 'custom'
      ? [`${w.steps.filter((s) => s.kind === 'work').length} esercizi`, `${w.cycles} ${w.cycles === 1 ? 'ciclo' : 'cicli'}`]
      : [`${shortDuration(w.work)} lavoro`, `${shortDuration(w.rest)} riposo`, `${w.cycles} ${w.cycles === 1 ? 'ciclo' : 'cicli'}`]
  if (w.sets > 1) parts.push(`${w.sets} set`)

  // anteprima: al massimo i primi 19 intervalli del corpo dell'allenamento
  const segments: Segment[] = seq
    .filter((i) => i.kind !== 'prepare' && i.kind !== 'cooldown')
    .slice(0, 19)
    .map((i) => ({ kind: i.kind, grow: i.duration }))

  return { seq, total: totalSeconds(seq), intervals: seq.length, detail: parts.join(' · '), segments }
}

export const phaseColor: Record<PhaseKind, string> = {
  prepare: '#8C7F68',
  work: 'var(--gold)',
  rest: '#7FA8CC',
  setRest: '#3F6A8F',
  cooldown: '#8C7F68',
}
