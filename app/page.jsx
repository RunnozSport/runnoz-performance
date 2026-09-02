'use client'
import { useState, useRef } from 'react'

export default function Page() {
  const [cameraActive, setCameraActive] = useState(false)
  const [activeTab, setActiveTab] = useState('lift')
  const videoRef = useRef(null)
  const canvasRef = useRef(null)

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false
      })
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.play()
        setCameraActive(true)
        
        // Draw overlay after video plays
        setTimeout(() => {
          drawOverlay()
        }, 1000)
      }
    } catch (err) {
      alert('Camera Error: ' + err.message)
    }
  }

  const drawOverlay = () => {
    const canvas = canvasRef.current
    const video = videoRef.current
    if (!canvas || !video) return

    const ctx = canvas.getContext('2d')
    canvas.width = video.offsetWidth
    canvas.height = video.offsetHeight

    const draw = () => {
      if (!cameraActive) return

      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      const w = canvas.width
      const h = canvas.height

      // Draw skeleton joints
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

      // Circles
      pts.forEach(p => {
        ctx.beginPath()
        ctx.arc(p.x, p.y, 6, 0, Math.PI*2)
        ctx.fill()
      })

      // Red bar
      ctx.strokeStyle = '#FF5C4D'
      ctx.lineWidth = 5
      ctx.beginPath()
      ctx.moveTo(pts[4].x, pts[4].y)
      ctx.lineTo(pts[5].x, pts[5].y)
      ctx.stroke()

      // Metrics
      const vel = (0.85 + Math.sin(Date.now()/1000)*0.15).toFixed(2)
      ctx.fillStyle = '#FF5C4D'
      ctx.font = 'bold 24px Arial'
      ctx.fillText('Speed: '+vel+' m/s', 20, 50)
      ctx.font = '18px Arial'
      ctx.fillText('Power: 1250 W', 20, 80)
      ctx.fillText('1RM: 130 kg', 20, 110)

      requestAnimationFrame(draw)
    }
    draw()
  }

  const stopCamera = () => {
    if (videoRef.current?.srcObject) {
      videoRef.current.srcObject.getTracks().forEach(t => t.stop())
    }
    setCameraActive(false)
  }

  return (
    <div style={{minHeight: '100vh', backgroundColor: '#0D1117', color: '#F0F6FC'}}>
      <div style={{padding: '16px 20px', borderBottom: '2px solid #FF5C4D', backgroundColor: '#161B22'}}>
        <h1 style={{margin: 0, fontSize: '18px', fontWeight: '700'}}>RUNNOZ VBT ✅</h1>
      </div>

      <div style={{padding: '12px 20px', borderBottom: '1px solid #30363D', display: 'flex', gap: '8px'}}>
        <button onClick={() => setActiveTab('home')} style={{padding: '8px 16px', backgroundColor: activeTab === 'home' ? '#FF5C4D' : 'transparent', color: '#FFF', border: 'none', borderRadius: '6px', cursor: 'pointer'}}>Home</button>
        <button onClick={() => setActiveTab('lift')} style={{padding: '8px 16px', backgroundColor: activeTab === 'lift' ? '#FF5C4D' : 'transparent', color: '#FFF', border: 'none', borderRadius: '6px', cursor: 'pointer'}}>Lift</button>
      </div>

      <div style={{padding: '20px'}}>
        {activeTab === 'lift' && (
          <div>
            <h2>VBT Tracking</h2>
            
            {cameraActive ? (
              <div style={{position: 'relative', marginBottom: '20px'}}>
                <video 
                  ref={videoRef} 
                  autoPlay 
                  playsInline 
                  muted
                  style={{
                    width: '100%',
                    maxHeight: '600px',
                    borderRadius: '8px',
                    display: 'block',
                    border: '2px solid #FF5C4D'
                  }}
                />
                <canvas 
                  ref={canvasRef}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
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
                    fontWeight: '600'
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
        )}
      </div>
    </div>
  )
}