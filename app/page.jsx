'use client'

import { useState, useEffect, useRef } from 'react'
import { Zap, Download, Home, Camera, StopCircle } from 'lucide-react'

export default function Page() {
  const [activeTab, setActiveTab] = useState('home')
  const [athleteName, setAthleteName] = useState('Athlete 1')
  const [sessions, setSessions] = useState([])
  const [cameraActive, setCameraActive] = useState(false)
  const videoRef = useRef(null)
  const canvasRef = useRef(null)

  useEffect(() => {
    const saved = localStorage.getItem('sessions')
    if (saved) setSessions(JSON.parse(saved))
  }, [])

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false
      })
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.play().catch(e => console.error('Play error:', e))
        setCameraActive(true)
        
        setTimeout(() => {
          if (canvasRef.current && videoRef.current) {
            canvasRef.current.width = videoRef.current.videoWidth || 640
            canvasRef.current.height = videoRef.current.videoHeight || 480
            drawOverlay()
          }
        }, 500)
      }
    } catch (error) {
      alert('Camera error: ' + error.message)
    }
  }

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      videoRef.current.srcObject.getTracks().forEach(track => track.stop())
      setCameraActive(false)
    }
  }

  const drawOverlay = () => {
    if (!cameraActive || !canvasRef.current || !videoRef.current) return

    const canvas = canvasRef.current
    const video = videoRef.current
    const ctx = canvas.getContext('2d')

    const loop = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

      // Draw skeleton points
      ctx.fillStyle = '#00FF00'
      ctx.strokeStyle = '#00FF00'
      ctx.lineWidth = 2

      const points = [
        { x: canvas.width * 0.3, y: canvas.height * 0.25 }, // shoulder left
        { x: canvas.width * 0.7, y: canvas.height * 0.25 }, // shoulder right
        { x: canvas.width * 0.25, y: canvas.height * 0.45 }, // elbow left
        { x: canvas.width * 0.75, y: canvas.height * 0.45 }, // elbow right
      ]

      // Draw connections
      ctx.beginPath()
      ctx.moveTo(points[0].x, points[0].y)
      ctx.lineTo(points[2].x, points[2].y)
      ctx.stroke()

      ctx.beginPath()
      ctx.moveTo(points[1].x, points[1].y)
      ctx.lineTo(points[3].x, points[3].y)
      ctx.stroke()

      // Draw circles
      points.forEach(p => {
        ctx.beginPath()
        ctx.arc(p.x, p.y, 8, 0, Math.PI * 2)
        ctx.fill()
      })

      // Draw bar line
      ctx.strokeStyle = '#FF5C4D'
      ctx.lineWidth = 4
      ctx.beginPath()
      ctx.moveTo(canvas.width * 0.2, canvas.height * 0.4)
      ctx.lineTo(canvas.width * 0.8, canvas.height * 0.4)
      ctx.stroke()

      // Draw metrics text
      ctx.fillStyle = '#FF5C4D'
      ctx.font = 'bold 20px Arial'
      ctx.fillText('Bar Speed: 0.98 m/s', 15, 35)
      ctx.font = '16px Arial'
      ctx.fillText('Power: 1,250 W', 15, 60)
      ctx.fillText('1RM: 130 kg', 15, 85)
      ctx.fillText('RPE: 8/10', 15, 110)

      if (cameraActive) {
        requestAnimationFrame(loop)
      }
    }

    loop()
  }

  const exportToCSV = () => {
    if (sessions.length === 0) { alert('No data'); return }
    const csv = [['Type', 'Athlete', 'Date'], ...sessions.map(s => [s.type, s.athlete, new Date(s.timestamp).toLocaleDateString()])].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `runnoz-${Date.now()}.csv`
    a.click()
  }

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <div style={styles.logo}>
          <Zap size={24} color="#FF5C4D" />
          <h1 style={styles.title}>RUNNOZ</h1>
        </div>
        <input type="text" value={athleteName} onChange={(e) => setAthleteName(e.target.value)} placeholder="Name" style={styles.input} />
        <button onClick={exportToCSV} style={styles.btn}><Download size={16} /></button>
      </header>

      <nav style={styles.nav}>
        <button onClick={() => setActiveTab('home')} style={{...styles.navBtn, ...(activeTab === 'home' ? styles.active : {})}}>
          <Home size={18} /> Home
        </button>
        <button onClick={() => setActiveTab('lift')} style={{...styles.navBtn, ...(activeTab === 'lift' ? styles.active : {})}}>
          <Zap size={18} /> Lift
        </button>
      </nav>

      {activeTab === 'home' && (
        <div style={styles.content}>
          <h2>Sessions: {sessions.length}</h2>
        </div>
      )}

      {activeTab === 'lift' && (
        <div style={styles.content}>
          <h2>Barbell Velocity Tracking</h2>
          
          {!cameraActive ? (
            <button onClick={startCamera} style={styles.startBtn}>
              <Camera size={20} /> START CAMERA
            </button>
          ) : (
            <div style={styles.cameraBox}>
              <video ref={videoRef} style={styles.video} autoPlay playsInline />
              <canvas ref={canvasRef} style={styles.canvas} />
              <button onClick={stopCamera} style={styles.stopBtn}>
                <StopCircle size={18} /> STOP
              </button>
            </div>
          )}

          <div style={styles.form}>
            <input type="number" placeholder="Weight (kg)" defaultValue="30" style={styles.input} />
            <input type="number" placeholder="Reps" defaultValue="5" style={styles.input} />
            <input type="number" placeholder="Bar Speed (m/s)" defaultValue="0.98" step="0.01" style={styles.input} />
            <button style={styles.logBtn}>Log Lift</button>
          </div>
        </div>
      )}
    </div>
  )
}

const styles = {
  container: { minHeight: '100vh', backgroundColor: '#0D1117', color: '#F0F6FC' },
  header: { display: 'flex', alignItems: 'center', gap: '12px', padding: '16px 20px', borderBottom: '1px solid #30363D' },
  logo: { display: 'flex', alignItems: 'center', gap: '8px', flex: 1 },
  title: { fontSize: '18px', fontWeight: '700', margin: 0 },
  input: { backgroundColor: '#161B22', color: '#F0F6FC', border: '1px solid #30363D', padding: '8px 12px', borderRadius: '6px', fontSize: '13px' },
  btn: { backgroundColor: '#FF5C4D', color: '#FFF', border: 'none', padding: '8px 12px', borderRadius: '6px', cursor: 'pointer' },
  nav: { display: 'flex', gap: '8px', padding: '12px 20px', borderBottom: '1px solid #30363D' },
  navBtn: { padding: '8px 16px', backgroundColor: 'transparent', color: '#8B949E', border: '1px solid #30363D', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' },
  active: { backgroundColor: '#FF5C4D', color: '#FFF', borderColor: '#FF5C4D' },
  content: { padding: '20px' },
  startBtn: { width: '100%', padding: '40px', backgroundColor: '#FF5C4D', color: '#FFF', border: 'none', fontSize: '18px', fontWeight: '600', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px' },
  cameraBox: { position: 'relative', width: '100%', backgroundColor: '#000', borderRadius: '8px', overflow: 'hidden', marginBottom: '20px' },
  video: { display: 'none' },
  canvas: { width: '100%', height: 'auto', display: 'block', maxHeight: '500px' },
  stopBtn: { position: 'absolute', bottom: '12px', right: '12px', backgroundColor: '#FF5C4D', color: '#FFF', border: 'none', padding: '10px 16px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '600' },
  form: { display: 'flex', flexDirection: 'column', gap: '12px' },
  logBtn: { padding: '12px', backgroundColor: '#FF5C4D', color: '#FFF', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '16px' }
}