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
  const animationRef = useRef(null)

  useEffect(() => {
    const saved = localStorage.getItem('sessions')
    if (saved) setSessions(JSON.parse(saved))
  }, [])

  const startCamera = async () => {
    try {
      console.log('Requesting camera...')
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false
      })
      
      console.log('Camera stream obtained')
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        setCameraActive(true)
        
        // Wait for video metadata to load
        videoRef.current.onloadedmetadata = () => {
          console.log('Video metadata loaded, starting draw')
          videoRef.current.play()
          startDrawing()
        }
      }
    } catch (error) {
      console.error('Camera error:', error)
      alert('Camera Error: ' + error.message)
    }
  }

  const stopCamera = () => {
    console.log('Stopping camera')
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current)
    }
    if (videoRef.current && videoRef.current.srcObject) {
      videoRef.current.srcObject.getTracks().forEach(track => track.stop())
    }
    setCameraActive(false)
  }

  const startDrawing = () => {
    const canvas = canvasRef.current
    const video = videoRef.current

    if (!canvas || !video) return

    // Set canvas size to match video
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    console.log(`Canvas set to ${canvas.width}x${canvas.height}`)

    const ctx = canvas.getContext('2d')

    const draw = () => {
      if (!cameraActive) return

      // Draw video frame
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

      // Draw skeleton points (green)
      ctx.fillStyle = '#00FF00'
      ctx.strokeStyle = '#00FF00'
      ctx.lineWidth = 3

      const w = canvas.width
      const h = canvas.height

      const points = [
        { x: w * 0.3, y: h * 0.25, name: 'shoulder_left' },
        { x: w * 0.7, y: h * 0.25, name: 'shoulder_right' },
        { x: w * 0.25, y: h * 0.45, name: 'elbow_left' },
        { x: w * 0.75, y: h * 0.45, name: 'elbow_right' },
        { x: w * 0.2, y: h * 0.65, name: 'wrist_left' },
        { x: w * 0.8, y: h * 0.65, name: 'wrist_right' },
      ]

      // Draw connections
      const connections = [[0, 2], [1, 3], [2, 4], [3, 5]]
      connections.forEach(([start, end]) => {
        ctx.beginPath()
        ctx.moveTo(points[start].x, points[start].y)
        ctx.lineTo(points[end].x, points[end].y)
        ctx.stroke()
      })

      // Draw circles at joints
      points.forEach(p => {
        ctx.beginPath()
        ctx.arc(p.x, p.y, 8, 0, Math.PI * 2)
        ctx.fill()
      })

      // Draw bar line (red)
      ctx.strokeStyle = '#FF5C4D'
      ctx.lineWidth = 5
      ctx.beginPath()
      ctx.moveTo(w * 0.15, h * 0.4)
      ctx.lineTo(w * 0.85, h * 0.4)
      ctx.stroke()

      // Draw metrics text
      ctx.fillStyle = '#FF5C4D'
      ctx.font = 'bold 24px Arial'
      ctx.fillText('Bar Speed: 0.98 m/s', 20, 50)
      
      ctx.font = '18px Arial'
      ctx.fillText('Power: 1,250 W', 20, 80)
      ctx.fillText('1RM: 130 kg', 20, 110)
      ctx.fillText('RPE: 8/10', 20, 140)

      animationRef.current = requestAnimationFrame(draw)
    }

    draw()
  }

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <div style={styles.logo}>
          <Zap size={24} color="#FF5C4D" />
          <h1 style={styles.title}>RUNNOZ Performance</h1>
        </div>
        <input 
          type="text" 
          value={athleteName} 
          onChange={(e) => setAthleteName(e.target.value)} 
          placeholder="Athlete" 
          style={styles.input} 
        />
      </header>

      <nav style={styles.nav}>
        <button 
          onClick={() => setActiveTab('home')} 
          style={{...styles.navBtn, ...(activeTab === 'home' ? styles.active : {})}}
        >
          <Home size={18} /> Home
        </button>
        <button 
          onClick={() => setActiveTab('lift')} 
          style={{...styles.navBtn, ...(activeTab === 'lift' ? styles.active : {})}}
        >
          <Zap size={18} /> Lift
        </button>
      </nav>

      <div style={styles.content}>
        {activeTab === 'home' && (
          <div>
            <h2>Sessions Logged: {sessions.length}</h2>
          </div>
        )}

        {activeTab === 'lift' && (
          <div>
            <h2>Barbell Velocity Tracking</h2>

            {!cameraActive ? (
              <button onClick={startCamera} style={styles.startBtn}>
                <Camera size={24} style={{marginRight: '12px'}} />
                START REAR CAMERA
              </button>
            ) : (
              <div style={styles.cameraWrapper}>
                <video 
                  ref={videoRef} 
                  style={styles.video}
                  autoPlay 
                  playsInline
                  muted
                />
                <canvas 
                  ref={canvasRef} 
                  style={styles.canvas}
                />
                <button onClick={stopCamera} style={styles.stopBtn}>
                  <StopCircle size={18} /> STOP
                </button>
              </div>
            )}

            <div style={styles.form}>
              <h3>Log Lift Data</h3>
              <input type="number" placeholder="Weight (kg)" defaultValue="30" style={styles.input} />
              <input type="number" placeholder="Reps" defaultValue="5" style={styles.input} />
              <input type="number" placeholder="Bar Speed (m/s)" defaultValue="0.98" step="0.01" style={styles.input} />
              <button style={styles.logBtn}>Log Lift</button>
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
    fontFamily: 'system-ui, -apple-system, sans-serif'
  },
  header: { 
    display: 'flex', 
    alignItems: 'center', 
    gap: '12px', 
    padding: '16px 20px', 
    borderBottom: '1px solid #30363D',
    backgroundColor: '#161B22'
  },
  logo: { 
    display: 'flex', 
    alignItems: 'center', 
    gap: '8px', 
    flex: 1 
  },
  title: { 
    fontSize: '18px', 
    fontWeight: '700', 
    margin: 0 
  },
  input: { 
    backgroundColor: '#161B22', 
    color: '#F0F6FC', 
    border: '1px solid #30363D', 
    padding: '8px 12px', 
    borderRadius: '6px', 
    fontSize: '14px',
    minWidth: '120px'
  },
  nav: { 
    display: 'flex', 
    gap: '8px', 
    padding: '12px 20px', 
    borderBottom: '1px solid #30363D',
    backgroundColor: '#0D1117'
  },
  navBtn: { 
    padding: '8px 16px', 
    backgroundColor: 'transparent', 
    color: '#8B949E', 
    border: '1px solid #30363D', 
    borderRadius: '6px', 
    cursor: 'pointer', 
    fontSize: '14px', 
    display: 'flex', 
    alignItems: 'center', 
    gap: '6px',
    fontWeight: '500'
  },
  active: { 
    backgroundColor: '#FF5C4D', 
    color: '#FFF', 
    borderColor: '#FF5C4D' 
  },
  content: { 
    padding: '20px',
    maxWidth: '800px',
    margin: '0 auto'
  },
  startBtn: { 
    width: '100%', 
    padding: '50px 20px', 
    backgroundColor: '#FF5C4D', 
    color: '#FFF', 
    border: 'none', 
    fontSize: '20px', 
    fontWeight: '700', 
    borderRadius: '8px', 
    cursor: 'pointer', 
    display: 'flex', 
    alignItems: 'center', 
    justifyContent: 'center', 
    gap: '12px',
    marginBottom: '20px'
  },
  cameraWrapper: { 
    position: 'relative', 
    width: '100%', 
    backgroundColor: '#000', 
    borderRadius: '8px', 
    overflow: 'hidden', 
    marginBottom: '20px',
    border: '2px solid #FF5C4D'
  },
  video: { 
    display: 'none' 
  },
  canvas: { 
    width: '100%', 
    height: 'auto', 
    display: 'block',
    maxHeight: '600px'
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
    fontWeight: '600',
    fontSize: '14px'
  },
  form: { 
    display: 'flex', 
    flexDirection: 'column', 
    gap: '12px',
    backgroundColor: '#161B22',
    padding: '20px',
    borderRadius: '8px',
    border: '1px solid #30363D'
  },
  logBtn: { 
    padding: '12px 20px', 
    backgroundColor: '#FF5C4D', 
    color: '#FFF', 
    border: 'none', 
    borderRadius: '6px', 
    cursor: 'pointer', 
    fontWeight: '700', 
    fontSize: '16px',
    marginTop: '8px'
  }
}