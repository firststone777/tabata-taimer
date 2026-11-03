import { useEffect, useState } from 'react'
import { TabBar, type Tab } from './components/TabBar'
import { useStore } from './store'
import { Home } from './screens/Home'
import { Editor } from './screens/Editor'
import { Timer } from './screens/Timer'
import { Settings } from './screens/Settings'
import { Stats } from './screens/Stats'
import './App.css'

export default function App() {
  const [tab, setTab] = useState<Tab>('workouts')
  const { loaded, load, route } = useStore()

  useEffect(() => {
    load()
  }, [load])

  if (!loaded) return null

  if (route.name === 'editor') return <Editor key={route.workoutId} workoutId={route.workoutId} />
  if (route.name === 'timer') return <Timer key={route.workoutId} workoutId={route.workoutId} />

  return (
    <div className="app">
      <main className="screen">
        {tab === 'workouts' && <Home />}
        {tab === 'stats' && <Stats />}
        {tab === 'settings' && <Settings />}
      </main>
      <TabBar active={tab} onChange={setTab} />
    </div>
  )
}
