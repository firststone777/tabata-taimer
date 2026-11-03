import type { Workout } from '../engine/types'
import { db, newId, type Session } from './db'
import { newWorkout } from './defaults'
import { SHARE_FORMAT } from './share'
import type { Settings } from './settings'

export const BACKUP_FORMAT = 'tabata-taimer/backup@1'

interface Backup {
  format: typeof BACKUP_FORMAT
  exportedAt: string
  workouts: Workout[]
  sessions: Session[]
  settings: Partial<Settings>
}

/** Backup completo (senza i file musicali, che restano sul telefono). */
export async function exportBackup(workouts: Workout[], settings: Settings): Promise<'shared' | 'downloaded' | 'cancelled'> {
  let sessions: Session[] = []
  try {
    sessions = await (await db()).getAll('sessions')
  } catch {
    // archivio non disponibile: esporta comunque allenamenti e impostazioni
  }
  const data: Backup = { format: BACKUP_FORMAT, exportedAt: new Date().toISOString(), workouts, sessions, settings }
  const day = new Date().toISOString().slice(0, 10)
  const file = new File([JSON.stringify(data, null, 2)], `tabata-taimer-backup-${day}.json`, { type: 'application/json' })

  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'Backup Tabata tAImer' })
      return 'shared'
    } catch {
      return 'cancelled'
    }
  }
  const url = URL.createObjectURL(file)
  const a = document.createElement('a')
  a.href = url
  a.download = file.name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  return 'downloaded'
}

export interface ImportResult {
  workouts: Workout[]
  sessions: Session[]
  settings?: Partial<Settings>
}

/** Completa un allenamento importato con i campi mancanti (file di versioni precedenti). */
function normalize(w: Partial<Workout>): Workout {
  const base = newWorkout()
  return { ...base, ...w, id: typeof w.id === 'string' && w.id ? w.id : newId(), steps: Array.isArray(w.steps) ? w.steps : [] }
}

/** Legge un backup completo o un singolo allenamento condiviso. */
export async function parseImport(file: File): Promise<ImportResult> {
  let data: unknown
  try {
    data = JSON.parse(await file.text())
  } catch {
    throw new Error('Il file non è un backup valido.')
  }
  const d = data as Record<string, unknown>
  if (d?.format === SHARE_FORMAT && d.workout) {
    return { workouts: [normalize(d.workout as Partial<Workout>)], sessions: [] }
  }
  if (d?.format === BACKUP_FORMAT && Array.isArray(d.workouts)) {
    return {
      workouts: (d.workouts as Partial<Workout>[]).map(normalize),
      sessions: Array.isArray(d.sessions) ? (d.sessions as Session[]) : [],
      settings: (d.settings as Partial<Settings>) ?? undefined,
    }
  }
  throw new Error('Il file non è un backup di Tabata tAImer.')
}
