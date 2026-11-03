import { useRef, useState, type ReactNode } from 'react'
import { useStore } from '../store'
import type { Settings as S } from '../data/settings'
import { exportBackup, parseImport } from '../data/backup'
import { music, removeTrack, saveTrack, type MusicSlot } from '../audio/music'
import { playClip, sounds } from '../audio/sound'
import { primeMedia } from '../audio/start'
import './Settings.css'

type BoolKey = { [K in keyof S]: S[K] extends boolean ? K : never }[keyof S]

function Group({ title, children, note }: { title: string; children: ReactNode; note?: ReactNode }) {
  return (
    <section className="sgroup">
      <h2 className="sgroup-title">{title}</h2>
      <div className="sgroup-card">{children}</div>
      {note && <p className="sgroup-note">{note}</p>}
    </section>
  )
}

function Row({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="srow">
      <div className="srow-text">
        <span className="srow-label">{label}</span>
        {hint && <span className="srow-hint">{hint}</span>}
      </div>
      {children}
    </div>
  )
}

export function Settings() {
  const { settings, setSettings, workouts, importData, storageError } = useStore()
  const [toast, setToast] = useState('')
  const importInput = useRef<HTMLInputElement>(null)
  const trackInput = useRef<HTMLInputElement>(null)
  const pendingSlot = useRef<MusicSlot>('work')

  const notify = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 2600)
  }

  const toggle = (key: BoolKey, label: string, hint?: string) => (
    <Row label={label} hint={hint}>
      <button className="switch" role="switch" aria-checked={settings[key]} aria-label={label} onClick={() => setSettings({ [key]: !settings[key] })}>
        <span />
      </button>
    </Row>
  )

  const pickTrack = (slot: MusicSlot) => {
    pendingSlot.current = slot
    trackInput.current?.click()
  }

  const onTrack = async (file: File | undefined) => {
    if (!file) return
    const slot = pendingSlot.current
    try {
      await saveTrack(slot, file)
      await setSettings(slot === 'work' ? { musicWorkName: file.name, music: true } : { musicRestName: file.name, music: true })
      await music.load()
      notify('Brano salvato')
    } catch {
      notify('Impossibile salvare il brano')
    }
  }

  const clearTrack = async (slot: MusicSlot) => {
    await removeTrack(slot)
    const patch: Partial<S> = slot === 'work' ? { musicWorkName: '' } : { musicRestName: '' }
    const other = slot === 'work' ? settings.musicRestName : settings.musicWorkName
    if (!other) patch.music = false
    await setSettings(patch)
    await music.load()
  }

  const onImport = async (file: File | undefined) => {
    if (!file) return
    try {
      const n = await importData(await parseImport(file))
      notify(n === 1 ? '1 allenamento importato' : `${n} allenamenti importati`)
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Importazione non riuscita')
    }
  }

  const trackRow = (slot: MusicSlot, label: string, name: string) => (
    <Row label={label} hint={name || 'Nessun brano'}>
      <div className="srow-actions">
        {name && (
          <button className="sbtn ghost" onClick={() => clearTrack(slot)}>
            Rimuovi
          </button>
        )}
        <button className="sbtn" onClick={() => pickTrack(slot)} disabled={storageError}>
          {name ? 'Cambia' : 'Scegli'}
        </button>
      </div>
    </Row>
  )

  return (
    <div className="settings">
      <h1 className="display page-title">Impostazioni</h1>

      <Group title="TIMER">
        {toggle('skipLastRest', 'Salta l’ultimo riposo', 'L’allenamento finisce con l’ultimo lavoro')}
        {toggle('skipLastRestBeforeSetRest', 'Salta il riposo prima del riposo tra i set')}
        {toggle('confirmExit', 'Conferma prima di uscire')}
        {toggle('pauseOnHide', 'Pausa quando esci dall’app', 'Chiamate, blocco schermo, cambio app')}
      </Group>

      <Group
        title="AUDIO E VOCE"
        note="I segnali si mescolano a Spotify o Apple Music senza fermarli. Con l’interruttore silenzioso dell’iPhone attivo non si sentono."
      >
        {toggle('sounds', 'Segnali acustici')}
        <Row label="Volume">
          <input
            className="srange"
            type="range"
            min={0.1}
            max={1}
            step={0.05}
            value={settings.volume}
            aria-label="Volume dei segnali"
            onChange={(e) => setSettings({ volume: Number(e.target.value) })}
          />
        </Row>
        {toggle('voice', 'Voce guida', '«Via!», «Riposo», «Metà»…')}
        {toggle('speakNames', 'Leggi i nomi degli esercizi', 'Attenzione: mentre parla mette in pausa la musica')}
        <Row label="Conto alla rovescia" hint="Bip prima di ogni cambio fase">
          <div className="seg-small" role="group" aria-label="Conto alla rovescia">
            {[0, 3, 5].map((n) => (
              <button key={n} className={settings.countdown === n ? 'on' : ''} aria-pressed={settings.countdown === n} onClick={() => setSettings({ countdown: n })}>
                {n === 0 ? 'No' : `${n} s`}
              </button>
            ))}
          </div>
        </Row>
        {toggle('halfway', 'Segnale a metà lavoro', 'Per intervalli da 20 s in su')}
        <Row label="Prova i suoni">
          <button
            className="sbtn"
            onClick={() => {
              primeMedia(settings)
              sounds.work()
              setTimeout(() => playClip('via'), 450)
            }}
          >
            Ascolta
          </button>
        </Row>
      </Group>

      <Group title="SCHERMO">{toggle('keepAwake', 'Mantieni lo schermo acceso', 'Durante l’allenamento')}</Group>

      <Group
        title="MUSICA PER INTERVALLO"
        note="Un brano per il lavoro e uno per il riposo, presi dai tuoi file. Ripartono da dove erano rimasti. Su iPhone fermano Spotify o Apple Music: usali in alternativa alla musica in sottofondo."
      >
        {toggle('music', 'Attiva')}
        {trackRow('work', 'Brano del lavoro', settings.musicWorkName)}
        {trackRow('rest', 'Brano del riposo', settings.musicRestName)}
      </Group>

      <Group title="DATI" note="Il backup contiene allenamenti, statistiche e impostazioni (non i brani). Puoi importare anche un singolo allenamento condiviso.">
        <Row label="Esporta backup">
          <button
            className="sbtn"
            onClick={async () => {
              const r = await exportBackup(workouts, settings)
              if (r === 'downloaded') notify('Backup scaricato')
            }}
          >
            Esporta
          </button>
        </Row>
        <Row label="Importa">
          <button className="sbtn" onClick={() => importInput.current?.click()}>
            Scegli file
          </button>
        </Row>
      </Group>

      <p className="about">
        <span className="display">
          Tabata t<span className="ai">AI</span>mer
        </span>
        <br />
        Versione {__APP_VERSION__} · Nessuna pubblicità, nessun abbonamento.
      </p>

      <input ref={importInput} type="file" accept="application/json,.json" hidden onChange={(e) => (onImport(e.target.files?.[0]), (e.target.value = ''))} />
      <input ref={trackInput} type="file" accept="audio/*" hidden onChange={(e) => (onTrack(e.target.files?.[0]), (e.target.value = ''))} />

      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </div>
  )
}
