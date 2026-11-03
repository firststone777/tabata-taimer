/** Mantiene lo schermo acceso; il lock decade quando la pagina va in background. */
export function createWakeLock() {
  let sentinel: WakeLockSentinel | null = null
  let wanted = false

  const acquire = async () => {
    if (!wanted || sentinel || !('wakeLock' in navigator) || document.visibilityState !== 'visible') return
    try {
      sentinel = await navigator.wakeLock.request('screen')
      sentinel.addEventListener('release', () => (sentinel = null))
    } catch {
      // non supportato o negato: lo schermo seguirà il blocco automatico
    }
  }

  const onVisible = () => void acquire()
  document.addEventListener('visibilitychange', onVisible)

  return {
    enable() {
      wanted = true
      void acquire()
    },
    disable() {
      wanted = false
      void sentinel?.release()
      sentinel = null
    },
    dispose() {
      this.disable()
      document.removeEventListener('visibilitychange', onVisible)
    },
  }
}
