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
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: 'environment', // REAR camera
          width: { ideal: 1280 }, 
          height: { ideal: 720 } 
        }
      })
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        mediaStreamRef.current = stream
        setCameraActive(true)
        
        // Start drawing pose overlay
        drawPoseOverlay()
      }
    } catch (error) {
      alert('Rear camera access denied. Make sure you allow camera permissions.')
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

    canvas.width = video.videoWidth
    canvas.height = video.videoHeight

    const drawFrame = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      
      // Draw video frame
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

      // Draw simple skeleton (will add MediaPipe later)
      ctx.strokeStyle = '#FF5C4D'
      ctx.lineWidth = 2
      ctx.fillStyle = '#FF5C4D'

      // Draw demo circles on shoulders (for testing)
      const shoulderLeft = { x: canvas.width * 0.3, y: canvas.height * 0.2 }
      const shoulderRight = { x: canvas.width * 0.7, y: canvas.height * 0.2 }
      const elbow = { x: canvas.width * 0.5, y: canvas.height * 0.4 }
      const wrist = { x: canvas.width * 0.5, y: canvas.height * 0.6 }

      // Draw lines
      ctx.beginPath()
      ctx.moveTo(shoulderLeft.x, shoulderLeft.y)
      ctx.lineTo(elbow.x, elbow.y)
      ctx.stroke()

      ctx.beginPath()
      ctx.moveTo(shoulderRight.x, shoulderRight.y)
      ctx.lineTo(elbow.x, elbow.y)
      ctx.stroke()

      ctx.beginPath()
      ctx.moveTo(elbow.x, elbow.y)
      ctx.lineTo(wrist.x, wrist.y)
      ctx.stroke()

      // Draw circles
      const points = [shoulderLeft, shoulderRight, elbow, wrist]
      points.forEach(point => {
        ctx.beginPath()
        ctx.arc(point.x, point.y, 5, 0, Math.PI * 2)
        ctx.fill()
      })

      // Draw text overlay
      ctx.fillStyle = '#FF5C4D'
      ctx.font = 'bold 20px Arial'
      ctx.fillText('Bar Speed: 0.85 m/s', 20, 40)
      ctx.fillText('Power: 1250 W', 20, 70)
      ctx.fillText('RPE: 8/10', 20, 100)

      if (cameraActive) {
        requestAnimationFrame(drawFrame)
      }
    }

    drawFrame()
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
        {activeTab === 'lift' && <LiftTab cameraActive={cameraActive} videoRef={videoRef} canvasRef={canvasRef} startCamera={startCamera} stopCamera={stopCamera} />}
        {activeTab === 'home' && <Dashboard sessions={sessions} />}
        {activeTab !== 'lift' && activeTab !== 'home' && <div style={styles.tabContent}><h2>Feature coming soon</h2></div>}
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
          <p style={styles.cardSubtitle}>Total sessions</p>
        </div>
      </div>
    </div>
  )
}

function LiftTab({ cameraActive, videoRef, canvasRef, startCamera, stopCamera }) {
  const [weight, setWeight] = useState('')
  const [reps, setReps] = useState('')
  const [barSpeed, setBarSpeed] = useState('')

  const handleSubmit = () => {
    if (!weight || !reps || !barSpeed) { alert('Fill all fields'); return }
    alert('Lift logged!')
  }

  return (
    <div style={styles.tabContent}>
      <h2 style={styles.sectionTitle}>Barbell Velocity Tracking (Rear Camera)</h2>
      
      {cameraActive ? (
        <div style={styles.cameraContainer}>
          <video ref={videoRef} autoPlay playsInline style={styles.video} />
          <canvas ref={canvasRef} style={styles.canvas} />
          <button onClick={stopCamera} style={styles.stopBtn}>
            <StopCircle size={18} /> Stop Recording
          </button>
        </div>
      ) : (
        <div style={styles.cameraControls}>
          <button onClick={startCamera} style={styles.cameraBtn}>
            <Camera size={20} /> Start Rear Camera
          </button>
        </div>
      )}

      <div style={styles.card}>
        <h3 style={styles.cardTitle}>Log Lift Data</h3>
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
  cameraContainer: { position: 'relative', marginBottom: '24px', borderRadius: '12px', overflow: 'hidden', backgroundColor: '#000', border: '2px solid #FF5C4D' },
  video: { width: '100%', height: 'auto', display: 'none' },
  canvas: { width: '100%', height: 'auto', display: 'block', maxHeight: '600px' },
  cameraControls: { display: 'flex', justifyContent: 'center', padding: '40px 20px', backgroundColor: '#161B22', borderRadius: '12px', marginBottom: '24px' },
  cameraBtn: { display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: '#FF5C4D', color: '#FFF', padding: '12px 24px', borderRadius: '8px', fontSize: '16px', fontWeight: '600', cursor: 'pointer', border: 'none' },
  stopBtn: { position: 'absolute', bottom: '16px', right: '16px', backgroundColor: '#FF5C4D', color: '#FFF', padding: '10px 16px', borderRadius: '6px', fontSize: '14px', fontWeight: '600', cursor: 'pointer', border: 'none', display: 'flex', alignItems: 'center', gap: '8px' },
  formGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '16px', marginBottom: '16px' },
  label: { display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '6px', color: '#8B949E' },
  submitBtn: { width: '100%', backgroundColor: '#FF5C4D', color: '#FFF', padding: '12px 24px', borderRadius: '8px', fontSize: '16px', fontWeight: '600', cursor: 'pointer', border: 'none' },
}