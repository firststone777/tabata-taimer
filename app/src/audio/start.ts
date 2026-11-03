import { unlockAudio } from './sound'
import { unlockVoice } from './voice'
import { music } from './music'

/**
 * Da chiamare nel gestore del tocco che apre il timer (requisito di iOS).
 * La sintesi vocale si sblocca solo se serve: anche una frase muta mette in pausa la musica.
 */
export function primeMedia(opts: { speakNames: boolean; music: boolean }) {
  unlockAudio()
  if (opts.speakNames) unlockVoice()
  if (opts.music) music.prime()
}
