'use client'
import { useState, useRef, useEffect } from 'react'

export default function Page() {
  const [activeTab, setActiveTab] = useState('camera') // 'camera' | 'autoregulate'
  const [status, setStatus] = useState('Camera Ready')
  const [cameraActive, setCameraActive] = useState(false)
  const [isLocked, setIsLocked] = useState(false)
  
  // VBT Settings
  const [loadKg, setLoadKg] = useState(100)
  const [exercise, setExercise] = useState('Back Squat')
  const [audioFeedback, setAudioFeedback] = useState(true)

  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const rafRef = useRef(null)
  const isTrackingRef = useRef(false)

  // Tracking Math & State
  const trackPointRef = useRef(null)
  const prevFrameDataRef = useRef(null)
  const lastYRef = useRef(null)
  const lastTimeRef = useRef(null)
  const pathPointsRef = useRef([])
  const isConcentricRef = useRef(false)

  // Metrics Data
  const currentVelRef = useRef(0.00)
  const peakVelRef = useRef(0.00)
  const repCountRef = useRef(0)

  // Voice Feedback
  const speakVelocity = (vel) => {
    if (!audioFeedback || typeof window === 'undefined') return
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel()
      const msg = new SpeechSynthesisUtterance(`${vel.toFixed(2)}`)
      msg.rate = 1.2
      window.speechSynthesis.speak(msg)
    }
  }

  useEffect(() => {
    return () => {
      isTrackingRef.current = false
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [])

  // Start Video Stream
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          width: { ideal: 1280 }, 
          height: { ideal: 720 }, 
          facingMode: 'environment',
          frameRate: { ideal: 60 }
        },
        audio: false
      })

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.onloadedmetadata = () => {
          videoRef.current.play()

          if (canvasRef.current && videoRef.current) {
            canvasRef.current.width = videoRef.current.videoWidth || 1280
            canvasRef.current.height = videoRef.current.videoHeight || 720
          }

          setCameraActive(true)
          setStatus('Tap Barbell Sleeve or Auto-Locking...')
        }
      }
    } catch (err) {
      setStatus('Camera error: ' + err.message)
    }
  }

  // Automatic Barbell Plate Detection via High-Contrast Circle Search
  const autoDetectBarbell = (ctx, width, height) => {
    const frame = ctx.getImageData(0, 0, width, height)
    const data = frame.data

    let maxContrast = 0
    let bestX = width / 2
    let bestY = height / 2

    for (let y = Math.floor(height * 0.2); y < Math.floor(height * 0.8); y += 12) {
      for (let x = Math.floor(width * 0.2); x < Math.floor(width * 0.8); x += 12) {
        const idx = (y * width + x) * 4
        const rightIdx = (y * width + (x + 8)) * 4
        
        const lum1 = data[idx] * 0.299 + data[idx + 1] * 0.587 + data[idx + 2] * 0.114
        const lum2 = data[rightIdx] * 0.299 + data[rightIdx + 1] * 0.587 + data[rightIdx + 2] * 0.114
        const contrast = Math.abs(lum1 - lum2)

        if (contrast > maxContrast) {
          maxContrast = contrast
          bestX = x
          bestY = y
        }
      }
    }

    return { x: bestX, y: bestY }
  }

  const lockTarget = (x, y) => {
    trackPointRef.current = { x, y }
    pathPointsRef.current = [{ x, y }]
    lastYRef.current = y
    lastTimeRef.current = performance.now()
    
    isTrackingRef.current = true
    setIsLocked(true)
    setStatus('🟢 Barbell Tracked')

    if (!rafRef.current) {
      runMetricTrackingLoop()
    }
  }

  const handleCanvasClick = (e) => {
    if (!cameraActive || !canvasRef.current) return
    const rect = canvasRef.current.getBoundingClientRect()
    const scaleX = canvasRef.current.width / rect.width
    const scaleY = canvasRef.current.height / rect.height

    const clickX = (e.clientX - rect.left) * scaleX
    const clickY = (e.clientY - rect.top) * scaleY

    lockTarget(clickX, clickY)
  }

  const runMetricTrackingLoop = () => {
    const detect = () => {
      if (!isTrackingRef.current || !videoRef.current || !canvasRef.current) return

      const video = videoRef.current
      const canvas = canvasRef.current
      const ctx = canvas.getContext('2d', { willReadFrequently: true })
      const now = performance.now()

      if (video.readyState >= 2) {
        const width = canvas.width
        const height = canvas.height

        if (!trackPointRef.current) {
          ctx.drawImage(video, 0, 0, width, height)
          const detected = autoDetectBarbell(ctx, width, height)
          lockTarget(detected.x, detected.y)
        }

        const point = trackPointRef.current
        const searchSize = 48
        const half = searchSize / 2

        const sx = Math.max(0, Math.min(width - searchSize, point.x - half))
        const sy = Math.max(0, Math.min(height - searchSize, point.y - half))

        ctx.drawImage(video, 0, 0, width, height)
        const currentFrameData = ctx.getImageData(sx, sy, searchSize, searchSize)

        if (prevFrameDataRef.current) {
          const curr = currentFrameData.data
          const prev = prevFrameDataRef.current.data

          let sumDx = 0
          let sumDy = 0
          let weightSum = 0

          for (let y = 2; y < searchSize - 2; y += 2) {
            for (let x = 2; x < searchSize - 2; x += 2) {
              const idx = (y * searchSize + x) * 4
              
              const dt = (curr[idx] - prev[idx])
              const dx = (curr[idx + 4] - curr[idx - 4]) / 2
              const dy = (curr[(y + 1) * searchSize + x] - curr[(y - 1) * searchSize + x]) / 2

              const gradSq = dx * dx + dy * dy
              if (gradSq > 10) {
                sumDx += -dx * dt
                sumDy += -dy * dt
                weightSum += gradSq
              }
            }
          }

          if (weightSum > 0) {
            const moveX = sumDx / weightSum
            const moveY = sumDy / weightSum

            point.x = Math.max(10, Math.min(width - 10, point.x + moveX))
            point.y = Math.max(10, Math.min(height - 10, point.y + moveY))
          }
        }

        prevFrameDataRef.current = currentFrameData

        pathPointsRef.current.push({ x: point.x, y: point.y })
        if (pathPointsRef.current.length > 60) pathPointsRef.current.shift()

        if (lastYRef.current !== null && lastTimeRef.current !== null) {
          const deltaY = lastYRef.current - point.y
          const deltaTime = (now - lastTimeRef.current) / 1000

          const metersPerPixel = 0.0028

          if (deltaTime > 0 && deltaTime < 0.2) {
            const vel = (deltaY * metersPerPixel) / deltaTime

            if (Math.abs(vel) > 0.01) {
              currentVelRef.current = Math.abs(vel)
            }

            if (vel > 0.04) {
              if (!isConcentricRef.current) isConcentricRef.current = true
              if (vel > peakVelRef.current) peakVelRef.current = vel
            } else if (vel < -0.04 && isConcentricRef.current) {
              isConcentricRef.current = false
              repCountRef.current += 1
              speakVelocity(peakVelRef.current > 0 ? peakVelRef.current : currentVelRef.current)
              peakVelRef.current = 0
            }
          }
        }

        lastYRef.current = point.y
        lastTimeRef.current = now

        ctx.clearRect(0, 0, width, height)

        if (pathPointsRef.current.length > 1) {
          ctx.strokeStyle = '#00FF66'
          ctx.lineWidth = 4
          ctx.lineCap = 'round'
          ctx.lineJoin = 'round'
          ctx.beginPath()
          ctx.moveTo(pathPointsRef.current[0].x, pathPointsRef.current[0].y)
          for (let i = 1; i < pathPointsRef.current.length; i++) {
            ctx.lineTo(pathPointsRef.current[i].x, pathPointsRef.current[i].y)
          }
          ctx.stroke()
        }

        ctx.strokeStyle = '#00FF66'
        ctx.lineWidth = 3
        ctx.beginPath()
        ctx.arc(point.x, point.y, 12, 0, Math.PI * 2)
        ctx.stroke()

        ctx.fillStyle = '#00FF66'
        ctx.beginPath()
        ctx.arc(point.x, point.y, 4, 0, Math.PI * 2)
        ctx.fill()
      }

      if (isTrackingRef.current) {
        rafRef.current = requestAnimationFrame(detect)
      }
    }

    detect()
  }

  const stopCamera = () => {
    isTrackingRef.current = false
    if (rafRef.current) cancelAnimationFrame(rafRef.current)

    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject
      stream.getTracks().forEach((t) => t.stop())
      videoRef.current.srcObject = null
    }

    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d')
      ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height)
    }

    setCameraActive(false)
    setIsLocked(false)
    trackPointRef.current = null
    setStatus('Stopped')
  }

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#0F0F12',
      color: '#18181B',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
      display: 'flex',
      flexDirection: 'column',
      width: '100vw',
      overflowX: 'hidden'
    }}>
      {/* Top Header Controls Bar */}
      <div style={{
        padding: '14px 20px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderBottom: '1px solid #E4E4E7',
        zIndex: 30
      }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => setActiveTab('camera')}
            style={{
              padding: '8px 16px',
              borderRadius: '20px',
              border: 'none',
              backgroundColor: activeTab === 'camera' ? '#7C3AED' : '#F4F4F6',
              color: activeTab === 'camera' ? '#FFFFFF' : '#71717A',
              fontSize: '13px',
              fontWeight: '700',
              cursor: 'pointer'
            }}
          >
            🏋️ Metric Barbell Tracker
          </button>
          <button
            onClick={() => setActiveTab('autoregulate')}
            style={{
              padding: '8px 16px',
              borderRadius: '20px',
              border: 'none',
              backgroundColor: activeTab === 'autoregulate' ? '#7C3AED' : '#F4F4F6',
              color: activeTab === 'autoregulate' ? '#FFFFFF' : '#71717A',
              fontSize: '13px',
              fontWeight: '700',
              cursor: 'pointer'
            }}
          >
            ⚡ Autoregulate
          </button>
        </div>

        <button 
          onClick={() => setAudioFeedback(!audioFeedback)}
          style={{ fontSize: '18px', border: 'none', background: 'none', cursor: 'pointer', opacity: audioFeedback ? 1 : 0.4 }}
        >
          🔊
        </button>
      </div>

      {/* Main Full-Screen Viewport */}
      {activeTab === 'camera' && (
        <div style={{ position: 'relative', flex: 1, width: '100%', minHeight: 'calc(100vh - 130px)', backgroundColor: '#000' }}>
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', inset: 0 }}
          />
          <canvas
            ref={canvasRef}
            onClick={handleCanvasClick}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              zIndex: 10,
              cursor: 'crosshair'
            }}
          />

          {/* Metric UI Card Overlay */}
          <div style={{
            position: 'absolute',
            bottom: '24px',
            left: '24px',
            backgroundColor: 'rgba(18, 18, 20, 0.88)',
            backdropFilter: 'blur(12px)',
            borderRadius: '16px',
            padding: '16px 20px',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            zIndex: 20,
            minWidth: '180px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <span style={{ backgroundColor: '#EF4444', color: '#FFF', fontSize: '11px', fontWeight: '800', padding: '2px 6px', borderRadius: '4px' }}>
                METRIC
              </span>
              <span style={{ fontSize: '14px', color: '#E4E4E7', fontWeight: '600' }}>
                {loadKg}kg rep {repCountRef.current}
              </span>
            </div>

            <div style={{ fontSize: '40px', fontWeight: '800', color: '#00FF66', lineHeight: '1' }}>
              {currentVelRef.current.toFixed(2)}
            </div>
            <div style={{ fontSize: '12px', color: '#A1A1AA', marginTop: '4px', fontWeight: '500' }}>
              m. Vel (m/s)
            </div>
          </div>

          {/* Start Screen Overlay */}
          {!cameraActive && (
            <div style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              backgroundColor: 'rgba(0,0,0,0.85)',
              zIndex: 15,
              padding: '24px',
              textAlign: 'center'
            }}>
              <p style={{ color: '#E4E4E7', fontSize: '16px', marginBottom: '20px', fontWeight: '600', maxWidth: '480px' }}>
                Point your camera at the side end of the barbell. Real-time optical flow will auto-lock and track movement speed.
              </p>
              <button
                onClick={startCamera}
                style={{
                  padding: '16px 32px',
                  borderRadius: '12px',
                  border: 'none',
                  backgroundColor: '#7C3AED',
                  color: '#FFFFFF',
                  fontSize: '16px',
                  fontWeight: '700',
                  cursor: 'pointer'
                }}
              >
                Start Metric Barbell Tracker
              </button>
            </div>
          )}

          {cameraActive && (
            <button
              onClick={stopCamera}
              style={{
                position: 'absolute',
                top: '20px',
                right: '20px',
                padding: '10px 18px',
                borderRadius: '20px',
                border: 'none',
                backgroundColor: '#EF4444',
                color: '#FFF',
                fontSize: '13px',
                fontWeight: '700',
                cursor: 'pointer',
                zIndex: 20
              }}
            >
              Stop
            </button>
          )}
        </div>
      )}

      {/* Autoregulate View */}
      {activeTab === 'autoregulate' && (
        <div style={{ padding: '24px', flex: 1, backgroundColor: '#F4F4F6' }}>
          <div style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '16px',
            padding: '20px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            border: '1px solid #E4E4E7',
            maxWidth: '600px',
            margin: '0 auto'
          }}>
            <div>
              <div style={{ fontSize: '12px', color: '#71717A', fontWeight: '600' }}>Barbell Velocity</div>
              <div style={{ fontSize: '28px', fontWeight: '900', color: '#16A34A' }}>
                ↗ {currentVelRef.current.toFixed(2)} m/s
              </div>
              <div style={{ fontSize: '12px', color: '#A1A1AA' }}>Autoregulated target: 0.50 m/s</div>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Exercise Settings Panel */}
      <div style={{ padding: '16px 24px', backgroundColor: '#FFFFFF', borderTop: '1px solid #E4E4E7', zIndex: 30 }}>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center', maxWidth: '600px', margin: '0 auto' }}>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: '11px', color: '#71717A', fontWeight: '700', display: 'block', marginBottom: '4px' }}>EXERCISE</label>
            <select
              value={exercise}
              onChange={(e) => setExercise(e.target.value)}
              style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #E4E4E7', fontSize: '14px', fontWeight: '600' }}
            >
              <option value="Back Squat">Back Squat</option>
              <option value="Bench Press">Bench Press</option>
              <option value="Deadlift">Deadlift</option>
            </select>
          </div>
          <div style={{ width: '120px' }}>
            <label style={{ fontSize: '11px', color: '#71717A', fontWeight: '700', display: 'block', marginBottom: '4px' }}>LOAD (KG)</label>
            <input
              type="number"
              value={loadKg}
              onChange={(e) => setLoadKg(Number(e.target.value))}
              style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #E4E4E7', fontSize: '14px', fontWeight: '600' }}
            />
          </div>
        </div>
      </div>

    </div>
  )
}