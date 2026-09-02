'use client'

import { useState, useRef } from 'react'
import { Zap, Home, Camera, StopCircle } from 'lucide-react'

export default function Page() {
  const [activeTab, setActiveTab] = useState('lift')
  const [cameraActive, setCameraActive] = useState(false)
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const animationRef = useRef(null)

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false
      })

      videoRef.current.srcObject = stream
      setCameraActive(true)
      setTimeout(() => drawOverlay(), 500)
    } catch (err) {
      alert('Camera Error: ' + err.message)
    }
  }

  const drawOverlay = () => {
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

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

      ctx.strokeStyle = '#00FF00'
      ctx.lineWidth = 2
      ctx.fillStyle = '#00FF00'

      const w = canvas.width
      const h = canvas.height

      const points = [
        { x: w * 0.2, y: h * 0.3 },
        { x: w * 0.8, y: h * 0.3 },
        { x: w * 0.15, y: h * 0.5 },
        { x: w * 0.85, y: h * 0.5 },
        { x: w * 0.1, y: h * 0.7 },
        { x: w * 0.9, y: h * 0.7 },
        { x: w * 0.5, y: h * 0.4 },
        { x: w * 0.5, y: h * 0.8 },
      ]

      const connections = [
        [0, 2], [1, 3], [2, 4], [3, 5], [0, 1], [0, 6], [1, 6], [6, 7],
      ]

      connections.forEach(([start, end]) => {
        ctx.beginPath()
        ctx.moveTo(points[start].x, points[start].y)
        ctx.lineTo(points[end].x, points[end].y)
        ctx.stroke()
      })

      points.forEach(p => {
        ctx.beginPath()
        ctx.arc(p.x, p.y, 6, 0, Math.PI * 2)
        ctx.fill()
      })

      ctx.strokeStyle = '#FF5C4D'
      ctx.lineWidth = 5
      ctx.beginPath()
      ctx.moveTo(points[4].x, points[4].y)
      ctx.lineTo(points[5].x, points[5].y)
      ctx.stroke()

      ctx.fillStyle = '#FF5C4D'
      ctx.font = 'bold 22px Arial'
      ctx.fillText('0.98 m/s', 20, 50)
      ctx.font = '16px Arial'
      ctx.fillText('1,250 W', 20, 80)
      ctx.fillText('130 kg', 20, 110)
      ctx.fillText('RPE: 8/10', 20, 140)

      animationRef.current = requestAnimationFrame(draw)
    }

    draw()
  }

  const stopCamera = () => {
    if (animationRef.current) cancelAnimationFrame(animationRef.current)
    if (videoRef.current?.srcObject) {
      videoRef.current.srcObject.getTracks().forEach(t => t.stop())
    }
    setCameraActive(false)
  }

  return (
    <div style={styles.container}>
      <video ref={videoRef} autoPlay playsInline muted style={{ display: 'none' }} />

      <div style={styles.header}>
        <Zap size={20} color="#FF5C4D" />
        <h1 style={styles.title}>RUNNOZ Performance</h1>
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
        <h2>Barbell Velocity Tracking</h2>

        {cameraActive && (
          <div style={styles.cameraBox}>
            <canvas ref={canvasRef} style={styles.canvas} />
            <button onClick={stopCamera} style={styles.stopBtn}>
              <StopCircle size={18} /> STOP
            </button>
          </div>
        )}

        {!cameraActive && (
          <>
            <button onClick={startCamera} style={styles.startBtn}>
              <Camera size={32} />
              START REAR CAMERA
            </button>

            <div style={styles.form}>
              <h3>Log Lift</h3>
              <input type="number" placeholder="Weight (kg)" defaultValue="30" style={styles.inp} />
              <input type="number" placeholder="Reps" defaultValue="5" style={styles.inp} />
              <input type="number" placeholder="Speed (m/s)" defaultValue="0.98" step="0.01" style={styles.inp} />
              <button style={styles.logBtn}>LOG LIFT</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

const styles = {
  container: { minHeight: '100vh', backgroundColor: '#0D1117', color: '#F0F6FC', display: 'flex', flexDirection: 'column' },
  header: { display: 'flex', alignItems: 'center', gap: '12px', padding: '16px 20px', borderBottom: '2px solid #FF5C4D', backgroundColor: '#161B22' },
  title: { fontSize: '18px', fontWeight: '700', margin: 0 },
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
}