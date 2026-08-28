'use client'

import { useState, useEffect, useRef } from 'react'
import { Zap, Download, Home, Activity, TrendingUp, Users, Camera } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

export default function Page() {
  const [activeTab, setActiveTab] = useState('home')
  const [athleteName, setAthleteName] = useState('Athlete 1')
  const [sessions, setSessions] = useState([])
  const [cameraActive, setCameraActive] = useState(false)
  const videoRef = useRef(null)

  useEffect(() => {
    const saved = localStorage.getItem('sessions')
    if (saved) setSessions(JSON.parse(saved))
  }, [])

  useEffect(() => {
    if (sessions.length > 0) {
      localStorage.setItem('sessions', JSON.stringify(sessions))
    }
  }, [sessions])

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } })
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        setCameraActive(true)
      }
    } catch (error) {
      alert('Camera access denied')
    }
  }

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      videoRef.current.srcObject.getTracks().forEach(track => track.stop())
      setCameraActive(false)
    }
  }

  const addLiftSession = (data) => {
    setSessions([...sessions, { id: Date.now(), type: 'lift', athlete: athleteName, timestamp: new Date().toISOString(), ...data }])
  }

  const addJumpSession = (data) => {
    setSessions([...sessions, { id: Date.now(), type: 'jump', athlete: athleteName, timestamp: new Date().toISOString(), ...data }])
  }

  const addSprintSession = (data) => {
    setSessions([...sessions, { id: Date.now(), type: 'sprint', athlete: athleteName, timestamp: new Date().toISOString(), ...data }])
  }

  const exportToCSV = () => {
    if (sessions.length === 0) { alert('No data to export'); return }
    const csv = [['Type', 'Athlete', 'Date', 'Data'].join(','), ...sessions.map(s => [s.type, s.athlete, new Date(s.timestamp).toLocaleDateString(), JSON.stringify(s)].join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `runnoz-performance-${Date.now()}.csv`
    a.click()
  }

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <div style={styles.logo}>
          <Zap size={28} color="#FF5C4D" />
          <h1 style={styles.title}>RUNNOZ Performance</h1>
        </div>
        <div style={styles.headerRight}>
          <input type="text" value={athleteName} onChange={(e) => setAthleteName(e.target.value)} placeholder="Athlete name" style={styles.input} />
          <button onClick={exportToCSV} style={styles.exportBtn}><Download size={18} /> Export CSV</button>
        </div>
      </header>

      <nav style={styles.nav}>
        {['home', 'lift', 'jump', 'sprint', 'squad'].map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={{...styles.navBtn, ...(activeTab === tab ? styles.navBtnActive : {})}}>
            {tab === 'home' && <Home size={18} />}
            {tab === 'lift' && <Zap size={18} />}
            {tab === 'jump' && <Activity size={18} />}
            {tab === 'sprint' && <TrendingUp size={18} />}
            {tab === 'squad' && <Users size={18} />}
            {' ' + tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </nav>

      <main style={styles.main}>
        {activeTab === 'home' && <Dashboard sessions={sessions} />}
        {activeTab === 'lift' && <LiftTab onAdd={addLiftSession} cameraActive={cameraActive} videoRef={videoRef} startCamera={startCamera} stopCamera={stopCamera} />}
        {activeTab === 'jump' && <JumpTab onAdd={addJumpSession} cameraActive={cameraActive} videoRef={videoRef} startCamera={startCamera} stopCamera={stopCamera} />}
        {activeTab === 'sprint' && <SprintTab onAdd={addSprintSession} cameraActive={cameraActive} videoRef={videoRef} startCamera={startCamera} stopCamera={stopCamera} />}
        {activeTab === 'squad' && <Squad sessions={sessions} />}
      </main>
    </div>
  )
}

function Dashboard({ sessions }) {
  const liftSessions = sessions.filter(s => s.type === 'lift')
  const jumpSessions = sessions.filter(s => s.type === 'jump')
  const sprintSessions = sessions.filter(s => s.type === 'sprint')

  return (
    <div style={styles.tabContent}>
      <h2 style={styles.sectionTitle}>Performance Overview</h2>
      <div style={styles.cardGrid}>
        <div style={styles.card}>
          <h3 style={styles.cardTitle}>Lift Sessions</h3>
          <p style={{fontSize: '28px', fontWeight: 'bold', color: '#FF5C4D'}}>{liftSessions.length}</p>
          <p style={styles.cardSubtitle}>Total lifts logged</p>
        </div>
        <div style={styles.card}>
          <h3 style={styles.cardTitle}>Jump Sessions</h3>
          <p style={{fontSize: '28px', fontWeight: 'bold', color: '#3FB950'}}>{jumpSessions.length}</p>
          <p style={styles.cardSubtitle}>Total jumps logged</p>
        </div>
        <div style={styles.card}>
          <h3 style={styles.cardTitle}>Sprint Sessions</h3>
          <p style={{fontSize: '28px', fontWeight: 'bold', color: '#58A6FF'}}>{sprintSessions.length}</p>
          <p style={styles.cardSubtitle}>Total sprints logged</p>
        </div>
      </div>
    </div>
  )
}

function LiftTab({ onAdd, cameraActive, videoRef, startCamera, stopCamera }) {
  const [weight, setWeight] = useState('')
  const [reps, setReps] = useState('')
  const [barSpeed, setBarSpeed] = useState('')

  const handleSubmit = () => {
    if (!weight || !reps || !barSpeed) { alert('Fill all fields'); return }
    const w = parseFloat(weight), r = parseInt(reps), bs = parseFloat(barSpeed)
    onAdd({ weight: w, reps: r, barSpeed: bs, estimated1RM: w * (1 + r / 30), power: (w * 9.81 * bs) / 1000 })
    setWeight(''); setReps(''); setBarSpeed('')
    alert('Lift logged!')
  }

  return (
    <div style={styles.tabContent}>
      <h2 style={styles.sectionTitle}>Barbell Velocity Tracking</h2>
      {cameraActive ? (
        <div style={styles.cameraContainer}>
          <video ref={videoRef} autoPlay playsInline style={styles.video} />
          <button onClick={stopCamera} style={styles.stopBtn}>Stop Camera</button>
        </div>
      ) : (
        <div style={styles.cameraControls}>
          <button onClick={startCamera} style={styles.cameraBtn}><Camera size={20} /> Start Camera</button>
        </div>
      )}
      <div style={styles.card}>
        <h3 style={styles.cardTitle}>Log Lift</h3>
        <div style={styles.formGrid}>
          <div>
            <label style={styles.label}>Weight (kg)</label>
            <input value={weight} onChange={(e) => setWeight(e.target.value)} type="number" placeholder="100" style={styles.input} />
          </div>
          <div>
            <label style={styles.label}>Reps</label>
            <input value={reps} onChange={(e) => setReps(e.target.value)} type="number" placeholder="5" style={styles.input} />
          </div>
          <div>
            <label style={styles.label}>Bar Speed (m/s)</label>
            <input value={barSpeed} onChange={(e) => setBarSpeed(e.target.value)} type="number" step="0.01" placeholder="0.85" style={styles.input} />
          </div>
        </div>
        <button onClick={handleSubmit} style={styles.submitBtn}>Log Lift</button>
      </div>
    </div>
  )
}

function JumpTab({ onAdd, cameraActive, videoRef, startCamera, stopCamera }) {
  const [jumpHeight, setJumpHeight] = useState('')
  const [contactTime, setContactTime] = useState('')
  const [flightTime, setFlightTime] = useState('')

  const handleSubmit = () => {
    if (!jumpHeight || !contactTime || !flightTime) { alert('Fill all fields'); return }
    const jh = parseFloat(jumpHeight), ct = parseFloat(contactTime), ft = parseFloat(flightTime)
    onAdd({ jumpHeight: jh, contactTime: ct, flightTime: ft, rsi: ft / ct })
    setJumpHeight(''); setContactTime(''); setFlightTime('')
    alert('Jump logged!')
  }

  return (
    <div style={styles.tabContent}>
      <h2 style={styles.sectionTitle}>Vertical Jump Testing</h2>
      {cameraActive ? (
        <div style={styles.cameraContainer}>
          <video ref={videoRef} autoPlay playsInline style={styles.video} />
          <button onClick={stopCamera} style={styles.stopBtn}>Stop Camera</button>
        </div>
      ) : (
        <div style={styles.cameraControls}>
          <button onClick={startCamera} style={styles.cameraBtn}><Camera size={20} /> Start Camera</button>
        </div>
      )}
      <div style={styles.card}>
        <h3 style={styles.cardTitle}>Log Jump</h3>
        <div style={styles.formGrid}>
          <div>
            <label style={styles.label}>Jump Height (cm)</label>
            <input value={jumpHeight} onChange={(e) => setJumpHeight(e.target.value)} type="number" placeholder="45" style={styles.input} />
          </div>
          <div>
            <label style={styles.label}>Contact Time (ms)</label>
            <input value={contactTime} onChange={(e) => setContactTime(e.target.value)} type="number" placeholder="500" style={styles.input} />
          </div>
          <div>
            <label style={styles.label}>Flight Time (ms)</label>
            <input value={flightTime} onChange={(e) => setFlightTime(e.target.value)} type="number" placeholder="600" style={styles.input} />
          </div>
        </div>
        <button onClick={handleSubmit} style={styles.submitBtn}>Log Jump</button>
      </div>
    </div>
  )
}

function SprintTab({ onAdd, cameraActive, videoRef, startCamera, stopCamera }) {
  const [split10m, setSplit10m] = useState('')
  const [split20m, setSplit20m] = useState('')

  const handleSubmit = () => {
    if (!split10m || !split20m) { alert('Fill all fields'); return }
    const s10 = parseFloat(split10m), s20 = parseFloat(split20m)
    onAdd({ split10m: s10, split20m: s20, topSpeed: 10 / (s20 - s10) })
    setSplit10m(''); setSplit20m('')
    alert('Sprint logged!')
  }

  return (
    <div style={styles.tabContent}>
      <h2 style={styles.sectionTitle}>Sprint Testing</h2>
      {cameraActive ? (
        <div style={styles.cameraContainer}>
          <video ref={videoRef} autoPlay playsInline style={styles.video} />
          <button onClick={stopCamera} style={styles.stopBtn}>Stop Camera</button>
        </div>
      ) : (
        <div style={styles.cameraControls}>
          <button onClick={startCamera} style={styles.cameraBtn}><Camera size={20} /> Start Camera</button>
        </div>
      )}
      <div style={styles.card}>
        <h3 style={styles.cardTitle}>Log Sprint</h3>
        <div style={styles.formGrid}>
          <div>
            <label style={styles.label}>10m Split (sec)</label>
            <input value={split10m} onChange={(e) => setSplit10m(e.target.value)} type="number" step="0.01" placeholder="1.65" style={styles.input} />
          </div>
          <div>
            <label style={styles.label}>20m Split (sec)</label>
            <input value={split20m} onChange={(e) => setSplit20m(e.target.value)} type="number" step="0.01" placeholder="3.10" style={styles.input} />
          </div>
        </div>
        <button onClick={handleSubmit} style={styles.submitBtn}>Log Sprint</button>
      </div>
    </div>
  )
}

function Squad({ sessions }) {
  const athletes = [...new Set(sessions.map(s => s.athlete))]
  return (
    <div style={styles.tabContent}>
      <h2 style={styles.sectionTitle}>Squad Dashboard</h2>
      {athletes.length === 0 ? (
        <p>No athletes yet. Log some sessions!</p>
      ) : (
        <div style={styles.cardGrid}>
          {athletes.map(athlete => {
            const athleteSessions = sessions.filter(s => s.athlete === athlete)
            return (
              <div key={athlete} style={styles.card}>
                <h3 style={styles.cardTitle}>{athlete}</h3>
                <p>Lifts: {athleteSessions.filter(s => s.type === 'lift').length}</p>
                <p>Jumps: {athleteSessions.filter(s => s.type === 'jump').length}</p>
                <p>Sprints: {athleteSessions.filter(s => s.type === 'sprint').length}</p>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

const styles = {
  container: { minHeight: '100vh', backgroundColor: '#0D1117', color: '#F0F6FC' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px', borderBottom: '1px solid #30363D', backgroundColor: '#0D1117' },
  logo: { display: 'flex', alignItems: 'center', gap: '12px' },
  title: { fontSize: '20px', fontWeight: '700', margin: 0 },
  headerRight: { display: 'flex', gap: '12px', alignItems: 'center' },
  input: { backgroundColor: '#161B22', color: '#F0F6FC', border: '1px solid #30363D', padding: '8px 12px', borderRadius: '6px', fontSize: '14px' },
  exportBtn: { display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: '#FF5C4D', color: '#FFF', padding: '8px 16px', borderRadius: '6px', fontSize: '14px', fontWeight: '600', cursor: 'pointer', border: 'none' },
  nav: { display: 'flex', gap: '8px', padding: '12px 24px', borderBottom: '1px solid #30363D', backgroundColor: '#161B22', overflowX: 'auto' },
  navBtn: { display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', backgroundColor: 'transparent', color: '#8B949E', border: '1px solid #30363D', borderRadius: '6px', fontSize: '14px', cursor: 'pointer', whiteSpace: 'nowrap' },
  navBtnActive: { backgroundColor: '#FF5C4D', color: '#FFF', borderColor: '#FF5C4D' },
  main: { padding: '24px' },
  tabContent: { maxWidth: '1200px', margin: '0 auto' },
  sectionTitle: { fontSize: '24px', fontWeight: '700', marginBottom: '24px', color: '#F0F6FC' },
  card: { backgroundColor: '#161B22', border: '1px solid #30363D', borderRadius: '12px', padding: '20px', marginBottom: '20px' },
  cardTitle: { fontSize: '16px', fontWeight: '600', marginBottom: '16px', color: '#F0F6FC' },
  cardSubtitle: { fontSize: '13px', color: '#8B949E', marginTop: '8px' },
  cardGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px', marginBottom: '24px' },
  cameraContainer: { position: 'relative', marginBottom: '24px', borderRadius: '12px', overflow: 'hidden', backgroundColor: '#000' },
  video: { width: '100%', height: 'auto', display: 'block', maxHeight: '500px' },
  cameraControls: { display: 'flex', justifyContent: 'center', padding: '40px 20px', backgroundColor: '#161B22', borderRadius: '12px', marginBottom: '24px' },
  cameraBtn: { display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: '#FF5C4D', color: '#FFF', padding: '12px 24px', borderRadius: '8px', fontSize: '16px', fontWeight: '600', cursor: 'pointer', border: 'none' },
  stopBtn: { position: 'absolute', bottom: '16px', right: '16px', backgroundColor: '#FF5C4D', color: '#FFF', padding: '8px 16px', borderRadius: '6px', fontSize: '14px', fontWeight: '600', cursor: 'pointer', border: 'none' },
  formGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '16px', marginBottom: '16px' },
  label: { display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '6px', color: '#8B949E' },
  submitBtn: { width: '100%', backgroundColor: '#FF5C4D', color: '#FFF', padding: '12px 24px', borderRadius: '8px', fontSize: '16px', fontWeight: '600', cursor: 'pointer', border: 'none' },
}