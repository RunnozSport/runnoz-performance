'use client'

import { useState, useEffect, useRef } from 'react'
import { Zap, Home, Camera, StopCircle } from 'lucide-react'

export default function Page() {
  const [activeTab, setActiveTab] = useState('lift')
  const [cameraActive, setCameraActive] = useState(false)
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const rafRef = useRef(null)

  const startCamera = async () => {
    try {
      console.log('Starting camera...')
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      })

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.onloadedmetadata = () => {
          console.log('Video ready')
          videoRef.current.play()
          setCameraActive(true)
          drawFrame()
        }
      }
    } catch (err) {
      alert('Camera error: ' + err.message)
      console.error(err)
    }
  }

  const stopCamera = () => {
    setCameraActive(false)
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    if (videoRef.current && videoRef.current.srcObject) {
      videoRef.current.srcObject.getTracks().forEach(t => t.stop())
    }
  }

  const drawFrame = () => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas || !cameraActive) return

    const ctx = canvas.getContext('2d')
    
    // Set canvas size once
    if (canvas.width === 0) {
      canvas.width = video.videoWidth || 640
      canvas.height = video.videoHeight || 480
    }

    // Draw video to canvas
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

    // Draw skeleton (green)
    ctx.strokeStyle = '#00FF00'
    ctx.fillStyle = '#00FF00'
    ctx.lineWidth = 3

    const w = canvas.width
    const h = canvas.height

    // Skeleton joints
    const joints = [
      { x: w * 0.3, y: h * 0.2 },
      { x: w * 0.7, y: h * 0.2 },
      { x: w * 0.25, y: h * 0.45 },
      { x: w * 0.75, y: h * 0.45 },
      { x: w * 0.2, y: h * 0.7 },
      { x: w * 0.8, y: h * 0.7 },
    ]

    // Draw lines
    [[0, 2], [1, 3], [2, 4], [3, 5]].forEach(([a, b]) => {
      ctx.beginPath()
      ctx.moveTo(joints[a].x, joints[a].y)
      ctx.lineTo(joints[b].x, joints[b].y)
      ctx.stroke()
    })

    // Draw circles
    joints.forEach(j => {
      ctx.beginPath()
      ctx.arc(j.x, j.y, 6, 0, Math.PI * 2)
      ctx.fill()
    })

    // Bar (red)
    ctx.strokeStyle = '#FF5C4D'
    ctx.lineWidth = 5
    ctx.beginPath()
    ctx.moveTo(w * 0.15, h * 0.4)
    ctx.lineTo(w * 0.85, h * 0.4)
    ctx.stroke()

    // Text
    ctx.fillStyle = '#FF5C4D'
    ctx.font = 'bold 18px Arial'
    ctx.fillText('0.98 m/s', 20, 40)
    ctx.fillText('1250 W', 20, 70)

    rafRef.current = requestAnimationFrame(drawFrame)
  }

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <Zap size={20} color="#FF5C4D" />
        <h1 style={styles.title}>RUNNOZ Performance</h1>
      </div>

      {/* Tabs */}
      <div style={styles.tabs}>
        <button onClick={() => setActiveTab('home')} style={{...styles.tab, ...(activeTab === 'home' && styles.tabActive)}}>
          <Home size={16} /> Home
        </button>
        <button onClick={() => setActiveTab('lift')} style={{...styles.tab, ...(activeTab === 'lift' && styles.tabActive)}}>
          <Camera size={16} /> Lift
        </button>
      </div>

      {/* Content */}
      <div style={styles.content}>
        {activeTab === 'home' && <h2>Performance Tracker</h2>}

        {activeTab === 'lift' && (
          <>
            <h2>Barbell Velocity Tracking</h2>

            {cameraActive ? (
              // CAMERA ACTIVE - SHOW CANVAS
              <div style={styles.cameraBox}>
                <video ref={videoRef} style={{ display: 'none' }} autoPlay playsInline muted />
                <canvas ref={canvasRef} style={styles.canvas} />
                <button onClick={stopCamera} style={styles.stopBtn}>
                  <StopCircle size={16} /> STOP
                </button>
              </div>
            ) : (
              // CAMERA NOT ACTIVE - SHOW START BUTTON
              <button onClick={startCamera} style={styles.startBtn}>
                <Camera size={28} />
                START REAR CAMERA
              </button>
            )}

            {/* Form */}
            <div style={styles.formBox}>
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
  container: { minHeight: '100vh', backgroundColor: '#0D1117', color: '#F0F6FC' },
  header: { display: 'flex', alignItems: 'center', gap: '12px', padding: '16px 20px', borderBottom: '2px solid #FF5C4D', backgroundColor: '#161B22' },
  title: { fontSize: '18px', fontWeight: '700', margin: 0 },
  tabs: { display: 'flex', gap: '8px', padding: '12px 20px', borderBottom: '1px solid #30363D' },
  tab: { display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', backgroundColor: 'transparent', color: '#8B949E', border: '1px solid #30363D', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' },
  tabActive: { backgroundColor: '#FF5C4D', color: '#FFF', borderColor: '#FF5C4D' },
  content: { padding: '20px' },
  startBtn: { width: '100%', padding: '60px 20px', backgroundColor: '#FF5C4D', color: '#FFF', border: 'none', borderRadius: '8px', fontSize: '18px', fontWeight: '700', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px', marginBottom: '20px' },
  cameraBox: { position: 'relative', backgroundColor: '#000', borderRadius: '8px', overflow: 'hidden', marginBottom: '20px', border: '2px solid #FF5C4D' },
  canvas: { width: '100%', height: 'auto', display: 'block', maxHeight: '600px', backgroundColor: '#000' },
  stopBtn: { position: 'absolute', bottom: '16px', right: '16px', backgroundColor: '#FF5C4D', color: '#FFF', border: 'none', padding: '10px 14px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '600', fontSize: '12px' },
  formBox: { backgroundColor: '#161B22', padding: '20px', borderRadius: '8px', border: '1px solid #30363D' },
  inp: { width: '100%', backgroundColor: '#0D1117', color: '#F0F6FC', border: '1px solid #30363D', padding: '10px 12px', borderRadius: '6px', fontSize: '13px', marginBottom: '10px', boxSizing: 'border-box' },
  logBtn: { width: '100%', padding: '12px', backgroundColor: '#FF5C4D', color: '#FFF', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '700', fontSize: '14px', marginTop: '8px' },
}