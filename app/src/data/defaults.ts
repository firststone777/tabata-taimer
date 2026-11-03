import type { Workout } from '../engine/types'
import { newId } from './db'

export function newWorkout(over: Partial<Workout> = {}): Workout {
  const now = Date.now()
  return {
    id: newId(),
    name: 'Nuovo allenamento',
    mode: 'simple',
    prepare: 10,
    work: 20,
    rest: 10,
    cycles: 8,
    sets: 1,
    restBetweenSets: 0,
    coolDown: 0,
    workLabel: '',
    restLabel: '',
    steps: [],
    notes: '',
    color: '#D9B45A',
    favorite: false,
    lastUsedAt: 0,
    order: 0,
    createdAt: now,
    updatedAt: now,
    ...over,
  }
}

export const exampleWorkout = () => newWorkout({ name: 'Tabata classico' })
