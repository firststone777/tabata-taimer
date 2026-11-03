/**
 * Voce guida. Le frasi fisse sono clip audio suonate con Web Audio, che si
 * mescolano a Spotify / Apple Music. La sintesi vocale di iOS invece mette in
 * pausa la musica, quindi si usa solo per leggere i nomi degli esercizi e solo
 * se l'utente lo attiva.
 */

let voice: SpeechSynthesisVoice | null | undefined

function italianVoice(): SpeechSynthesisVoice | null {
  if (voice !== undefined) return voice
  const all = speechSynthesis.getVoices()
  if (all.length === 0) return null // non ancora caricate: riprova al prossimo annuncio
  voice = all.find((v) => v.lang === 'it-IT' && v.localService) ?? all.find((v) => v.lang.startsWith('it')) ?? null
  return voice
}

export function speak(text: string) {
  if (!('speechSynthesis' in window) || !text) return
  speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance(text)
  u.lang = 'it-IT'
  u.rate = 1.05
  const v = italianVoice()
  if (v) u.voice = v
  speechSynthesis.speak(u)
}

/** iOS sblocca la sintesi vocale solo se la prima frase parte da un gesto. */
export function unlockVoice() {
  if (!('speechSynthesis' in window)) return
  const u = new SpeechSynthesisUtterance(' ')
  u.volume = 0
  speechSynthesis.speak(u)
}

export function stopSpeaking() {
  if ('speechSynthesis' in window) speechSynthesis.cancel()
}
