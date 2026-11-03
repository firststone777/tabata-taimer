import { describe, expect, it } from 'vitest'
import { buildSequence, startTimes, totalSeconds } from './sequence'
import { cuesBetween, elapsedMs, newClock, nextTarget, pause, positionAt, prevTarget, seek, start } from './clock'
import { formatDuration } from './format'

const simple = (over: Partial<Parameters<typeof buildSequence>[0]> = {}) => ({
  mode: 'simple' as const,
  prepare: 0,
  work: 20,
  rest: 10,
  cycles: 8,
  sets: 1,
  restBetweenSets: 0,
  coolDown: 0,
  workLabel: '',
  restLabel: '',
  steps: [],
  ...over,
})

describe('buildSequence: totali come l’app di riferimento', () => {
  it('Addominali 3/45/15 ×10 = 9:48, 20 intervalli', () => {
    const seq = buildSequence(simple({ prepare: 3, work: 45, rest: 15, cycles: 10 }))
    expect(formatDuration(totalSeconds(seq))).toBe('9:48')
    expect(seq).toHaveLength(20)
  })

  it('Parte dietro sopra 5/60/30 ×30 = 44:35, 60 intervalli', () => {
    const seq = buildSequence(simple({ prepare: 5, work: 60, rest: 30, cycles: 30 }))
    expect(formatDuration(totalSeconds(seq))).toBe('44:35')
    expect(seq).toHaveLength(60)
  })

  it('Tabata classico 20/10 ×8 = 3:50 senza l’ultimo riposo', () => {
    expect(totalSeconds(buildSequence(simple()))).toBe(230)
  })

  it('mantiene l’ultimo riposo se l’opzione è disattivata', () => {
    const seq = buildSequence(simple(), { skipLastRest: false, skipLastRestBeforeSetRest: true })
    expect(totalSeconds(seq)).toBe(240)
    expect(seq.at(-1)?.kind).toBe('rest')
  })
})

describe('buildSequence: set, riposo tra i set, defaticamento', () => {
  const w = simple({ prepare: 10, work: 20, rest: 10, cycles: 2, sets: 3, restBetweenSets: 60, coolDown: 30 })

  it('ordine delle fasi', () => {
    const kinds = buildSequence(w).map((i) => i.kind)
    expect(kinds).toEqual([
      'prepare',
      'work', 'rest', 'work', 'setRest',
      'work', 'rest', 'work', 'setRest',
      'work', 'rest', 'work',
      'cooldown',
    ])
  })

  it('numera cicli e set', () => {
    const seq = buildSequence(w)
    expect(seq[5]).toMatchObject({ kind: 'work', cycle: 1, set: 2, cycles: 2, sets: 3 })
  })

  it('senza i salti tiene tutti i riposi', () => {
    const seq = buildSequence(w, { skipLastRest: false, skipLastRestBeforeSetRest: false })
    expect(seq.filter((i) => i.kind === 'rest')).toHaveLength(6)
  })

  it('ignora le fasi a durata zero', () => {
    const kinds = buildSequence(simple({ rest: 0, cycles: 3 })).map((i) => i.kind)
    expect(kinds).toEqual(['work', 'work', 'work'])
  })
})

describe('buildSequence: intervalli personalizzati', () => {
  it('ripete i passi per ciclo e usa le etichette', () => {
    const seq = buildSequence({
      ...simple({ mode: 'custom', cycles: 2 }),
      steps: [
        { id: 'a', kind: 'work', label: 'Squat', duration: 30 },
        { id: 'b', kind: 'rest', label: '', duration: 10 },
        { id: 'c', kind: 'work', label: 'Plank', duration: 40 },
        { id: 'd', kind: 'rest', label: '', duration: 15 },
      ],
    })
    expect(seq.map((i) => i.label)).toEqual(['Squat', 'Riposo', 'Plank', 'Riposo', 'Squat', 'Riposo', 'Plank'])
    expect(totalSeconds(seq)).toBe(95 * 2 - 15)
  })
})

describe('clock', () => {
  it('somma il tempo tra pause e riprese', () => {
    let c = start(newClock(), 1000)
    c = pause(c, 4000)
    expect(elapsedMs(c, 99999)).toBe(3000)
    c = start(c, 10000)
    expect(elapsedMs(c, 10500)).toBe(3500)
  })

  it('resta corretto dopo una lunga sospensione', () => {
    const c = start(newClock(), 0)
    expect(elapsedMs(c, 125_000)).toBe(125_000)
  })

  it('seek mantiene lo stato di esecuzione', () => {
    const c = seek(start(newClock(), 0), 50_000, 7000)
    expect(elapsedMs(c, 8000)).toBe(51_000)
  })
})

describe('positionAt', () => {
  const seq = buildSequence(simple({ prepare: 3, work: 45, rest: 15, cycles: 10 }))
  const starts = startTimes(seq)

  it('countdown arrotondato per eccesso', () => {
    const p = positionAt(seq, starts, 3000 + 1200)
    expect(p.interval?.kind).toBe('work')
    expect(p.display).toBe(44)
  })

  it('al confine passa all’intervallo successivo', () => {
    expect(positionAt(seq, starts, 3000).index).toBe(1)
    expect(positionAt(seq, starts, 2999).index).toBe(0)
  })

  it('fine allenamento', () => {
    const p = positionAt(seq, starts, 10_000_000)
    expect(p.done).toBe(true)
    expect(p.totalElapsedMs).toBe(588_000)
  })

  it('avanti e indietro', () => {
    expect(nextTarget(starts, 1)).toBe(48_000)
    expect(prevTarget(starts, 2, 500)).toBe(3000)
    expect(prevTarget(starts, 2, 5000)).toBe(48_000)
  })
})

describe('cuesBetween', () => {
  const seq = buildSequence(simple({ prepare: 5, work: 20, rest: 10, cycles: 2 }))
  const starts = startTimes(seq)
  const opts = { countdown: 3, halfway: true }

  it('3-2-1 alla fine della preparazione, poi cambio fase', () => {
    const cues = cuesBetween(seq, starts, 1500, 5000, { ...opts, maxCatchUpMs: 10_000 })
    expect(cues).toEqual([
      { type: 'countdown', index: 0, seconds: 3 },
      { type: 'countdown', index: 0, seconds: 2 },
      { type: 'countdown', index: 0, seconds: 1 },
      { type: 'phase', index: 1, interval: seq[1] },
    ])
  })

  it('segnale a metà lavoro', () => {
    expect(cuesBetween(seq, starts, 14_900, 15_100, opts)).toEqual([{ type: 'halfway', index: 1 }])
  })

  it('fine', () => {
    const end = starts.at(-1)!
    expect(cuesBetween(seq, starts, end - 100, end, opts).at(-1)).toEqual({ type: 'finish' })
  })

  it('dopo una sospensione suona solo l’ultimo evento', () => {
    expect(cuesBetween(seq, starts, 0, 30_000, opts)).toHaveLength(1)
  })

  it('nessun segnale se il tempo non avanza', () => {
    expect(cuesBetween(seq, starts, 1000, 1000, opts)).toEqual([])
  })
})
