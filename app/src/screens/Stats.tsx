import { useState } from 'react'
import { useStore } from '../store'
import { Sheet } from '../components/Sheet'
import { summarize } from '../engine/stats'
import { formatDuration } from '../engine/format'
import './Stats.css'

const DAYS = ['L', 'M', 'M', 'G', 'V', 'S', 'D']
const DAY_NAMES = ['lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato', 'domenica']

const dateFmt = new Intl.DateTimeFormat('it-IT', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

export function Stats() {
  const { sessions, clearSessions } = useStore()
  const [confirm, setConfirm] = useState(false)
  const [now] = useState(() => Date.now())
  const s = summarize(sessions, now)
  const today = (new Date(now).getDay() + 6) % 7
  const max = Math.max(10, ...s.week)
  const recent = [...sessions].sort((a, b) => b.startedAt - a.startedAt).slice(0, 30)

  return (
    <div className="stats">
      <h1 className="display page-title">Statistiche</h1>

      {sessions.length === 0 ? (
        <section className="empty">
          <p className="display empty-title">Ancora nessuna sessione.</p>
          <p className="empty-text">Completa un allenamento e qui vedrai minuti, serie e storico.</p>
        </section>
      ) : (
        <>
          <div className="tiles">
            <div className="tile">
              <span className="display num tile-value">{s.weekMinutes}</span>
              <span className="tile-label">minuti questa settimana</span>
            </div>
            <div className="tile">
              <span className="display num tile-value">{s.streak}</span>
              <span className="tile-label">{s.streak === 1 ? 'giorno di fila' : 'giorni di fila'}</span>
            </div>
            <div className="tile">
              <span className="display num tile-value">{s.completed}</span>
              <span className="tile-label">allenamenti completati</span>
            </div>
            <div className="tile">
              <span className="display num tile-value">{s.totalMinutes >= 120 ? `${Math.round(s.totalMinutes / 60)} h` : s.totalMinutes}</span>
              <span className="tile-label">{s.totalMinutes >= 120 ? 'di allenamento in totale' : 'minuti in totale'}</span>
            </div>
          </div>

          <section className="week" aria-label="Minuti per giorno, settimana corrente">
            <h2 className="sgroup-title">QUESTA SETTIMANA</h2>
            <div className="week-chart">
              {s.week.map((m, i) => (
                <div key={i} className={i === today ? 'wday today' : 'wday'}>
                  <span className="num wday-min">{m > 0 ? Math.round(m) : ''}</span>
                  <div className="wday-track">
                    <div className="wday-bar" style={{ height: `${(m / max) * 100}%` }} />
                  </div>
                  <span className="wday-label" aria-label={`${DAY_NAMES[i]}: ${Math.round(m)} minuti`}>
                    {DAYS[i]}
                  </span>
                </div>
              ))}
            </div>
          </section>

          <section className="history">
            <h2 className="sgroup-title">STORICO</h2>
            <ul className="sgroup-card hist-list">
              {recent.map((x) => (
                <li key={x.id} className="hist-row">
                  <span className={x.completed ? 'hist-dot done' : 'hist-dot'} aria-label={x.completed ? 'Completato' : 'Interrotto'} role="img" />
                  <div className="hist-text">
                    <span className="hist-name">{x.workoutName}</span>
                    <span className="hist-date">
                      {dateFmt.format(x.startedAt)}
                      {!x.completed && ' · interrotto'}
                    </span>
                  </div>
                  <span className="display num hist-dur">{formatDuration(x.activeSeconds)}</span>
                </li>
              ))}
            </ul>
            <button className="btn clear-btn" onClick={() => setConfirm(true)}>
              Cancella lo storico
            </button>
          </section>
        </>
      )}

      <Sheet open={confirm} onClose={() => setConfirm(false)} title="Cancellare lo storico?">
        <p className="confirm-text">Verranno eliminate tutte le {sessions.length} sessioni registrate. Gli allenamenti restano.</p>
        <div className="sheet-buttons">
          <button className="btn" onClick={() => setConfirm(false)}>
            Annulla
          </button>
          <button className="btn danger" onClick={() => (clearSessions(), setConfirm(false))}>
            Cancella
          </button>
        </div>
      </Sheet>
    </div>
  )
}
