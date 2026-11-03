import type { Workout } from '../engine/types'

export const SHARE_FORMAT = 'tabata-taimer/workout@1'

/** Condivide un allenamento come file JSON (AirDrop, Messaggi, File…), che si reimporta da Impostazioni. */
export async function shareWorkout(w: Workout): Promise<'shared' | 'downloaded' | 'cancelled'> {
  const json = JSON.stringify({ format: SHARE_FORMAT, workout: w }, null, 2)
  const safe = w.name.replace(/[^\p{L}\p{N} _-]/gu, '').trim() || 'allenamento'
  const file = new File([json], `${safe}.taimer.json`, { type: 'application/json' })

  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: w.name })
      return 'shared'
    } catch {
      return 'cancelled'
    }
  }
  const url = URL.createObjectURL(file)
  const a = document.createElement('a')
  a.href = url
  a.download = file.name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  return 'downloaded'
}
