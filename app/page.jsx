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
  const trackPointRef = useRef(null) // Current {x, y}
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
          width: { ideal: 720 }, 
          height: { ideal: 1280 }, 
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
            canvasRef.current.width = videoRef.current.videoWidth || 720
            canvasRef.current.height = videoRef.current.videoHeight || 1280
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

    // Scan center region for barbell plate edge/collar gradients
    for (let y = Math.floor(height * 0.2); y < Math.floor(height * 0.8); y += 12) {
      for (let x = Math.floor(width * 0.2); x < Math.floor(width * 0.8); x += 12) {
        const idx = (y * width + x) * 4
        const rightIdx = (y * width + (x + 8)) * 4
        
        // Calculate luminosity contrast
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

  // Lock Tracking Target
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

  // Core Metric Optical Tracking Engine
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

        // Auto-Detect on first frame if not locked manually
        if (!trackPointRef.current) {
          ctx.drawImage(video, 0, 0, width, height)
          const detected = autoDetectBarbell(ctx, width, height)
          lockTarget(detected.x, detected.y)
        }

        const point = trackPointRef.current
        const searchSize = 48
        const half = searchSize / 2

        // Extract Search Window around current barbell location
        const sx = Math.max(0, Math.min(width - searchSize, point.x - half))
        const sy = Math.max(0, Math.min(height - searchSize, point.y - half))

        ctx.drawImage(video, 0, 0, width, height)
        const currentFrameData = ctx.getImageData(sx, sy, searchSize, searchSize)

        // Lucas-Kanade / Differential Optical Flow Approximation
        if (prevFrameDataRef.current) {
          const curr = currentFrameData.data
          const prev = prevFrameDataRef.current.data

          let sumDx = 0
          let sumDy = 0
          let weightSum = 0

          for (let y = 2; y < searchSize - 2; y += 2) {
            for (let x = 2; x < searchSize - 2; x += 2) {
              const idx = (y * searchSize + x) * 4
              
              // Frame Differences
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

            // Update sub-pixel barbell coordinate
            point.x = Math.max(10, Math.min(width - 10, point.x + moveX))
            point.y = Math.max(10, Math.min(height - 10, point.y + moveY))
          }
        }

        prevFrameDataRef.current = currentFrameData

        // Record Trajectory Curve
        pathPointsRef.current.push({ x: point.x, y: point.y })
        if (pathPointsRef.current.length > 60) pathPointsRef.current.shift()

        // Velocity Calculation (Standard 450mm Olympic Plate Calibration Scale)
        if (lastYRef.current !== null && lastTimeRef.current !== null) {
          const deltaY = lastYRef.current - point.y // Upward = positive
          const deltaTime = (now - lastTimeRef.current) / 1000

          const metersPerPixel = 0.0028 // ~350px = 1 meter

          if (deltaTime > 0 && deltaTime < 0.2) {
            const vel = (deltaY * metersPerPixel) / deltaTime

            if (Math.abs(vel) > 0.01) {
              currentVelRef.current = Math.abs(vel)
            }

            // Concentric Lift Phase Detection
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

        // Clear Canvas for Drawing Metric Overlays
        ctx.clearRect(0, 0, width, height)

        // Draw Metric-style Smooth Green Bar Path
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

        // Draw Barbell Lock Point Ring
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
      alignItems: 'center',
      justifyContent: 'center',
      padding: '16px'
    }}>
      <div style={{
        width: '100%',
        maxWidth: '390px',
        backgroundColor: '#F4F4F6',
        borderRadius: '36px',
        overflow: 'hidden',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
        border: '1px solid #E4E4E7',
        position: 'relative'
      }}>

        {/* Navigation Bar */}
        <div style={{
          padding: '14px 16px 10px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: '#FFFFFF',
          borderBottom: '1px solid #E4E4E7'
        }}>
          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              onClick={() => setActiveTab('camera')}
              style={{
                padding: '6px 12px',
                borderRadius: '20px',
                border: 'none',
                backgroundColor: activeTab === 'camera' ? '#7C3AED' : '#F4F4F6',
                color: activeTab === 'camera' ? '#FFFFFF' : '#71717A',
                fontSize: '11px',
                fontWeight: '700',
                cursor: 'pointer'
              }}
            >
              🏋️ Metric Barbell Tracker
            </button>
            <button
              onClick={() => setActiveTab('autoregulate')}
              style={{
                padding: '6px 12px',
                borderRadius: '20px',
                border: 'none',
                backgroundColor: activeTab === 'autoregulate' ? '#7C3AED' : '#F4F4F6',
                color: activeTab === 'autoregulate' ? '#FFFFFF' : '#71717A',
                fontSize: '11px',
                fontWeight: '700',
                cursor: 'pointer'
              }}
            >
              ⚡ Autoregulate
            </button>
          </div>

          <button 
            onClick={() => setAudioFeedback(!audioFeedback)}
            style={{ fontSize: '14px', border: 'none', background: 'none', cursor: 'pointer', opacity: audioFeedback ? 1 : 0.4 }}
          >
            🔊
          </button>
        </div>

        {/* Live Camera Barbell Tracking Frame */}
        {activeTab === 'camera' && (
          <div style={{ position: 'relative', width: '100%', aspectRatio: '9/16', backgroundColor: '#000' }}>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
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

            {/* Metric UI Overlay Card */}
            <div style={{
              position: 'absolute',
              bottom: '24px',
              left: '16px',
              backgroundColor: 'rgba(18, 18, 20, 0.88)',
              backdropFilter: 'blur(12px)',
              borderRadius: '16px',
              padding: '12px 16px',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              zIndex: 20,
              minWidth: '150px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                <span style={{ backgroundColor: '#EF4444', color: '#FFF', fontSize: '10px', fontWeight: '800', padding: '2px 6px', borderRadius: '4px' }}>
                  METRIC
                </span>
                <span style={{ fontSize: '13px', color: '#E4E4E7', fontWeight: '600' }}>
                  {loadKg}kg rep {repCountRef.current}
                </span>
              </div>

              <div style={{ fontSize: '32px', fontWeight: '800', color: '#00FF66', lineHeight: '1' }}>
                {currentVelRef.current.toFixed(2)}
              </div>
              <div style={{ fontSize: '11px', color: '#A1A1AA', marginTop: '4px', fontWeight: '500' }}>
                m. Vel (m/s)
              </div>
            </div>

            {/* Start Overlay */}
            {!cameraActive && (
              <div style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                backgroundColor: 'rgba(0,0,0,0.82)',
                zIndex: 15,
                padding: '20px',
                textAlign: 'center'
              }}>
                <p style={{ color: '#E4E4E7', fontSize: '14px', marginBottom: '16px', fontWeight: '600' }}>
                  Point camera at the barbell end. Real-time optical flow will auto-lock and track speed.
                </p>
                <button
                  onClick={startCamera}
                  style={{
                    width: '100%',
                    padding: '14px 20px',
                    borderRadius: '12px',
                    border: 'none',
                    backgroundColor: '#7C3AED',
                    color: '#FFFFFF',
                    fontSize: '15px',
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
                  top: '16px',
                  right: '16px',
                  padding: '8px 14px',
                  borderRadius: '20px',
                  border: 'none',
                  backgroundColor: '#EF4444',
                  color: '#FFF',
                  fontSize: '12px',
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

        {/* Autoregulate Analytics View */}
        {activeTab === 'autoregulate' && (
          <div style={{ padding: '16px', overflowY: 'auto', maxHeight: '680px' }}>
            <div style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '16px',
              padding: '14px 16px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              border: '1px solid #E4E4E7',
              marginBottom: '16px'
            }}>
              <div>
                <div style={{ fontSize: '10px', color: '#71717A', fontWeight: '600' }}>Barbell Velocity</div>
                <div style={{ fontSize: '24px', fontWeight: '900', color: '#16A34A' }}>
                  ↗ {currentVelRef.current.toFixed(2)} m/s
                </div>
                <div style={{ fontSize: '10px', color: '#A1A1AA' }}>Autoregulated target: 0.50 m/s</div>
              </div>
            </div>
          </div>
        )}

        {/* Bottom Panel */}
        <div style={{ padding: '14px 16px 20px', backgroundColor: '#FFFFFF', borderTop: '1px solid #E4E4E7' }}>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: '10px', color: '#71717A', fontWeight: '700' }}>EXERCISE</label>
              <select
                value={exercise}
                onChange={(e) => setExercise(e.target.value)}
                style={{ width: '100%', padding: '8px', borderRadius: '8px', border: '1px solid #E4E4E7', fontSize: '13px', fontWeight: '600' }}
              >
                <option value="Back Squat">Back Squat</option>
                <option value="Bench Press">Bench Press</option>
                <option value="Deadlift">Deadlift</option>
              </select>
            </div>
            <div style={{ width: '90px' }}>
              <label style={{ fontSize: '10px', color: '#71717A', fontWeight: '700' }}>LOAD (KG)</label>
              <input
                type="number"
                value={loadKg}
                onChange={(e) => setLoadKg(Number(e.target.value))}
                style={{ width: '100%', padding: '8px', borderRadius: '8px', border: '1px solid #E4E4E7', fontSize: '13px', fontWeight: '600' }}
              />
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}