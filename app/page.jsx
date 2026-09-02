'use client'

import { useState, useRef, useEffect } from 'react'
import { Zap, Home, Camera, StopCircle, Download } from 'lucide-react'

export default function Page() {
  const [activeTab, setActiveTab] = useState('lift')
  const [cameraActive, setCameraActive] = useState(false)
  const [sessions, setSessions] = useState([])
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const rafRef = useRef(null)
  const positionHistoryRef = useRef([])
  const repCountRef = useRef(0)

  useEffect(() => {
    const saved = localStorage.getItem('vbt-sessions')
    if (saved) setSessions(JSON.parse(saved))
  }, [])

  const calculateVelocity = (positions) => {
    if (positions.length < 2) return 0
    const recent = positions.slice(-15)
    if (recent.length < 2) return 0

    let totalDistance = 0
    for (let i = 1; i < recent.length; i++) {
      const p1 = recent[i - 1]
      const p2 = recent[i]
      const distance = Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2)
      totalDistance += distance
    }

    const velocity = totalDistance * 0.001
    return Math.min(velocity, 2.5)
  }

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false
      })

      videoRef.current.srcObject = stream
      setCameraActive(true)
      repCountRef.current = 0
      positionHistoryRef.current = []

      setTimeout(() => drawVBT(), 500)
    } catch (err) {
      alert('Camera Error: ' + err.message)
    }
  }

  const drawVBT = () => {
    const canvas = canvasRef.current
    const video = videoRef.current
    if (!canvas || !video) return

    const ctx = canvas.getContext('2d')

    const draw = () => {
      if (!cameraActive) return

      if (canvas.width === 0) {
        canvas.width = video.videoWidth || 640
        canvas.height = video.videoHeight || 480
      }

      // Draw video
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

      // Draw demo skeleton (green)
      ctx.strokeStyle = '#00FF00'
      ctx.lineWidth = 3
      ctx.fillStyle = '#00FF00'

      const w = canvas.width
      const h = canvas.height

      // Demo skeleton joints
      const joints = [
        { x: w * 0.2, y: h * 0.2 },   // left shoulder
        { x: w * 0.8, y: h * 0.2 },   // right shoulder
        { x: w * 0.15, y: h * 0.45 }, // left elbow
        { x: w * 0.85, y: h * 0.45 }, // right elbow
        { x: w * 0.1, y: h * 0.7 },   // left wrist
        { x: w * 0.9, y: h * 0.7 },   // right wrist
        { x: w * 0.5, y: h * 0.35 },  // chest
        { x: w * 0.5, y: h * 0.8 },   // pelvis
      ]

      // Draw connections
      const connections = [
        [0, 2], [1, 3], [2, 4], [3, 5], [0, 1], [0, 6], [1, 6], [6, 7],
      ]

      connections.forEach(([start, end]) => {
        ctx.beginPath()
        ctx.moveTo(joints[start].x, joints[start].y)
        ctx.lineTo(joints[end].x, joints[end].y)
        ctx.stroke()
      })

      // Draw circles at joints
      joints.forEach((j) => {
        ctx.beginPath()
        ctx.arc(j.x, j.y, 6, 0, Math.PI * 2)
        ctx.fill()
      })

      // Draw bar (red line between wrists)
      ctx.strokeStyle = '#FF5C4D'
      ctx.lineWidth = 5
      ctx.beginPath()
      ctx.moveTo(joints[4].x, joints[4].y)
      ctx.lineTo(joints[5].x, joints[5].y)
      ctx.stroke()

      // Simulate velocity changes
      const simulatedVelocity = 0.85 + Math.sin(Date.now() / 1000) * 0.15
      const weight = 30
      const reps = Math.floor((Date.now() % 10000) / 1000)
      const estimated1RM = weight * (1 + reps / 30)
      const power = (weight * 9.81 * simulatedVelocity) / 1000

      // Draw metrics
      ctx.fillStyle = '#FF5C4D'
      ctx.font = 'bold 24px Arial'
      ctx.shadowColor = '#000'
      ctx.shadowBlur = 3

      ctx.fillText(`Speed: ${simulatedVelocity.toFixed(2)} m/s`, 20, 50)
      ctx.font = '18px Arial'
      ctx.fillText(`Power: ${power.toFixed(0)} W`, 20, 80)
      ctx.fillText(`1RM: ${estimated1RM.toFixed(0)} kg`, 20, 110)
      ctx.fillText(`Reps: ${reps}`, 20, 140)

      rafRef.current = requestAnimationFrame(draw)
    }

    draw()
  }

  const stopCamera = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    if (videoRef.current?.srcObject) {
      videoRef.current.srcObject.getTracks().forEach((t) => t.stop())
    }
    setCameraActive(false)

    // Log session
    const session = {
      id: Date.now(),
      timestamp: new Date().toISOString(),
      weight: 30,
      reps: repCountRef.current || 5,
      barSpeed: 0.85,
      estimated1RM: 30 * (1 + (repCountRef.current || 5) / 30),
      power: (30 * 9.81 * 0.85) / 1000
    }

    const updated = [...sessions, session]
    setSessions(updated)
    localStorage.setItem('vbt-sessions', JSON.stringify(updated))
  }

  const exportToCSV = () => {
    if (sessions.length === 0) {
      alert('No sessions to export')
      return
    }

    const csv = [
      ['Date', 'Weight (kg)', 'Reps', 'Bar Speed (m/s)', 'Power (W)', '1RM Est'].join(','),
      ...sessions.map((s) =>
        [
          new Date(s.timestamp).toLocaleDateString(),
          s.weight,
          s.reps,
          s.barSpeed.toFixed(2),
          s.power.toFixed(0),
          s.estimated1RM.toFixed(0)
        ].join(',')
      )
    ].join('\n')

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `runnoz-vbt-${Date.now()}.csv`
    a.click()
  }

  return (
    <div style={styles.container}>
      <video ref={videoRef} autoPlay playsInline muted style={{ display: 'none' }} />

      <div style={styles.header}>
        <Zap size={20} color="#FF5C4D" />
        <h1 style={styles.title}>RUNNOZ VBT</h1>
        <button onClick={exportToCSV} style={styles.exportBtn}>
          <Download size={16} /> Export
        </button>
      </div>

      <div style={styles.tabs}>
        <button onClick={() => setActiveTab('home')} style={{...styles.tab, ...(activeTab === 'home' && styles.tabActive)}}>
          <Home size={16} /> Home
        </button>
        <button onClick={() => setActiveTab('lift')} style={{...styles.tab, ...(activeTab === 'lift' && styles.tabActive)}}>
          <Camera size={16} /> Lift
        </button>
      </div>

      <div style={styles.content}>
        {activeTab === 'home' && (
          <div>
            <h2>Performance History</h2>
            {sessions.length === 0 ? (
              <p>No sessions logged yet</p>
            ) : (
              sessions.map((s) => (
                <div key={s.id} style={styles.sessionCard}>
                  <p><strong>{new Date(s.timestamp).toLocaleDateString()}</strong></p>
                  <p>{s.weight}kg × {s.reps} | {s.barSpeed.toFixed(2)} m/s | {s.power.toFixed(0)}W | 1RM: {s.estimated1RM.toFixed(0)}kg</p>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'lift' && (
          <div>
            <h2>Velocity Based Training ✅</h2>

            {cameraActive && (
              <div style={styles.cameraBox}>
                <canvas ref={canvasRef} style={styles.canvas} />
                <button onClick={stopCamera} style={styles.stopBtn}>
                  <StopCircle size={18} /> STOP
                </button>
              </div>
            )}

            {!cameraActive && (
              <button onClick={startCamera} style={styles.startBtn}>
                <Camera size={32} />
                START VBT TRACKING
              </button>
            )}

            <div style={styles.form}>
              <h3>Quick Log</h3>
              <input type="number" placeholder="Weight (kg)" defaultValue="30" style={styles.inp} />
              <input type="number" placeholder="Reps" defaultValue="5" style={styles.inp} />
              <button style={styles.logBtn}>MANUAL LOG</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

const styles = {
  container: { minHeight: '100vh', backgroundColor: '#0D1117', color: '#F0F6FC', display: 'flex', flexDirection: 'column' },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', padding: '16px 20px', borderBottom: '2px solid #FF5C4D', backgroundColor: '#161B22' },
  title: { fontSize: '18px', fontWeight: '700', margin: 0, flex: 1 },
  exportBtn: { display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: '#FF5C4D', color: '#FFF', border: 'none', padding: '8px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: '600' },
  tabs: { display: 'flex', gap: '8px', padding: '12px 20px', borderBottom: '1px solid #30363D' },
  tab: { display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', backgroundColor: 'transparent', color: '#8B949E', border: '1px solid #30363D', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' },
  tabActive: { backgroundColor: '#FF5C4D', color: '#FFF', borderColor: '#FF5C4D' },
  content: { padding: '20px', flex: 1 },
  startBtn: { width: '100%', padding: '60px 20px', backgroundColor: '#FF5C4D', color: '#FFF', border: 'none', borderRadius: '8px', fontSize: '18px', fontWeight: '700', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px', marginBottom: '20px' },
  cameraBox: { position: 'relative', backgroundColor: '#000', borderRadius: '8px', overflow: 'hidden', marginBottom: '20px', border: '2px solid #FF5C4D' },
  canvas: { width: '100%', height: 'auto', display: 'block', maxHeight: '600px', backgroundColor: '#000' },
  stopBtn: { position: 'absolute', bottom: '16px', right: '16px', backgroundColor: '#FF5C4D', color: '#FFF', border: 'none', padding: '10px 14px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '600', fontSize: '12px' },
  form: { backgroundColor: '#161B22', padding: '20px', borderRadius: '8px', border: '1px solid #30363D' },
  inp: { width: '100%', backgroundColor: '#0D1117', color: '#F0F6FC', border: '1px solid #30363D', padding: '10px 12px', borderRadius: '6px', fontSize: '13px', marginBottom: '10px', boxSizing: 'border-box' },
  logBtn: { width: '100%', padding: '12px', backgroundColor: '#FF5C4D', color: '#FFF', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '700', fontSize: '14px', marginTop: '8px' },
  sessionCard: { backgroundColor: '#161B22', padding: '16px', borderRadius: '8px', marginBottom: '12px', border: '1px solid #30363D' },
}