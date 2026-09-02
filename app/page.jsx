'use client'
import { useState, useRef } from 'react'

export default function Page() {
  const [status, setStatus] = useState('Ready')
  const [cameraActive, setCameraActive] = useState(false)
  const [sessions, setSessions] = useState([])
  
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const rafRef = useRef(null)
  const repCountRef = useRef(0)
  const lastYRef = useRef(null)

  const startCamera = async () => {
    setStatus('Requesting camera...')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false
      })

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        setCameraActive(true)
        setStatus('Recording...')
        startDrawing()
      }
    } catch (err) {
      setStatus('Error: ' + err.message)
    }
  }

  const startDrawing = () => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return

    const ctx = canvas.getContext('2d')

    const draw = () => {
      if (!cameraActive) return

      if (canvas.width === 0) {
        canvas.width = video.videoWidth || 640
        canvas.height = video.videoHeight || 480
      }

      // Draw video to canvas
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

      // Draw demo skeleton
      ctx.strokeStyle = '#00FF00'
      ctx.lineWidth = 2
      ctx.fillStyle = '#00FF00'

      const w = canvas.width
      const h = canvas.height

      const pts = [
        {x: w*0.2, y: h*0.2}, {x: w*0.8, y: h*0.2},
        {x: w*0.15, y: h*0.45}, {x: w*0.85, y: h*0.45},
        {x: w*0.1, y: h*0.7}, {x: w*0.9, y: h*0.7}
      ]

      ctx.beginPath()
      ctx.moveTo(pts[0].x, pts[0].y)
      ctx.lineTo(pts[2].x, pts[2].y)
      ctx.stroke()

      ctx.beginPath()
      ctx.moveTo(pts[1].x, pts[1].y)
      ctx.lineTo(pts[3].x, pts[3].y)
      ctx.stroke()

      pts.forEach(p => {
        ctx.beginPath()
        ctx.arc(p.x, p.y, 6, 0, Math.PI*2)
        ctx.fill()
      })

      ctx.strokeStyle = '#FF5C4D'
      ctx.lineWidth = 4
      ctx.beginPath()
      ctx.moveTo(pts[4].x, pts[4].y)
      ctx.lineTo(pts[5].x, pts[5].y)
      ctx.stroke()

      ctx.fillStyle = '#FF5C4D'
      ctx.font = 'bold 26px Arial'
      ctx.fillText('0.95 m/s', 20, 50)
      ctx.font = '18px Arial'
      ctx.fillText('1250W', 20, 80)
      ctx.fillText('1RM: 130kg', 20, 110)
      ctx.fillText('Reps: 5', 20, 140)

      rafRef.current = requestAnimationFrame(draw)
    }

    draw()
  }

  const stopCamera = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    if (videoRef.current?.srcObject) {
      videoRef.current.srcObject.getTracks().forEach(t => t.stop())
    }
    setCameraActive(false)
    setStatus('Stopped')
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0D1117', color: '#F0F6FC' }}>
      <div style={{ padding: '16px 20px', borderBottom: '2px solid #FF5C4D', backgroundColor: '#161B22' }}>
        <h1 style={{ margin: 0, fontSize: '18px', fontWeight: '700' }}>RUNNOZ VBT ✅</h1>
        <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#8B949E' }}>{status}</p>
      </div>

      <div style={{ padding: '20px' }}>
        <h2>AI Velocity Based Training</h2>

        {cameraActive ? (
          <div style={{ position: 'relative', marginBottom: '20px', width: '100%' }}>
            <video
              ref={videoRef}
              autoPlay={true}
              playsInline={true}
              muted={true}
              style={{
                width: '100%',
                maxHeight: '600px',
                borderRadius: '8px',
                display: 'block',
                border: '2px solid #FF5C4D',
                backgroundColor: '#000'
              }}
            />
            <canvas
              ref={canvasRef}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                maxHeight: '600px',
                borderRadius: '8px'
              }}
            />
            <button
              onClick={stopCamera}
              style={{
                position: 'absolute',
                bottom: '16px',
                right: '16px',
                backgroundColor: '#FF5C4D',
                color: '#FFF',
                border: 'none',
                padding: '10px 14px',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: '600',
                zIndex: 10
              }}
            >
              STOP
            </button>
          </div>
        ) : (
          <button
            onClick={startCamera}
            style={{
              width: '100%',
              padding: '60px 20px',
              backgroundColor: '#FF5C4D',
              color: '#FFF',
              border: 'none',
              borderRadius: '8px',
              fontSize: '18px',
              fontWeight: '700',
              cursor: 'pointer',
              marginBottom: '20px'
            }}
          >
            START VBT TRACKING
          </button>
        )}

        <div style={{ backgroundColor: '#161B22', padding: '20px', borderRadius: '8px', border: '1px solid #30363D' }}>
          <h3>Sessions ({sessions.length})</h3>
          {sessions.map((s) => (
            <div key={s.id} style={{ padding: '10px', fontSize: '12px', borderBottom: '1px solid #30363D' }}>
              <strong>{s.timestamp}</strong><br/>{s.weight}kg × {s.reps}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}