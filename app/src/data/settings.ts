export interface Settings {
  skipLastRest: boolean
  skipLastRestBeforeSetRest: boolean
  sounds: boolean
  /** 0–1 */
  volume: number
  voice: boolean
  /** legge i nomi degli esercizi con la sintesi vocale di iOS (mette in pausa la musica) */
  speakNames: boolean
  /** secondi di conto alla rovescia acustico prima di ogni cambio fase (0 = no) */
  countdown: number
  halfway: boolean
  keepAwake: boolean
  /** musica per intervallo attiva */
  music: boolean
  /** nomi dei brani scelti (i file sono in IndexedDB) */
  musicWorkName: string
  musicRestName: string
  confirmExit: boolean
  /** mette in pausa quando l'app passa in background (chiamata, blocco schermo) */
  pauseOnHide: boolean
}

export const defaultSettings: Settings = {
  skipLastRest: true,
  skipLastRestBeforeSetRest: true,
  sounds: true,
  volume: 0.8,
  voice: true,
  speakNames: false,
  countdown: 3,
  halfway: false,
  keepAwake: true,
  music: false,
  musicWorkName: '',
  musicRestName: '',
  confirmExit: true,
  pauseOnHide: true,
}
