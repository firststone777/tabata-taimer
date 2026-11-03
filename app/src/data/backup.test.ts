import { describe, expect, it } from 'vitest'
import { BACKUP_FORMAT, parseImport } from './backup'
import { SHARE_FORMAT } from './share'

const file = (data: unknown) => new File([typeof data === 'string' ? data : JSON.stringify(data)], 'x.json')

describe('parseImport', () => {
  it('legge un singolo allenamento condiviso e completa i campi mancanti', async () => {
    const r = await parseImport(file({ format: SHARE_FORMAT, workout: { id: 'a', name: 'Gambe', work: 40 } }))
    expect(r.workouts).toHaveLength(1)
    expect(r.workouts[0]).toMatchObject({ id: 'a', name: 'Gambe', work: 40, rest: 10, steps: [] })
  })

  it('legge un backup completo', async () => {
    const r = await parseImport(
      file({ format: BACKUP_FORMAT, workouts: [{ id: 'a' }, { id: 'b' }], sessions: [{ id: 's' }], settings: { countdown: 5 } }),
    )
    expect(r.workouts.map((w) => w.id)).toEqual(['a', 'b'])
    expect(r.sessions).toHaveLength(1)
    expect(r.settings).toEqual({ countdown: 5 })
  })

  it('rifiuta file non validi', async () => {
    await expect(parseImport(file('non json'))).rejects.toThrow('non è un backup valido')
    await expect(parseImport(file({ foo: 1 }))).rejects.toThrow('non è un backup di Tabata tAImer')
  })
})
