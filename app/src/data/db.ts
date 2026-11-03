import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { Workout } from '../engine/types'

export interface Session {
  id: string
  workoutId: string
  workoutName: string
  startedAt: number
  /** secondi effettivamente svolti */
  activeSeconds: number
  completed: boolean
}

interface TaimerDB extends DBSchema {
  workouts: { key: string; value: Workout }
  sessions: { key: string; value: Session; indexes: { byStart: number } }
  kv: { key: string; value: unknown }
  media: { key: string; value: { id: string; name: string; blob: Blob } }
}

let dbp: Promise<IDBPDatabase<TaimerDB>> | null = null

export function db() {
  dbp ??= openDB<TaimerDB>('tabata-taimer', 1, {
    upgrade(d) {
      d.createObjectStore('workouts', { keyPath: 'id' })
      d.createObjectStore('sessions', { keyPath: 'id' }).createIndex('byStart', 'startedAt')
      d.createObjectStore('kv')
      d.createObjectStore('media', { keyPath: 'id' })
    },
  })
  return dbp
}

/** crypto.randomUUID esiste solo in contesti sicuri (non su http in rete locale). */
export function newId(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') return crypto.randomUUID()
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10)
}
