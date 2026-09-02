'use client'
import { useState, useRef, useEffect } from 'react'

export default function Page() {
  const [status, setStatus] = useState('ready')
  const [cameraActive, setCameraActive] = useState(false)
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const rafRef = useRef(null)

  const startCamera = async () => {
    setStatus('requesting')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false
      })
      setCameraActive(true)
      setStatus('recording')
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream
      }
      
      // Start drawing overlay
      setTimeout(() => drawVBT(), 500)
    } catch (err) {
      setStatus('error: ' + err.message)
    }
  }

  const drawVBT = () => {
    const canvas = canvasRef.current
    const video = videoRef.current
    if (!canvas || !video) return

    const ctx = canvas.getContext('2d')
    
    const draw = () => {
      if (!cameraActive) return

      // Set canvas size to match video
      if (canvas.width === 0) {
        canvas.width = video.videoWidth || 640
        canvas.height = video.videoHeight || 480
      }

      // Clear canvas
      ctx.fillStyle = 'rgba(0,0,0,0.1)'
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      const w = canvas.width
      const h = canvas.height

      // Green skeleton
      ctx.strokeStyle = '#00FF00'
      ctx.lineWidth = 3
      ctx.fillStyle = '#00FF00'

      const pts = [
        {x: w*0.2, y: h*0.2}, {x: w*0.8, y: h*0.2},
        {x: w*0.15, y: h*0.45}, {x: w*0.85, y: h*0.45},
        {x: w*0.1, y: h*0.7}, {x: w*0.9, y: h*0.7}
      ]

      // Lines
      ctx.beginPath()
      ctx.moveTo(pts[0].x, pts[0].y)
      ctx.lineTo(pts[2].x, pts[2].y)
      ctx.stroke()

      ctx.beginPath()
      ctx.moveTo(pts[1].x, pts[1].y)
      ctx.lineTo(pts[3].x, pts[3].y)
      ctx.stroke()

      // Circles at joints
      pts.forEach(p => {
        ctx.beginPath()
        ctx.arc(p.x, p.y, 6, 0, Math.PI*2)
        ctx.fill()
      })

      // Red bar (between hands)
      ctx.strokeStyle = '#FF5C4D'
      ctx.lineWidth = 5
      ctx.beginPath()
      ctx.moveTo(pts[4].x, pts[4].y)
      ctx.lineTo(pts[5].x, pts[5].y)
      ctx.stroke()

      // Metrics
      const vel = (0.85 + Math.sin(Date.now()/1000)*0.15).toFixed(2)
      const power = 1250
      const reps = Math.floor((Date.now() % 10000) / 1000)
      const est1rm = (30 * (1 + reps/30)).toFixed(0)

      ctx.fillStyle = '#FF5C4D'
      ctx.font = 'bold 26px Arial'
      ctx.shadowColor = 'rgba(0,0,0,0.8)'
      ctx.shadowBlur = 4
      ctx.fillText('Speed: ' + vel + ' m/s', 20, 50)
      
      ctx.font = '18px Arial'
      ctx.fillText('Power: ' + power + ' W', 20, 80)
      ctx.fillText('1RM: ' + est1rm + ' kg', 20, 110)
      ctx.fillText('Reps: ' + reps, 20, 140)

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
    setStatus('stopped')
  }

  return (
    <div style={{minHeight: '100vh', backgroundColor: '#0D1117', color: '#F0F6FC'}}>
      <div style={{padding: '16px 20px', borderBottom: '2px solid #FF5C4D', backgroundColor: '#161B22'}}>
        <h1 style={{margin: 0, fontSize: '18px', fontWeight: '700'}}>RUNNOZ VBT ✅</h1>
        <p style={{margin: '4px 0', fontSize: '12px', color: '#8B949E'}}>Status: {status}</p>
      </div>

      <div style={{padding: '20px'}}>
        <h2>Velocity Based Training</h2>

        {cameraActive ? (
          <div style={{position: 'relative', marginBottom: '20px', width: '100%'}}>
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
      </div>
    </div>
  )
}