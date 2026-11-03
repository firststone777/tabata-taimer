import { db } from '../data/db'
import type { PhaseKind } from '../engine/types'

/**
 * Musica per intervallo: un brano per il lavoro e uno per il riposo, scelti
 * dall'utente e salvati sul telefono. Usa <audio>, quindi su iOS ferma
 * Spotify / Apple Music: è un'alternativa alla musica in sottofondo.
 */
export type MusicSlot = 'work' | 'rest'
const key = (slot: MusicSlot) => `music-${slot}`

export async function saveTrack(slot: MusicSlot, file: File) {
  await (await db()).put('media', { id: key(slot), name: file.name, blob: file })
}

export async function removeTrack(slot: MusicSlot) {
  await (await db()).delete('media', key(slot))
}

function createMusicPlayer() {
  let players: Partial<Record<MusicSlot, HTMLAudioElement>> = {}
  let urls: string[] = []
  let active: MusicSlot | null = null

  return {
    /**
     * Carica (o ricarica) i brani. Va completato prima del tocco di avvio:
     * prime() deve girare in modo sincrono dentro il gesto.
     */
    async load() {
      this.dispose()
      const d = await db()
      for (const slot of ['work', 'rest'] as const) {
        const rec = await d.get('media', key(slot))
        if (!rec) continue
        const url = URL.createObjectURL(rec.blob)
        urls.push(url)
        const el = new Audio(url)
        el.loop = true
        el.preload = 'auto'
        players[slot] = el
      }
      return Object.keys(players).length > 0
    },
    /** Sblocca la riproduzione: da chiamare in un gesto dell'utente. */
    prime() {
      for (const el of Object.values(players)) {
        el.muted = true
        void el.play().then(() => {
          el.pause()
          el.muted = false
        }).catch(() => undefined)
      }
    },
    /** Suona il brano adatto alla fase; ogni brano riprende da dove era rimasto. */
    setPhase(kind: PhaseKind | null) {
      const slot: MusicSlot | null = kind === 'work' ? 'work' : kind === null ? null : players.rest ? 'rest' : null
      if (slot === active) return
      if (active) players[active]?.pause()
      active = slot
      if (slot) void players[slot]?.play().catch(() => undefined)
    },
    pause() {
      if (active) players[active]?.pause()
      active = null
    },
    dispose() {
      this.pause()
      for (const el of Object.values(players)) el.src = ''
      urls.forEach((u) => URL.revokeObjectURL(u))
      players = {}
      urls = []
    },
  }
}

export const music = createMusicPlayer()
