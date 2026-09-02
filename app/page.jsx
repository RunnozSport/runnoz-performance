'use client'

import { useState, useEffect, useRef } from 'react'
import { Zap, Download, Home, Activity, TrendingUp, Users, Camera, StopCircle } from 'lucide-react'

export default function Page() {
  const [activeTab, setActiveTab] = useState('home')
  const [athleteName, setAthleteName] = useState('Athlete 1')
  const [sessions, setSessions] = useState([])
  const [cameraActive, setCameraActive] = useState(false)
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const mediaStreamRef = useRef(null)
  const poseDetectorRef = useRef(null)

  useEffect(() => {
  const saved = localStorage.getItem('sessions')
  if (saved) setSessions(JSON.parse(saved))
}, [])

  useEffect(() => {
    if (sessions.length > 0) {
      localStorage.setItem('sessions', JSON.stringify(sessions))
    }
  }, [sessions])

  const initMediaPipe = async () => {
  // MediaPipe will be loaded in browser only
  console.log('App initialized')
}

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: 'environment',
          width: { ideal: 1280 }, 
          height: { ideal: 720 } 
        }
      })
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        mediaStreamRef.current = stream
        setCameraActive(true)
        drawPoseOverlay()
      }
    } catch (error) {
      alert('Camera access denied')
    }
  }

  const stopCamera = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop())
      setCameraActive(false)
    }
  }

  const drawPoseOverlay = async () => {
    if (!cameraActive || !videoRef.current || !canvasRef.current) return

    const canvas = canvasRef.current
    const video = videoRef.current
    const ctx = canvas.getContext('2d')

    canvas.width = video.videoWidth || 640
    canvas.height = video.videoHeight || 480

    const drawFrame = async () => {
      try {
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

        // Draw skeleton (demo points - replace with real MediaPipe pose)
        const joints = [
          { name: 'shoulder_left', x: canvas.width * 0.25, y: canvas.height * 0.2 },
          { name: 'shoulder_right', x: canvas.width * 0.75, y: canvas.height * 0.2 },
          { name: 'elbow_left', x: canvas.width * 0.2, y: canvas.height * 0.4 },
          { name: 'elbow_right', x: canvas.width * 0.8, y: canvas.height * 0.4 },
          { name: 'wrist_left', x: canvas.width * 0.15, y: canvas.height * 0.6 },
          { name: 'wrist_right', x: canvas.width * 0.85, y: canvas.height * 0.6 },
        ]

        // Draw lines (skeleton)
        ctx.strokeStyle = '#00FF00'
        ctx.lineWidth = 3
        const connections = [
          [0, 2], [1, 3], [2, 4], [3, 5]
        ]
        connections.forEach(([start, end]) => {
          ctx.beginPath()
          ctx.moveTo(joints[start].x, joints[start].y)
          ctx.lineTo(joints[end].x, joints[end].y)
          ctx.stroke()
        })

        // Draw circles at joints
        ctx.fillStyle = '#00FF00'
        joints.forEach(joint => {
          ctx.beginPath()
          ctx.arc(joint.x, joint.y, 6, 0, Math.PI * 2)
          ctx.fill()
        })

        // Draw bar path (demo)
        ctx.strokeStyle = '#FF5C4D'
        ctx.lineWidth = 4
        ctx.beginPath()
        ctx.moveTo(canvas.width * 0.2, canvas.height * 0.35)
        ctx.lineTo(canvas.width * 0.8, canvas.height * 0.35)
        ctx.stroke()

        // Draw metrics overlay
        ctx.fillStyle = '#FF5C4D'
        ctx.font = 'bold 24px Arial'
        ctx.fillText('Bar Speed: 0.98 m/s', 20, 50)
        ctx.font = '18px Arial'
        ctx.fillText('Power: 1,250 W', 20, 80)
        ctx.fillText('1RM: 130 kg', 20, 110)
        ctx.fillText('RPE: 8/10', 20, 140)

        // Draw weight indicator (left side)
        ctx.fillStyle = '#FFF'
        ctx.font = 'bold 16px Arial'
        ctx.fillText('30kg 1/3', 20, canvas.height - 20)

        if (cameraActive) {
          requestAnimationFrame(drawFrame)
        }
      } catch (e) {
        console.error('Draw error:', e)
      }
    }

    drawFrame()
  }

  const addSession = (data) => {
    setSessions([...sessions, { 
      id: Date.now(), 
      type: 'lift', 
      athlete: athleteName, 
      timestamp: new Date().toISOString(), 
      ...data 
    }])
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
        {['home', 'lift'].map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={{...styles.navBtn, ...(activeTab === tab ? styles.navBtnActive : {})}}>
            {tab === 'home' && <Home size={18} />}
            {tab === 'lift' && <Zap size={18} />}
            {' ' + tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </nav>

      <main style={styles.main}>
        {activeTab === 'home' && <Dashboard sessions={sessions} />}
        {activeTab === 'lift' && <LiftTab cameraActive={cameraActive} videoRef={videoRef} canvasRef={canvasRef} startCamera={startCamera} stopCamera={stopCamera} onAddSession={addSession} />}
      </main>
    </div>
  )
}

function Dashboard({ sessions }) {
  return (
    <div style={styles.tabContent}>
      <h2 style={styles.sectionTitle}>Performance Overview</h2>
      <div style={styles.cardGrid}>
        <div style={styles.card}>
          <h3 style={styles.cardTitle}>Sessions Logged</h3>
          <p style={{fontSize: '28px', fontWeight: 'bold', color: '#FF5C4D'}}>{sessions.length}</p>
        </div>
      </div>
      {sessions.length > 0 && (
        <div style={styles.card}>
          <h3 style={styles.cardTitle}>Session History</h3>
          {sessions.map(s => (
            <div key={s.id} style={{padding: '12px 0', borderBottom: '1px solid #30363D'}}>
              <p>{s.athlete} - {new Date(s.timestamp).toLocaleDateString()}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function LiftTab({ cameraActive, videoRef, canvasRef, startCamera, stopCamera, onAddSession }) {
  const [weight, setWeight] = useState('30')
  const [reps, setReps] = useState('5')
  const [barSpeed, setBarSpeed] = useState('0.98')

  const handleSubmit = () => {
    if (!weight || !reps || !barSpeed) { alert('Fill all fields'); return }
    onAddSession({
      weight: parseFloat(weight),
      reps: parseInt(reps),
      barSpeed: parseFloat(barSpeed),
      estimated1RM: parseFloat(weight) * (1 + parseInt(reps) / 30),
      power: (parseFloat(weight) * 9.81 * parseFloat(barSpeed)) / 1000
    })
    alert('Lift logged!')
  }

  return (
    <div style={styles.tabContent}>
      <h2 style={styles.sectionTitle}>Barbell Velocity Tracking (VBT)</h2>
      
      {cameraActive ? (
        <div style={styles.cameraContainer}>
          <video ref={videoRef} autoPlay playsInline style={{display: 'none'}} />
          <canvas ref={canvasRef} style={styles.canvas} />
          <button onClick={stopCamera} style={styles.stopBtn}>
            <StopCircle size={18} /> Stop
          </button>
        </div>
      ) : (
        <div style={styles.cameraControls}>
          <button onClick={startCamera} style={styles.cameraBtn}>
            <Camera size={24} /> Start Live Camera
          </button>
        </div>
      )}

      <div style={styles.card}>
        <h3 style={styles.cardTitle}>Log Lift</h3>
        <div style={styles.formGrid}>
          <div>
            <label style={styles.label}>Weight (kg)</label>
            <input value={weight} onChange={(e) => setWeight(e.target.value)} type="number" style={styles.input} />
          </div>
          <div>
            <label style={styles.label}>Reps</label>
            <input value={reps} onChange={(e) => setReps(e.target.value)} type="number" style={styles.input} />
          </div>
          <div>
            <label style={styles.label}>Bar Speed (m/s)</label>
            <input value={barSpeed} onChange={(e) => setBarSpeed(e.target.value)} type="number" step="0.01" style={styles.input} />
          </div>
        </div>
        <button onClick={handleSubmit} style={styles.submitBtn}>Log Lift</button>
      </div>
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
  nav: { display: 'flex', gap: '8px', padding: '12px 24px', borderBottom: '1px solid #30363D', backgroundColor: '#161B22' },
  navBtn: { display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', backgroundColor: 'transparent', color: '#8B949E', border: '1px solid #30363D', borderRadius: '6px', fontSize: '14px', cursor: 'pointer', whiteSpace: 'nowrap' },
  navBtnActive: { backgroundColor: '#FF5C4D', color: '#FFF', borderColor: '#FF5C4D' },
  main: { padding: '24px' },
  tabContent: { maxWidth: '100%', margin: '0 auto' },
  sectionTitle: { fontSize: '24px', fontWeight: '700', marginBottom: '24px', color: '#F0F6FC' },
  card: { backgroundColor: '#161B22', border: '1px solid #30363D', borderRadius: '12px', padding: '20px', marginBottom: '20px' },
  cardTitle: { fontSize: '16px', fontWeight: '600', marginBottom: '16px', color: '#F0F6FC' },
  cardGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px', marginBottom: '24px' },
  cameraContainer: { position: 'relative', marginBottom: '24px', borderRadius: '12px', overflow: 'hidden', backgroundColor: '#000', border: '3px solid #FF5C4D', maxWidth: '100%' },
  canvas: { width: '100%', height: 'auto', display: 'block', maxHeight: '600px' },
  cameraControls: { display: 'flex', justifyContent: 'center', padding: '80px 20px', backgroundColor: '#161B22', borderRadius: '12px', marginBottom: '24px', border: '2px dashed #FF5C4D' },
  cameraBtn: { display: 'flex', alignItems: 'center', gap: '12px', backgroundColor: '#FF5C4D', color: '#FFF', padding: '16px 32px', borderRadius: '8px', fontSize: '18px', fontWeight: '600', cursor: 'pointer', border: 'none' },
  stopBtn: { position: 'absolute', bottom: '16px', right: '16px', backgroundColor: '#FF5C4D', color: '#FFF', padding: '12px 16px', borderRadius: '6px', fontSize: '14px', fontWeight: '600', cursor: 'pointer', border: 'none', display: 'flex', alignItems: 'center', gap: '8px' },
  formGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '16px', marginBottom: '16px' },
  label: { display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '6px', color: '#8B949E' },
  submitBtn: { width: '100%', backgroundColor: '#FF5C4D', color: '#FFF', padding: '12px 24px', borderRadius: '8px', fontSize: '16px', fontWeight: '600', cursor: 'pointer', border: 'none' },
}