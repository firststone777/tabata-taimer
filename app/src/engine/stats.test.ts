import { describe, expect, it } from 'vitest'
import { startOfWeek, streak, summarize, weekByDay } from './stats'
import type { Session } from '../data/db'

const at = (y: number, m: number, d: number, h = 18) => new Date(y, m - 1, d, h).getTime()
const session = (t: number, min = 10, completed = true): Session => ({
  id: String(t),
  workoutId: 'w',
  workoutName: 'W',
  startedAt: t,
  activeSeconds: min * 60,
  completed,
})

// mercoledì 4 novembre 2026
const NOW = at(2026, 11, 4, 20)

describe('stats', () => {
  it('la settimana parte dal lunedì', () => {
    expect(new Date(startOfWeek(NOW)).getDate()).toBe(2)
  })

  it('minuti per giorno della settimana', () => {
    const w = weekByDay([session(at(2026, 11, 2), 10), session(at(2026, 11, 4, 8), 5), session(at(2026, 11, 4), 15), session(at(2026, 10, 30), 99)], NOW)
    expect(w).toEqual([10, 0, 20, 0, 0, 0, 0])
  })

  it('serie di giorni consecutivi fino a oggi', () => {
    expect(streak([session(at(2026, 11, 4)), session(at(2026, 11, 3)), session(at(2026, 11, 2)), session(at(2026, 10, 30))], NOW)).toBe(3)
  })

  it('la serie resta valida se oggi non ci si è ancora allenati', () => {
    expect(streak([session(at(2026, 11, 3)), session(at(2026, 11, 2))], NOW)).toBe(2)
  })

  it('serie interrotta', () => {
    expect(streak([session(at(2026, 11, 2))], NOW)).toBe(0)
  })

  it('riepilogo', () => {
    const s = summarize([session(at(2026, 11, 4), 12), session(at(2026, 11, 1), 30, false)], NOW)
    expect(s).toMatchObject({ weekMinutes: 12, total: 2, completed: 1, totalMinutes: 42, streak: 1 })
  })
})
