import { create } from 'zustand'
import type { Workout } from './engine/types'
import { db, newId, type Session } from './data/db'
import { exampleWorkout } from './data/defaults'
import { defaultSettings, type Settings } from './data/settings'
import type { ImportResult } from './data/backup'
import { music } from './audio/music'

export type Route =
  | { name: 'tabs' }
  | { name: 'editor'; workoutId: string; isNew?: boolean }
  | { name: 'timer'; workoutId: string }

interface State {
  loaded: boolean
  storageError: boolean
  workouts: Workout[]
  sessions: Session[]
  addSession: (s: Omit<Session, 'id'>) => Promise<void>
  clearSessions: () => Promise<void>
  settings: Settings
  setSettings: (patch: Partial<Settings>) => Promise<void>
  route: Route
  navigate: (r: Route) => void
  load: () => Promise<void>
  save: (w: Workout) => Promise<void>
  remove: (id: string) => Promise<void>
  duplicate: (id: string) => Promise<void>
  move: (from: number, to: number) => Promise<void>
  /** unisce i dati importati: stessi id = sovrascritti, nuovi = aggiunti in fondo */
  importData: (r: ImportResult) => Promise<number>
}

const byOrder = (a: Workout, b: Workout) => a.order - b.order

export const useStore = create<State>((set, get) => ({
  loaded: false,
  storageError: false,
  workouts: [],
  sessions: [],
  settings: defaultSettings,

  addSession: async (s) => {
    const session = { ...s, id: newId() }
    set({ sessions: [...get().sessions, session] })
    if (!get().storageError) await (await db()).put('sessions', session)
  },

  clearSessions: async () => {
    set({ sessions: [] })
    if (!get().storageError) await (await db()).clear('sessions')
  },
  route: { name: 'tabs' },

  setSettings: async (patch) => {
    const settings = { ...get().settings, ...patch }
    set({ settings })
    if (!get().storageError) await (await db()).put('kv', settings, 'settings')
    if (patch.music === true) void music.load()
  },

  navigate: (route) => set({ route }),

  load: async () => {
    const read = async () => {
      const d = await db()
      let workouts = (await d.getAll('workouts')).sort(byOrder)
      if (workouts.length === 0 && !(await d.get('kv', 'seeded'))) {
        const ex = exampleWorkout()
        await d.put('workouts', ex)
        await d.put('kv', true, 'seeded')
        workouts = [ex]
      }
      const saved = (await d.get('kv', 'settings')) as Partial<Settings> | undefined
      const sessions = await d.getAllFromIndex('sessions', 'byStart')
      return { workouts, sessions, settings: { ...defaultSettings, ...saved } }
    }
    const timeout = new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 4000))
    try {
      const data = await Promise.race([read(), timeout])
      set({ ...data, loaded: true })
      if (data.settings.music) void music.load()
    } catch {
      // Archivio non disponibile: l'app resta usabile, ma senza salvare.
      set({ workouts: [exampleWorkout()], loaded: true, storageError: true })
    }
  },

  save: async (w) => {
    const list = get().workouts
    const exists = list.some((x) => x.id === w.id)
    const next = { ...w, updatedAt: Date.now(), order: exists ? w.order : Math.max(-1, ...list.map((x) => x.order)) + 1 }
    if (!get().storageError) await (await db()).put('workouts', next)
    set({ workouts: (exists ? list.map((x) => (x.id === w.id ? next : x)) : [...list, next]).sort(byOrder) })
  },

  remove: async (id) => {
    if (!get().storageError) await (await db()).delete('workouts', id)
    set({ workouts: get().workouts.filter((w) => w.id !== id) })
  },

  duplicate: async (id) => {
    const src = get().workouts.find((w) => w.id === id)
    if (!src) return
    const now = Date.now()
    await get().save({
      ...src,
      id: newId(),
      name: `${src.name} (copia)`,
      steps: src.steps.map((s) => ({ ...s, id: newId() })),
      favorite: false,
      lastUsedAt: 0,
      createdAt: now,
    })
  },

  move: async (from, to) => {
    const list = [...get().workouts]
    const [item] = list.splice(from, 1)
    list.splice(to, 0, item)
    const reordered = list.map((w, i) => ({ ...w, order: i }))
    set({ workouts: reordered })
    if (get().storageError) return
    const tx = (await db()).transaction('workouts', 'readwrite')
    await Promise.all([...reordered.map((w) => tx.store.put(w)), tx.done])
  },

  importData: async (r) => {
    const current = get().workouts
    const known = new Set(current.map((w) => w.id))
    let order = Math.max(-1, ...current.map((w) => w.order)) + 1
    const incoming = r.workouts.map((w) => (known.has(w.id) ? { ...w, order: current.find((c) => c.id === w.id)!.order } : { ...w, order: order++ }))
    const byId = new Map(current.map((w) => [w.id, w]))
    incoming.forEach((w) => byId.set(w.id, w))
    const settings = r.settings ? { ...get().settings, ...r.settings } : get().settings
    const sessionsById = new Map(get().sessions.map((x) => [x.id, x]))
    r.sessions.forEach((x) => sessionsById.set(x.id, x))
    const sessions = [...sessionsById.values()].sort((a, b) => a.startedAt - b.startedAt)
    set({ workouts: [...byId.values()].sort(byOrder), settings, sessions })
    if (!get().storageError) {
      const tx = (await db()).transaction(['workouts', 'sessions', 'kv'], 'readwrite')
      await Promise.all([
        ...incoming.map((w) => tx.objectStore('workouts').put(w)),
        ...r.sessions.map((x) => tx.objectStore('sessions').put(x)),
        tx.objectStore('kv').put(settings, 'settings'),
        tx.done,
      ])
    }
    return incoming.length
  },
}))
