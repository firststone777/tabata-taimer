import type { Session } from '../data/db'

const DAY = 86_400_000

/** Mezzanotte locale del giorno di t. */
export function startOfDay(t: number): number {
  const d = new Date(t)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

/** Lunedì (mezzanotte locale) della settimana di t. */
export function startOfWeek(t: number): number {
  const d = new Date(startOfDay(t))
  const dow = (d.getDay() + 6) % 7 // lunedì = 0
  d.setDate(d.getDate() - dow)
  return d.getTime()
}

/** Chiave giorno locale "AAAA-MM-GG". */
function dayKey(t: number): string {
  const d = new Date(t)
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`
}

/** Giorni consecutivi con almeno una sessione, contando da oggi (o da ieri se oggi non ancora). */
export function streak(sessions: Session[], now: number): number {
  const days = new Set(sessions.map((s) => dayKey(s.startedAt)))
  const cursor = new Date(startOfDay(now))
  if (!days.has(dayKey(cursor.getTime()))) cursor.setDate(cursor.getDate() - 1)
  let n = 0
  while (days.has(dayKey(cursor.getTime()))) {
    n++
    cursor.setDate(cursor.getDate() - 1)
  }
  return n
}

/** Minuti per ciascun giorno della settimana corrente, da lunedì a domenica. */
export function weekByDay(sessions: Session[], now: number): number[] {
  const start = startOfWeek(now)
  const out = [0, 0, 0, 0, 0, 0, 0]
  for (const s of sessions) {
    if (s.startedAt < start || s.startedAt >= start + 7 * DAY + 3_600_000) continue
    // uso la data locale, non i ms, per non sbagliare nei cambi d'ora
    const i = Math.round((startOfDay(s.startedAt) - start) / DAY)
    if (i >= 0 && i < 7) out[i] += s.activeSeconds / 60
  }
  return out
}

export function summarize(sessions: Session[], now: number) {
  const week = weekByDay(sessions, now)
  return {
    weekMinutes: Math.round(week.reduce((a, b) => a + b, 0)),
    week,
    streak: streak(sessions, now),
    total: sessions.length,
    completed: sessions.filter((s) => s.completed).length,
    totalMinutes: Math.round(sessions.reduce((a, s) => a + s.activeSeconds, 0) / 60),
  }
}
