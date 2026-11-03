/**
 * Segnali sintetizzati con Web Audio: niente file da scaricare, latenza minima.
 * Su iOS l'AudioContext va sbloccato dentro un gesto dell'utente: chiamare
 * unlockAudio() nel gestore del tocco che avvia l'allenamento.
 */

type AudioSessionNav = Navigator & { audioSession?: { type: string } }

let ctx: AudioContext | null = null
let master: GainNode | null = null

export function unlockAudio() {
  // "ambient" si mescola con Spotify / Apple Music senza interromperli né abbassarli
  // (Safari non permette di abbassare la musica: "transient" si comporta allo stesso modo).
  // Rispetta l'interruttore silenzioso dell'iPhone.
  const nav = navigator as AudioSessionNav
  if (nav.audioSession) nav.audioSession.type = 'ambient'

  if (!ctx) {
    ctx = new AudioContext()
    master = ctx.createGain()
    master.connect(ctx.destination)
    // un buffer muto riprodotto nel gesto sblocca l'uscita su iOS
    const b = ctx.createBufferSource()
    b.buffer = ctx.createBuffer(1, 1, 22050)
    b.connect(master)
    b.start()
    void loadClips()
  }
  if (ctx.state !== 'running') void ctx.resume()
}

/** Clip della voce guida (public/voice), decodificate una volta sola. */
export type Clip = 'via' | 'riposo' | 'preparati' | 'riposoLungo' | 'defaticamento' | 'meta' | 'ultimo' | 'fine'
const CLIPS: Clip[] = ['via', 'riposo', 'preparati', 'riposoLungo', 'defaticamento', 'meta', 'ultimo', 'fine']
const buffers = new Map<Clip, AudioBuffer>()
let loading: Promise<void> | null = null
let current: AudioBufferSourceNode | null = null

export function loadClips() {
  if (!ctx || loading) return loading
  const c = ctx
  loading = Promise.all(
    CLIPS.map(async (name) => {
      try {
        const res = await fetch(`${import.meta.env.BASE_URL}voice/${name}.wav`)
        buffers.set(name, await c.decodeAudioData(await res.arrayBuffer()))
      } catch {
        // clip mancante: quell'annuncio resterà muto
      }
    }),
  ).then(() => undefined)
  return loading
}

/** Suona una clip vocale sullo stesso canale dei segnali (si mescola con la musica). */
export function playClip(name: Clip, delay = 0) {
  const buf = buffers.get(name)
  if (!ctx || !master || !buf) return
  current?.stop()
  const src = ctx.createBufferSource()
  src.buffer = buf
  src.connect(master)
  src.start(ctx.currentTime + delay)
  current = src
}

export function setVolume(v: number) {
  if (master) master.gain.value = v
}

function tone(freq: number, start: number, dur: number, type: OscillatorType = 'sine', peak = 0.9) {
  if (!ctx || !master) return
  const t = ctx.currentTime + start
  const osc = ctx.createOscillator()
  const g = ctx.createGain()
  osc.type = type
  osc.frequency.value = freq
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(peak, t + 0.01)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  osc.connect(g).connect(master)
  osc.start(t)
  osc.stop(t + dur + 0.02)
}

export const sounds = {
  /** bip del 3-2-1 */
  tick: () => tone(880, 0, 0.12, 'triangle'),
  /** inizio lavoro: due toni ascendenti, brillante */
  work: () => {
    tone(988, 0, 0.16, 'triangle')
    tone(1319, 0.14, 0.42, 'triangle')
  },
  /** inizio riposo: tono basso e morbido */
  rest: () => {
    tone(784, 0, 0.18, 'sine')
    tone(523, 0.16, 0.5, 'sine')
  },
  halfway: () => tone(1047, 0, 0.1, 'sine', 0.6),
  finish: () => {
    ;[784, 988, 1175, 1568].forEach((f, i) => tone(f, i * 0.16, i === 3 ? 0.9 : 0.18, 'triangle'))
  },
}
