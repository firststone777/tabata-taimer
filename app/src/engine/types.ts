export type PhaseKind = 'prepare' | 'work' | 'rest' | 'setRest' | 'cooldown'

export interface CustomStep {
  id: string
  kind: 'work' | 'rest'
  label: string
  /** secondi */
  duration: number
}

export interface Workout {
  id: string
  name: string
  mode: 'simple' | 'custom'
  /** durate in secondi */
  prepare: number
  work: number
  rest: number
  cycles: number
  sets: number
  restBetweenSets: number
  coolDown: number
  workLabel: string
  restLabel: string
  /** usati quando mode === 'custom': un ciclo = la sequenza di passi */
  steps: CustomStep[]
  notes: string
  color: string
  favorite: boolean
  /** timestamp dell'ultimo avvio, 0 se mai */
  lastUsedAt: number
  order: number
  createdAt: number
  updatedAt: number
}

export interface SequenceOptions {
  /** salta il riposo dopo l'ultimo lavoro dell'allenamento */
  skipLastRest: boolean
  /** salta l'ultimo riposo di un set quando segue il riposo tra i set */
  skipLastRestBeforeSetRest: boolean
}

export interface Interval {
  kind: PhaseKind
  label: string
  /** secondi */
  duration: number
  /** 1-based; 0 per preparazione e defaticamento */
  cycle: number
  cycles: number
  set: number
  sets: number
}
