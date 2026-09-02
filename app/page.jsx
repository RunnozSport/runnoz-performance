'use client'
import { useState, useRef } from 'react'

export default function Page() {
  const [cameraActive, setCameraActive] = useState(false)
  const [activeTab, setActiveTab] = useState('lift')
  const [status, setStatus] = useState('ready')
  const videoRef = useRef(null)
  const canvasRef = useRef(null)

  const startCamera = async () => {
    console.log('Start button clicked')
    setStatus('requesting')
    
    // Timeout after 10 seconds
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Camera request timeout')), 10000)
    )

    try {
      console.log('Requesting camera...')
      
      const cameraPromise = navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: 'environment'
        },
        audio: false
      })
      
      const stream = await Promise.race([cameraPromise, timeoutPromise])
      
      console.log('Stream received:', stream)
      setStatus('stream ready')
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        console.log('Stream set to video')
        
        // Wait for video to be playable
        videoRef.current.onloadedmetadata = () => {
          console.log('Video metadata loaded')
          videoRef.current.play().then(() => {
            console.log('Video playing')
            setCameraActive(true)
            setStatus('recording')
            drawOverlay()
          }).catch(e => {
            console.error('Play error:', e)
            setStatus('error: play failed')
          })
        }
      }
    } catch (err) {
      console.error('Camera error:', err)
      setStatus('error: ' + err.message)
      alert('Camera Error: ' + err.message)
    }
  }

  const drawOverlay = () => {
    const canvas = canvasRef.current
    const video = videoRef.current
    if (!canvas || !video) {
      console.log('Canvas or video missing')
      return
    }

    canvas.width = 640
    canvas.height = 480
    const ctx = canvas.getContext('2d')

    const draw = () => {
      if (!cameraActive) return

      ctx.clearRect(0, 0, canvas.width, canvas.height)

      const w = canvas.width
      const h = canvas.height

      ctx.strokeStyle = '#00FF00'
      ctx.lineWidth = 3
      ctx.fillStyle = '#00FF00'

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
      ctx.lineWidth = 5
      ctx.beginPath()
      ctx.moveTo(pts[4].x, pts[4].y)
      ctx.lineTo(pts[5].x, pts[5].y)
      ctx.stroke()

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
    console.log('Stopping camera')
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
        <p style={{margin: '4px 0 0 0', fontSize: '12px', color: '#8B949E'}}>Status: {status}</p>
      </div>

      <div style={{padding: '12px 20px', borderBottom: '1px solid #30363D', display: 'flex', gap: '8px'}}>
        <button onClick={() => setActiveTab('home')} style={{padding: '8px 16px', backgroundColor: activeTab === 'home' ? '#FF5C4D' : 'transparent', color: '#FFF', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '14px'}}>Home</button>
        <button onClick={() => setActiveTab('lift')} style={{padding: '8px 16px', backgroundColor: activeTab === 'lift' ? '#FF5C4D' : 'transparent', color: '#FFF', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '14px'}}>Lift</button>
      </div>

      <div style={{padding: '20px'}}>
        {activeTab === 'lift' && (
          <div>
            <h2>VBT Tracking</h2>
            
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
                    backgroundColor: '#000',
                    objectFit: 'cover'
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
        )}
      </div>
    </div>
  )
}