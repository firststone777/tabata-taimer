import type { CustomStep, Interval, SequenceOptions, Workout } from './types'

export const defaultSequenceOptions: SequenceOptions = {
  skipLastRest: true,
  skipLastRestBeforeSetRest: true,
}

const PHASE_LABEL = {
  prepare: 'Preparazione',
  work: 'Lavoro',
  rest: 'Riposo',
  setRest: 'Riposo tra i set',
  cooldown: 'Defaticamento',
} as const

type WorkoutShape = Pick<
  Workout,
  'mode' | 'prepare' | 'work' | 'rest' | 'cycles' | 'sets' | 'restBetweenSets' | 'coolDown' | 'workLabel' | 'restLabel' | 'steps'
>

/** I passi di un singolo ciclo, in base alla modalità. */
function cycleSteps(w: WorkoutShape): Omit<CustomStep, 'id'>[] {
  if (w.mode === 'custom') return w.steps
  return [
    { kind: 'work', label: w.workLabel, duration: w.work },
    { kind: 'rest', label: w.restLabel, duration: w.rest },
  ]
}

/** Espande un allenamento nella sequenza lineare di intervalli da eseguire. */
export function buildSequence(w: WorkoutShape, opts: SequenceOptions = defaultSequenceOptions): Interval[] {
  const out: Interval[] = []
  const sets = Math.max(1, w.sets)
  const cycles = Math.max(1, w.cycles)
  const steps = cycleSteps(w).filter((s) => s.duration > 0)
  const base = { cycles, sets }

  if (w.prepare > 0) {
    out.push({ kind: 'prepare', label: PHASE_LABEL.prepare, duration: w.prepare, cycle: 0, set: 0, ...base })
  }

  for (let set = 1; set <= sets; set++) {
    const lastSet = set === sets
    const setRestFollows = !lastSet && w.restBetweenSets > 0
    for (let cycle = 1; cycle <= cycles; cycle++) {
      steps.forEach((s, i) => {
        const trailingRest = cycle === cycles && s.kind === 'rest' && steps.slice(i + 1).every((n) => n.kind === 'rest')
        if (trailingRest && lastSet && opts.skipLastRest) return
        if (trailingRest && setRestFollows && opts.skipLastRestBeforeSetRest) return
        out.push({ kind: s.kind, label: s.label || PHASE_LABEL[s.kind], duration: s.duration, cycle, set, ...base })
      })
    }
    if (setRestFollows) {
      out.push({ kind: 'setRest', label: PHASE_LABEL.setRest, duration: w.restBetweenSets, cycle: 0, set, ...base })
    }
  }

  if (w.coolDown > 0) {
    out.push({ kind: 'cooldown', label: PHASE_LABEL.cooldown, duration: w.coolDown, cycle: 0, set: 0, ...base })
  }
  return out
}

export function totalSeconds(seq: Interval[]): number {
  return seq.reduce((sum, i) => sum + i.duration, 0)
}

/** Istante di inizio (ms) di ciascun intervallo, più la fine totale in coda. */
export function startTimes(seq: Interval[]): number[] {
  const starts = [0]
  for (const i of seq) starts.push(starts[starts.length - 1] + i.duration * 1000)
  return starts
}
