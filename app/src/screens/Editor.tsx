import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useStore } from '../store'
import { Stepper } from '../components/Stepper'
import { DurationSheet } from '../components/DurationSheet'
import { Sheet } from '../components/Sheet'
import { newId } from '../data/db'
import { formatDuration } from '../engine/format'
import { phaseColor, shortDuration, workoutSummary } from '../engine/summary'
import type { CustomStep, Workout } from '../engine/types'
import { primeMedia } from '../audio/start'
import './Editor.css'

type TimeField = 'prepare' | 'work' | 'rest' | 'restBetweenSets' | 'coolDown'
type DurTarget = { field: TimeField; title: string } | { stepId: string; title: string } | null

const SAVE_DELAY = 300

export function Editor({ workoutId }: { workoutId: string }) {
  const stored = useStore((s) => s.workouts.find((w) => w.id === workoutId))
  const { save, navigate, settings } = useStore()
  const [draft, setDraft] = useState<Workout | undefined>(stored)
  const [durTarget, setDurTarget] = useState<DurTarget>(null)
  const [preview, setPreview] = useState(false)
  const saveTimer = useRef<number | undefined>(undefined)
  const pending = useRef<Workout | null>(null)

  // salvataggio automatico, raggruppato mentre si tiene premuto un +/−
  const flush = () => {
    clearTimeout(saveTimer.current)
    if (pending.current) save(pending.current)
    pending.current = null
  }
  useEffect(() => {
    const timer = saveTimer
    const queued = pending
    return () => {
      clearTimeout(timer.current)
      if (queued.current) save(queued.current)
    }
  }, [save])

  if (!draft) {
    return (
      <div className="screen">
        <p>Allenamento non trovato.</p>
        <button className="btn" onClick={() => navigate({ name: 'tabs' })}>
          Torna alla lista
        </button>
      </div>
    )
  }

  const update = (patch: Partial<Workout>) => {
    const next = { ...draft, ...patch }
    setDraft(next)
    pending.current = next
    clearTimeout(saveTimer.current)
    saveTimer.current = window.setTimeout(flush, SAVE_DELAY)
  }

  const updateStep = (id: string, patch: Partial<CustomStep>) => update({ steps: draft.steps.map((s) => (s.id === id ? { ...s, ...patch } : s)) })

  const addStep = (kind: CustomStep['kind']) => {
    const n = draft.steps.filter((s) => s.kind === 'work').length + 1
    update({ steps: [...draft.steps, { id: newId(), kind, label: kind === 'work' ? `Esercizio ${n}` : '', duration: kind === 'work' ? 30 : 10 }] })
  }

  const moveStep = (i: number, dir: -1 | 1) => {
    const steps = [...draft.steps]
    const j = i + dir
    if (j < 0 || j >= steps.length) return
    ;[steps[i], steps[j]] = [steps[j], steps[i]]
    update({ steps })
  }

  const setMode = (mode: Workout['mode']) => {
    if (mode === 'custom' && draft.steps.length === 0) {
      // parte dai valori della modalità semplice
      update({
        mode,
        steps: [
          { id: newId(), kind: 'work', label: draft.workLabel || 'Esercizio 1', duration: draft.work || 30 },
          { id: newId(), kind: 'rest', label: draft.restLabel, duration: draft.rest },
        ].filter((s) => s.duration > 0) as CustomStep[],
      })
    } else update({ mode })
  }

  const summary = workoutSummary(draft, settings)
  const durSeconds = durTarget ? ('field' in durTarget ? draft[durTarget.field] : (draft.steps.find((s) => s.id === durTarget.stepId)?.duration ?? 0)) : 0

  const timeRow = (field: TimeField, label: string, hint: string, color: string, extra?: ReactNode) => (
    <div className="erow">
      <span className="edot" style={{ background: color }} aria-hidden="true" />
      <div className="erow-text">
        <span className="erow-label">{label}</span>
        {extra ?? <span className="erow-hint">{hint}</span>}
      </div>
      <Stepper label={label} time value={draft[field]} onChange={(v) => update({ [field]: v })} onValueTap={() => setDurTarget({ field, title: label })} />
    </div>
  )

  const countRow = (field: 'cycles' | 'sets', label: string, hint: string) => (
    <div className="erow">
      <span className="edot" style={{ background: 'var(--cream)' }} aria-hidden="true" />
      <div className="erow-text">
        <span className="erow-label">{label}</span>
        <span className="erow-hint">{hint}</span>
      </div>
      <Stepper label={label} value={draft[field]} min={1} max={99} onChange={(v) => update({ [field]: v })} />
    </div>
  )

  const labelInput = (field: 'workLabel' | 'restLabel', placeholder: string) => (
    <input className="erow-input" value={draft[field]} placeholder={placeholder} aria-label={`Descrizione ${placeholder}`} onChange={(e) => update({ [field]: e.target.value })} />
  )

  return (
    <div className="editor">
      <header className="ed-header">
        <button
          className="icon-btn"
          aria-label="Indietro"
          onClick={() => {
            flush()
            navigate({ name: 'tabs' })
          }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M15 5l-7 7 7 7" />
          </svg>
        </button>
        <div className="ed-title">
          <input
            className="display ed-name"
            value={draft.name}
            aria-label="Nome allenamento"
            onFocus={(e) => e.target.select()}
            onChange={(e) => update({ name: e.target.value })}
            onBlur={() => !draft.name.trim() && update({ name: 'Senza nome' })}
          />
          <span className="num ed-sub">
            {formatDuration(summary.total)} · {summary.intervals} intervalli
          </span>
        </div>
        <button className="icon-btn" aria-label="Anteprima sequenza" onClick={() => setPreview(true)}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        </button>
      </header>

      <div className="segmented" role="group" aria-label="Modalità">
        {(
          [
            ['simple', 'Semplice'],
            ['custom', 'Personalizzato'],
          ] as const
        ).map(([m, l]) => (
          <button key={m} className={draft.mode === m ? 'on' : ''} aria-pressed={draft.mode === m} onClick={() => setMode(m)}>
            {l}
          </button>
        ))}
      </div>

      <main className="ed-body">
        {timeRow('prepare', 'Preparazione', 'Prima di iniziare', phaseColor.prepare)}

        {draft.mode === 'simple' ? (
          <>
            {timeRow('work', 'Lavoro', '', phaseColor.work, labelInput('workLabel', 'es. Burpees'))}
            {timeRow('rest', 'Riposo', '', phaseColor.rest, labelInput('restLabel', 'es. Respira'))}
          </>
        ) : (
          <section className="steps" aria-label="Passi del ciclo">
            {draft.steps.map((s, i) => (
              <div key={s.id} className="erow step">
                <button
                  className="edot-btn"
                  aria-label={`Tipo: ${s.kind === 'work' ? 'lavoro' : 'riposo'}. Tocca per cambiare`}
                  onClick={() => updateStep(s.id, { kind: s.kind === 'work' ? 'rest' : 'work' })}
                >
                  <span className="edot" style={{ background: phaseColor[s.kind] }} />
                </button>
                <div className="erow-text">
                  <input
                    className="erow-input strong"
                    value={s.label}
                    placeholder={s.kind === 'work' ? 'Esercizio' : 'Riposo'}
                    aria-label={`Nome passo ${i + 1}`}
                    onChange={(e) => updateStep(s.id, { label: e.target.value })}
                  />
                  <div className="step-tools">
                    <button aria-label="Sposta su" disabled={i === 0} onClick={() => moveStep(i, -1)}>
                      ↑
                    </button>
                    <button aria-label="Sposta giù" disabled={i === draft.steps.length - 1} onClick={() => moveStep(i, 1)}>
                      ↓
                    </button>
                    <button aria-label="Elimina passo" className="del" onClick={() => update({ steps: draft.steps.filter((x) => x.id !== s.id) })}>
                      Elimina
                    </button>
                  </div>
                </div>
                <Stepper label={s.label || 'passo'} time min={1} value={s.duration} onChange={(v) => updateStep(s.id, { duration: v })} onValueTap={() => setDurTarget({ stepId: s.id, title: s.label || 'Durata' })} />
              </div>
            ))}
            <div className="step-add">
              <button className="btn" onClick={() => addStep('work')}>
                + Esercizio
              </button>
              <button className="btn" onClick={() => addStep('rest')}>
                + Riposo
              </button>
            </div>
          </section>
        )}

        {countRow('cycles', 'Cicli', draft.mode === 'simple' ? 'Lavoro + riposo' : 'Ripeti i passi')}
        {countRow('sets', 'Set', 'Ripeti tutti i cicli')}
        {draft.sets > 1 && timeRow('restBetweenSets', 'Riposo tra i set', 'Pausa lunga', phaseColor.setRest)}
        {timeRow('coolDown', 'Defaticamento', 'Alla fine', phaseColor.cooldown)}
      </main>

      <footer className="ed-footer">
        <button
          className="btn primary ed-start"
          disabled={summary.total === 0}
          onClick={() => {
            flush()
            primeMedia(settings)
            navigate({ name: 'timer', workoutId: draft.id })
          }}
        >
          INIZIA
        </button>
      </footer>

      <DurationSheet
        open={durTarget !== null}
        title={durTarget?.title ?? ''}
        seconds={durSeconds}
        onClose={() => setDurTarget(null)}
        onConfirm={(v) => {
          if (durTarget && 'field' in durTarget) update({ [durTarget.field]: v })
          else if (durTarget) updateStep(durTarget.stepId, { duration: Math.max(1, v) })
          setDurTarget(null)
        }}
      />

      <Sheet open={preview} onClose={() => setPreview(false)} title={`Sequenza · ${formatDuration(summary.total)}`}>
        <ol className="preview-list">
          {summary.seq.map((iv, i) => (
            <li key={i}>
              <span className="num preview-n">{i + 1}</span>
              <span className="edot" style={{ background: phaseColor[iv.kind] }} aria-hidden="true" />
              <span className="preview-label">
                {iv.label}
                {iv.cycle > 0 && (
                  <small>
                    {' '}
                    · ciclo {iv.cycle}
                    {iv.sets > 1 && `, set ${iv.set}`}
                  </small>
                )}
              </span>
              <span className="display num">{shortDuration(iv.duration)}</span>
            </li>
          ))}
        </ol>
      </Sheet>
    </div>
  )
}
