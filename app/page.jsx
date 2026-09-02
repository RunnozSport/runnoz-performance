'use client'

import { useState, useEffect, useRef } from 'react'
import { Zap, Home, Camera, StopCircle } from 'lucide-react'

export default function Page() {
  const [activeTab, setActiveTab] = useState('home')
  const [athleteName, setAthleteName] = useState('Athlete 1')
  const [cameraActive, setCameraActive] = useState(false)
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const streamRef = useRef(null)

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 480 } }
      })
      
      streamRef.current = stream
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        setCameraActive(true)
        
        // Start drawing when video is ready
        videoRef.current.onplaying = () => {
          drawLoop()
        }
      }
    } catch (error) {
      alert('Camera Error: ' + error.message)
    }
  }

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
    }
    setCameraActive(false)
  }

  const drawLoop = () => {
    if (!cameraActive || !canvasRef.current || !videoRef.current) return

    const canvas = canvasRef.current
    const video = videoRef.current
    const ctx = canvas.getContext('2d')

    // Set canvas size to match video
    if (canvas.width === 0) {
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
    }

    // Draw video frame to canvas
    ctx.drawImage(video, 0, 0)

    // Draw GREEN skeleton
    ctx.strokeStyle = '#00FF00'
    ctx.fillStyle = '#00FF00'
    ctx.lineWidth = 2

    const w = canvas.width
    const h = canvas.height

    // Draw sample skeleton points
    const joints = [
      { x: w * 0.3, y: h * 0.25 },
      { x: w * 0.7, y: h * 0.25 },
      { x: w * 0.25, y: h * 0.5 },
      { x: w * 0.75, y: h * 0.5 },
    ]

    // Lines
    ctx.beginPath()
    ctx.moveTo(joints[0].x, joints[0].y)
    ctx.lineTo(joints[2].x, joints[2].y)
    ctx.stroke()

    ctx.beginPath()
    ctx.moveTo(joints[1].x, joints[1].y)
    ctx.lineTo(joints[3].x, joints[3].y)
    ctx.stroke()

    // Circles
    joints.forEach(j => {
      ctx.beginPath()
      ctx.arc(j.x, j.y, 8, 0, Math.PI * 2)
      ctx.fill()
    })

    // RED bar line
    ctx.strokeStyle = '#FF5C4D'
    ctx.lineWidth = 4
    ctx.beginPath()
    ctx.moveTo(w * 0.15, h * 0.45)
    ctx.lineTo(w * 0.85, h * 0.45)
    ctx.stroke()

    // Text overlay
    ctx.fillStyle = '#FF5C4D'
    ctx.font = 'bold 20px Arial'
    ctx.fillText('Bar Speed: 0.98 m/s', 15, 35)
    ctx.font = '16px Arial'
    ctx.fillText('Power: 1,250W', 15, 60)
    ctx.fillText('1RM: 130kg', 15, 85)

    requestAnimationFrame(drawLoop)
  }

  return (
    <div style={styles.container}>
      {/* HEADER */}
      <div style={styles.header}>
        <Zap size={24} color="#FF5C4D" />
        <h1 style={styles.title}>RUNNOZ Performance</h1>
      </div>

      {/* TABS */}
      <div style={styles.tabs}>
        <button 
          onClick={() => setActiveTab('home')}
          style={{...styles.tab, ...(activeTab === 'home' ? styles.tabActive : {})}}
        >
          <Home size={18} /> Home
        </button>
        <button 
          onClick={() => setActiveTab('lift')}
          style={{...styles.tab, ...(activeTab === 'lift' ? styles.tabActive : {})}}
        >
          <Camera size={18} /> Lift
        </button>
      </div>

      {/* CONTENT */}
      <div style={styles.page}>
        
        {activeTab === 'home' && (
          <div>
            <h2>Welcome {athleteName}</h2>
            <p>Go to Lift tab to start tracking</p>
          </div>
        )}

        {activeTab === 'lift' && (
          <div>
            <h2>Barbell Velocity Tracking</h2>

            {!cameraActive ? (
              <button onClick={startCamera} style={styles.startBtn}>
                <Camera size={32} />
                START REAR CAMERA
              </button>
            ) : (
              <div style={styles.cameraSection}>
                {/* HIDDEN VIDEO ELEMENT - feeds data to canvas */}
                <video 
                  ref={videoRef}
                  autoPlay 
                  playsInline 
                  muted
                  style={{display: 'none'}}
                />
                
                {/* CANVAS - displays the camera feed with overlay */}
                <canvas 
                  ref={canvasRef}
                  style={styles.canvas}
                />

                {/* STOP BUTTON */}
                <button onClick={stopCamera} style={styles.stopBtn}>
                  <StopCircle size={18} /> STOP
                </button>
              </div>
            )}

            {/* LOG FORM */}
            <div style={styles.form}>
              <h3>Log Lift</h3>
              <div style={styles.inputs}>
                <input type="number" placeholder="Weight (kg)" defaultValue="30" style={styles.input} />
                <input type="number" placeholder="Reps" defaultValue="5" style={styles.input} />
                <input type="number" placeholder="Speed (m/s)" defaultValue="0.98" step="0.01" style={styles.input} />
              </div>
              <button style={styles.logBtn}>LOG LIFT</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

const styles = {
  container: {
    minHeight: '100vh',
    backgroundColor: '#0D1117',
    color: '#F0F6FC',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '16px 20px',
    backgroundColor: '#161B22',
    borderBottom: '2px solid #FF5C4D',
  },
  title: {
    fontSize: '20px',
    fontWeight: '700',
    margin: 0,
  },
  tabs: {
    display: 'flex',
    gap: '8px',
    padding: '12px 20px',
    backgroundColor: '#0D1117',
    borderBottom: '1px solid #30363D',
  },
  tab: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 20px',
    backgroundColor: 'transparent',
    color: '#8B949E',
    border: '2px solid #30363D',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500',
  },
  tabActive: {
    backgroundColor: '#FF5C4D',
    color: '#FFF',
    borderColor: '#FF5C4D',
  },
  page: {
    padding: '20px',
    maxWidth: '100%',
  },
  startBtn: {
    width: '100%',
    padding: '60px 20px',
    backgroundColor: '#FF5C4D',
    color: '#FFF',
    border: 'none',
    borderRadius: '8px',
    fontSize: '20px',
    fontWeight: '700',
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '16px',
    marginBottom: '20px',
  },
  cameraSection: {
    position: 'relative',
    backgroundColor: '#000',
    borderRadius: '8px',
    overflow: 'hidden',
    marginBottom: '20px',
    border: '3px solid #FF5C4D',
  },
  canvas: {
    width: '100%',
    height: 'auto',
    display: 'block',
    maxHeight: '600px',
    backgroundColor: '#000',
  },
  stopBtn: {
    position: 'absolute',
    bottom: '16px',
    right: '16px',
    backgroundColor: '#FF5C4D',
    color: '#FFF',
    border: 'none',
    padding: '12px 16px',
    borderRadius: '6px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontWeight: '700',
    fontSize: '14px',
  },
  form: {
    backgroundColor: '#161B22',
    padding: '20px',
    borderRadius: '8px',
    border: '1px solid #30363D',
  },
  inputs: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    marginBottom: '16px',
  },
  input: {
    backgroundColor: '#0D1117',
    color: '#F0F6FC',
    border: '1px solid #30363D',
    padding: '10px 12px',
    borderRadius: '6px',
    fontSize: '14px',
  },
  logBtn: {
    width: '100%',
    padding: '14px',
    backgroundColor: '#FF5C4D',
    color: '#FFF',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontWeight: '700',
    fontSize: '16px',
  },
}