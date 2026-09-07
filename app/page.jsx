'use client'
import { useState, useRef, useEffect } from 'react'

export default function Page() {
  // Workflow Steps: 'setup' | 'align' | 'ready' | 'recording' | 'summary'
  const [step, setStep] = useState('setup')
  
  // Workout Configuration
  const [exercise, setExercise] = useState('Back Squat - High Bar')
  const [loadKg, setLoadKg] = useState(100)
  const [targetReps, setTargetReps] = useState(3)
  const [audioFeedback, setAudioFeedback] = useState(true)

  // Tracker State
  const [cameraActive, setCameraActive] = useState(false)
  const [cameraError, setCameraError] = useState('')
  const [isPlateDetected, setIsPlateDetected] = useState(false)
  const [detectionConfidence, setDetectionConfidence] = useState(0)

  // Recorded Sets Data
  const [repData, setRepData] = useState([])

  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const procCanvasRef = useRef(null)
  const rafRef = useRef(null)
  const isTrackingRef = useRef(false)
  const stepRef = useRef('setup')

  // Motion Math Variables
  const plateBBoxRef = useRef(null)
  const lastYRef = useRef(null)
  const lastTimeRef = useRef(null)
  const pathPointsRef = useRef([])
  const isMovingRef = useRef(false)

  const currentVelRef = useRef(0.00)
  const peakVelRef = useRef(0.00)

  // Keep stepRef in sync with state
  useEffect(() => {
    stepRef.current = step
  }, [step])

  useEffect(() => {
    procCanvasRef.current = document.createElement('canvas')
    procCanvasRef.current.width = 320
    procCanvasRef.current.height = 180

    return () => {
      isTrackingRef.current = false
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      if (videoRef.current?.srcObject) {
        videoRef.current.srcObject.getTracks().forEach(t => t.stop())
      }
    }
  }, [])

  // Speech Output
  const speakVelocity = (vel) => {
    if (!audioFeedback || typeof window === 'undefined') return
    try {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel()
        const msg = new SpeechSynthesisUtterance(`${vel.toFixed(2)}`)
        msg.rate = 1.2
        window.speechSynthesis.speak(msg)
      }
    } catch (e) {
      console.warn('Speech failed:', e)
    }
  }

  // REFINED: Improved plate detection with Sobel gradient
  const detectWeightPlateHub = (video, displayWidth, displayHeight) => {
    const procCanvas = procCanvasRef.current
    if (!procCanvas) return null

    const pCtx = procCanvas.getContext('2d', { willReadFrequently: true })
    const pW = procCanvas.width
    const pH = procCanvas.height

    pCtx.drawImage(video, 0, 0, pW, pH)
    const imgData = pCtx.getImageData(0, 0, pW, pH)
    const data = imgData.data

    let maxGradient = 0
    let bestX = pW / 2
    let bestY = pH / 2

    const lastPos = plateBBoxRef.current
    const searchScaleX = pW / displayWidth
    const searchScaleY = pH / displayHeight

    let startX, endX, startY, endY

    if (lastPos) {
      const margin = 40
      startX = Math.max(5, Math.floor(lastPos.x * searchScaleX) - margin)
      endX = Math.min(pW - 5, Math.floor(lastPos.x * searchScaleX) + margin)
      startY = Math.max(5, Math.floor(lastPos.y * searchScaleY) - margin)
      endY = Math.min(pH - 5, Math.floor(lastPos.y * searchScaleY) + margin)
    } else {
      startX = Math.floor(pW * 0.15)
      endX = Math.floor(pW * 0.85)
      startY = Math.floor(pH * 0.15)
      endY = Math.floor(pH * 0.85)
    }

    // REFINED: Sobel gradient detection
    for (let y = startY + 1; y < endY - 1; y += 2) {
      for (let x = startX + 1; x < endX - 1; x += 2) {
        const idx = (y * pW + x) * 4

        // Sobel X gradient
        const left = data[idx - 4] * 0.299 + data[idx - 3] * 0.587 + data[idx - 2] * 0.114
        const right = data[idx + 4] * 0.299 + data[idx + 5] * 0.587 + data[idx + 6] * 0.114
        const gx = Math.abs(right - left)

        // Sobel Y gradient
        const top = data[(y - 1) * pW * 4 + x * 4] * 0.299
        const bottom = data[(y + 1) * pW * 4 + x * 4] * 0.299
        const gy = Math.abs(bottom - top)

        const gradient = gx + gy

        if (gradient > maxGradient) {
          maxGradient = gradient
          bestX = x
          bestY = y
        }
      }
    }

    const scaleX = displayWidth / pW
    const scaleY = displayHeight / pH

    return {
      x: bestX * scaleX,
      y: bestY * scaleY,
      confidence: Math.min(maxGradient, 255)
    }
  }

  // REFINED: High Frequency Optical Loop - Smart plate detection first
  const runPlateTrackerLoop = () => {
    const detect = () => {
      if (!isTrackingRef.current || !videoRef.current || !canvasRef.current) return

      const video = videoRef.current
      const canvas = canvasRef.current
      const ctx = canvas.getContext('2d')
      const now = performance.now()

      if (video.readyState >= 2) {
        const width = canvas.width
        const height = canvas.height

        const detected = detectWeightPlateHub(video, width, height)
        // REFINED: Require confidence > 15 before showing as locked
        const isLocked = detected && detected.confidence > 15
        setIsPlateDetected(isLocked)
        setDetectionConfidence(Math.round((detected?.confidence || 0) / 255 * 100))

        if (detected && isLocked) {
          if (!plateBBoxRef.current) {
            plateBBoxRef.current = { x: detected.x, y: detected.y, radius: 28 }
          } else {
            // REFINED: Increased smoothing (0.6) to eliminate sensor jitter
            const alpha = 0.6
            plateBBoxRef.current.x += alpha * (detected.x - plateBBoxRef.current.x)
            plateBBoxRef.current.y += alpha * (detected.y - plateBBoxRef.current.y)
            plateBBoxRef.current.radius = 28
          }

          const plate = plateBBoxRef.current

          // REFINED: Only track reps if confidence is strong (>40%) AND in recording mode
          if (stepRef.current === 'recording' && detected.confidence > 102) {
            pathPointsRef.current.push({ x: plate.x, y: plate.y })
            if (pathPointsRef.current.length > 70) pathPointsRef.current.shift()

            if (lastYRef.current !== null && lastTimeRef.current !== null) {
              const deltaY = lastYRef.current - plate.y
              const deltaTime = (now - lastTimeRef.current) / 1000
              const metersPerPixel = 0.0028

              if (deltaTime > 0 && deltaTime < 0.2) {
                const vel = (deltaY * metersPerPixel) / deltaTime

                // REFINED: Higher noise filtering threshold (0.08)
                if (Math.abs(vel) > 0.08) {
                  currentVelRef.current = Math.abs(vel)
                }

                // REFINED: State machine with doubled thresholds (0.12)
                // Requires FULL rep cycle: concentric → eccentric
                if (vel > 0.12) {
                  // Concentric phase (moving up)
                  if (!isMovingRef.current) isMovingRef.current = true
                  if (vel > peakVelRef.current) peakVelRef.current = vel
                } 
                else if (vel < -0.12 && isMovingRef.current) {
                  // Eccentric phase detected - rep complete!
                  isMovingRef.current = false
                  const repVel = peakVelRef.current > 0 ? peakVelRef.current : currentVelRef.current

                  setRepData((prev) => {
                    const newReps = [
                      ...prev,
                      { rep: prev.length + 1, vel: parseFloat(repVel.toFixed(2)), eccn: 0.6, rom: 55 }
                    ]

                    speakVelocity(repVel)

                    if (newReps.length >= targetReps) {
                      setTimeout(() => finishRecording(), 100)
                    }

                    return newReps
                  })

                  peakVelRef.current = 0
                }
              }
            }

            lastYRef.current = plate.y
            lastTimeRef.current = now
          }

          ctx.clearRect(0, 0, width, height)

          // Draw Green Trajectory Path during recording
          if (stepRef.current === 'recording' && pathPointsRef.current.length > 1) {
            ctx.strokeStyle = '#00FF66'
            ctx.lineWidth = 5
            ctx.lineCap = 'round'
            ctx.setLineDash([8, 8])

            ctx.beginPath()
            ctx.moveTo(pathPointsRef.current[0].x, pathPointsRef.current[0].y)
            for (let i = 1; i < pathPointsRef.current.length; i++) {
              ctx.lineTo(pathPointsRef.current[i].x, pathPointsRef.current[i].y)
            }
            ctx.stroke()
            ctx.setLineDash([])
          }

          // REFINED: Draw Target Circle: GREEN when plate locked, RED when searching
          const targetColor = isLocked ? '#00FF66' : '#EF4444'

          ctx.strokeStyle = targetColor
          ctx.lineWidth = 4
          ctx.beginPath()
          ctx.arc(plate.x, plate.y, plate.radius, 0, Math.PI * 2)
          ctx.stroke()

          ctx.fillStyle = targetColor
          ctx.beginPath()
          ctx.arc(plate.x, plate.y, 6, 0, Math.PI * 2)
          ctx.fill()
        }
      }

      if (isTrackingRef.current) {
        rafRef.current = requestAnimationFrame(detect)
      }
    }

    detect()
  }

  // START CAMERA
  const startCamera = async () => {
    setCameraError('')
    setStep('align')

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: { ideal: 'environment' },
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
          isTrackingRef.current = true
          runPlateTrackerLoop()
        }
      }
    } catch (err) {
      setCameraError('Camera error: ' + err.message)
    }
  }

  // Workflow Step Triggers
  const handleHitReady = () => {
    setStep('ready')
  }

  const handleStartRecording = () => {
    setRepData([])
    pathPointsRef.current = []
    currentVelRef.current = 0
    peakVelRef.current = 0
    isMovingRef.current = false

    if (plateBBoxRef.current) {
      lastYRef.current = plateBBoxRef.current.y
    }
    lastTimeRef.current = performance.now()

    setStep('recording')
  }

  const finishRecording = () => {
    stopCamera()
    setStep('summary')
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
    setIsPlateDetected(false)
    plateBBoxRef.current = null
  }

  const resetAll = () => {
    stopCamera()
    setRepData([])
    setStep('setup')
  }

  const handleManualTapToLock = (e) => {
    if (!canvasRef.current) return
    const rect = canvasRef.current.getBoundingClientRect()
    const scaleX = canvasRef.current.width / rect.width
    const scaleY = canvasRef.current.height / rect.height

    const x = (e.clientX - rect.left) * scaleX
    const y = (e.clientY - rect.top) * scaleY

    plateBBoxRef.current = { x, y, radius: 28 }
    setIsPlateDetected(true)
  }

  const vels = repData.map((r) => r.vel)
  const bestRep = vels.length > 0 ? Math.max(...vels).toFixed(2) : '0.00'
  const setAvg = vels.length > 0 ? (vels.reduce((a, b) => a + b, 0) / vels.length).toFixed(2) : '0.00'
  const firstVel = vels[0] || 0
  const lastVel = vels[vels.length - 1] || 0
  const fatigue = firstVel > 0 ? Math.round(((firstVel - lastVel) / firstVel) * 100) : 0

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#0D0D0E',
      color: '#FFFFFF',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
      paddingBottom: '80px'
    }}>
      {/* Top Header */}
      <div style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #1C1C1F' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span onClick={resetAll} style={{ fontSize: '20px', cursor: 'pointer' }}>←</span>
          <div>
            <h1 style={{ fontSize: '18px', fontWeight: '700', margin: 0 }}>{exercise}</h1>
            <p style={{ fontSize: '12px', color: '#A1A1AA', margin: '2px 0 0 0' }}>
              {loadKg} kg × {targetReps} reps target
            </p>
          </div>
        </div>
        <button onClick={() => setAudioFeedback(!audioFeedback)} style={{ fontSize: '18px', border: 'none', background: 'none', cursor: 'pointer', opacity: audioFeedback ? 1 : 0.4 }}>
          🔊
        </button>
      </div>

      {/* STEP 1: EXERCISE SETUP FORM */}
      {step === 'setup' && (
        <div style={{ padding: '24px', maxWidth: '500px', margin: '0 auto' }}>
          <h2 style={{ fontSize: '20px', fontWeight: '800', marginBottom: '20px' }}>Setup Your Set</h2>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ fontSize: '12px', color: '#A1A1AA', fontWeight: '700', display: 'block', marginBottom: '6px' }}>
              SELECT EXERCISE
            </label>
            <select
              value={exercise}
              onChange={(e) => setExercise(e.target.value)}
              style={{ width: '100%', padding: '14px', borderRadius: '12px', border: '1px solid #27272A', backgroundColor: '#18181C', color: '#FFF', fontSize: '15px', fontWeight: '600' }}
            >
              <option value="Back Squat - High Bar">Back Squat - High Bar</option>
              <option value="Back Squat - Low Bar">Back Squat - Low Bar</option>
              <option value="Bench Press">Bench Press</option>
              <option value="Conventional Deadlift">Conventional Deadlift</option>
              <option value="Overhead Press">Overhead Press</option>
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
            <div>
              <label style={{ fontSize: '12px', color: '#A1A1AA', fontWeight: '700', display: 'block', marginBottom: '6px' }}>
                LOAD (KG)
              </label>
              <input
                type="number"
                value={loadKg}
                onChange={(e) => setLoadKg(Number(e.target.value))}
                style={{ width: '100%', padding: '14px', borderRadius: '12px', border: '1px solid #27272A', backgroundColor: '#18181C', color: '#FFF', fontSize: '15px', fontWeight: '600' }}
              />
            </div>

            <div>
              <label style={{ fontSize: '12px', color: '#A1A1AA', fontWeight: '700', display: 'block', marginBottom: '6px' }}>
                TARGET REPS
              </label>
              <input
                type="number"
                value={targetReps}
                onChange={(e) => setTargetReps(Number(e.target.value))}
                style={{ width: '100%', padding: '14px', borderRadius: '12px', border: '1px solid #27272A', backgroundColor: '#18181C', color: '#FFF', fontSize: '15px', fontWeight: '600' }}
              />
            </div>
          </div>

          <button
            onClick={startCamera}
            style={{
              width: '100%',
              padding: '16px',
              borderRadius: '14px',
              border: 'none',
              backgroundColor: '#EF4444',
              color: '#FFF',
              fontSize: '16px',
              fontWeight: '800',
              cursor: 'pointer'
            }}
          >
            Start Camera Alignment →
          </button>
        </div>
      )}

      {/* WORKFLOW STEPS: ALIGN -> READY -> RECORDING */}
      {(step === 'align' || step === 'ready' || step === 'recording') && (
        <div style={{ padding: '0 16px', display: 'grid', gridTemplateColumns: '1fr 120px', gap: '16px', alignItems: 'center' }}>
          
          <div style={{ position: 'relative', width: '100%', aspectRatio: '9/16', backgroundColor: '#18181B', borderRadius: '16px', overflow: 'hidden' }}>
            <video ref={videoRef} autoPlay playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            <canvas ref={canvasRef} onClick={handleManualTapToLock} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 10, cursor: 'crosshair' }} />

            {/* Error Message */}
            {cameraError && (
              <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 40, padding: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
                <p style={{ color: '#EF4444', fontWeight: '700', marginBottom: '16px' }}>{cameraError}</p>
                <button onClick={resetAll} style={{ padding: '10px 20px', backgroundColor: '#27272A', color: '#FFF', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>Back to Setup</button>
              </div>
            )}

            {/* REFINED: Lock Badge - Shows detection status */}
            <div style={{
              position: 'absolute',
              top: '12px',
              left: '12px',
              backgroundColor: isPlateDetected ? 'rgba(0, 255, 102, 0.2)' : 'rgba(239, 68, 68, 0.2)',
              border: `1px solid ${isPlateDetected ? '#00FF66' : '#EF4444'}`,
              color: isPlateDetected ? '#00FF66' : '#EF4444',
              fontSize: '11px',
              fontWeight: '800',
              padding: '6px 12px',
              borderRadius: '20px',
              zIndex: 20
            }}>
              {isPlateDetected ? '🟢 WEIGHT PLATE DETECTED' : '🔴 SEARCHING WEIGHT PLATE...'}
              {isPlateDetected && <span style={{ marginLeft: '6px', fontSize: '10px' }}>({detectionConfidence}%)</span>}
            </div>

            {/* Metric Floating Card */}
            <div style={{
              position: 'absolute',
              bottom: '16px',
              left: '16px',
              backgroundColor: 'rgba(18, 18, 20, 0.88)',
              backdropFilter: 'blur(8px)',
              borderRadius: '12px',
              padding: '10px 14px',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              zIndex: 20
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                <span style={{ backgroundColor: '#EF4444', color: '#FFF', fontSize: '9px', fontWeight: '800', padding: '2px 4px', borderRadius: '3px' }}>
                  METRIC
                </span>
                <span style={{ fontSize: '12px', color: '#E4E4E7', fontWeight: '600' }}>
                  {loadKg}kg {repData.length}/{targetReps}
                </span>
              </div>
              <div style={{ fontSize: '28px', fontWeight: '800', color: '#00FF66', lineHeight: '1' }}>
                {currentVelRef.current.toFixed(2)}
              </div>
              <div style={{ fontSize: '10px', color: '#A1A1AA', marginTop: '2px' }}>
                Mean Vel (m/s)
              </div>
            </div>

            {/* ACTION BUTTONS FLOW */}
            {step === 'align' && isPlateDetected && (
              <div style={{ position: 'absolute', bottom: '16px', right: '16px', zIndex: 30 }}>
                <button
                  onClick={handleHitReady}
                  style={{
                    padding: '12px 24px',
                    borderRadius: '20px',
                    border: 'none',
                    backgroundColor: '#00FF66',
                    color: '#000',
                    fontWeight: '800',
                    fontSize: '14px',
                    cursor: 'pointer',
                    boxShadow: '0 4px 15px rgba(0, 255, 102, 0.4)'
                  }}
                >
                  READY ✓
                </button>
              </div>
            )}

            {step === 'ready' && (
              <div style={{ position: 'absolute', bottom: '16px', right: '16px', zIndex: 30 }}>
                <button
                  onClick={handleStartRecording}
                  style={{
                    padding: '12px 24px',
                    borderRadius: '20px',
                    border: 'none',
                    backgroundColor: '#EF4444',
                    color: '#FFF',
                    fontWeight: '800',
                    fontSize: '14px',
                    cursor: 'pointer',
                    boxShadow: '0 4px 15px rgba(239, 68, 68, 0.4)'
                  }}
                >
                  ⏺ START RECORDING
                </button>
              </div>
            )}

            {step === 'recording' && (
              <div style={{ position: 'absolute', top: '12px', right: '12px', zIndex: 30, backgroundColor: '#EF4444', color: '#FFF', fontSize: '10px', fontWeight: '900', padding: '4px 10px', borderRadius: '12px' }}>
                REC ●
              </div>
            )}
          </div>

          {/* Circular Widgets */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', alignItems: 'center' }}>
            <div style={{ width: '90px', height: '90px', borderRadius: '50%', border: '3px solid #F97316', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: '#121215' }}>
              <span style={{ fontSize: '9px', color: '#F97316', fontWeight: '700' }}>LOAD</span>
              <span style={{ fontSize: '18px', fontWeight: '900', color: '#F97316' }}>100%</span>
            </div>
            <div style={{ width: '80px', height: '80px', borderRadius: '50%', border: '2px solid #27272A', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: '#121215' }}>
              <span style={{ fontSize: '9px', color: '#71717A', fontWeight: '700' }}>POWER</span>
            </div>
            <div style={{ width: '80px', height: '80px', borderRadius: '50%', border: '2px solid #27272A', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: '#121215' }}>
              <span style={{ fontSize: '9px', color: '#71717A', fontWeight: '700' }}>REPS</span>
            </div>
            <div style={{ width: '80px', height: '80px', borderRadius: '50%', border: '2px solid #27272A', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: '#121215' }}>
              <span style={{ fontSize: '9px', color: '#71717A', fontWeight: '700' }}>VELOCITY</span>
            </div>
          </div>
        </div>
      )}

      {/* SUMMARY VIEW: DISPLAY REPS STATS WHEN COMPLETED */}
      {step === 'summary' && repData.length > 0 && (
        <div style={{ padding: '20px 16px 0' }}>
          <div style={{ fontSize: '18px', fontWeight: '800', color: '#EF4444', marginBottom: '12px' }}>
            Mean velocity ▼
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', borderLeft: '1px solid #27272A', paddingLeft: '12px', marginBottom: '20px' }}>
            <div>
              <div style={{ fontSize: '11px', color: '#71717A' }}>Best rep</div>
              <div style={{ fontSize: '20px', fontWeight: '800', color: '#FFF' }}>{bestRep} <span style={{ fontSize: '12px' }}>m/s</span></div>
            </div>
            <div>
              <div style={{ fontSize: '11px', color: '#71717A' }}>Set average</div>
              <div style={{ fontSize: '20px', fontWeight: '800', color: '#FFF' }}>{setAvg} <span style={{ fontSize: '12px' }}>m/s</span></div>
            </div>
            <div>
              <div style={{ fontSize: '11px', color: '#71717A' }}>Fatigue ⇄</div>
              <div style={{ fontSize: '20px', fontWeight: '800', color: '#FFF' }}>{fatigue}%</div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-end', height: '140px', gap: '16px', padding: '0 16px 12px', borderBottom: '1px solid #27272A' }}>
            {repData.map((item, idx) => (
              <div key={idx} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end' }}>
                <span style={{ fontSize: '11px', color: '#A1A1AA', marginBottom: '6px' }}>{item.vel}</span>
                <div style={{ width: '100%', height: `${(item.vel / 1.0) * 100}%`, backgroundColor: '#EF4444', borderRadius: '6px 6px 0 0' }} />
                <span style={{ fontSize: '11px', color: '#71717A', marginTop: '6px' }}>{item.rep}</span>
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '30px 1fr 1fr 1fr 30px', fontSize: '12px', color: '#71717A', padding: '12px 0 8px', textAlign: 'center' }}>
            <div></div>
            <div>Mean Vel<br/><span style={{ fontSize: '10px' }}>m/s</span></div>
            <div>Eccn<br/><span style={{ fontSize: '10px' }}>sec</span></div>
            <div>ROM<br/><span style={{ fontSize: '10px' }}>cm</span></div>
            <div></div>
          </div>

          {repData.map((item) => (
            <div key={item.rep} style={{ display: 'grid', gridTemplateColumns: '30px 1fr 1fr 1fr 30px', fontSize: '14px', fontWeight: '700', color: '#FFF', padding: '10px 0', borderTop: '1px solid #1C1C1F', textAlign: 'center', alignItems: 'center' }}>
              <div style={{ color: '#71717A', fontSize: '12px' }}>{item.rep}</div>
              <div>{item.vel.toFixed(2)}</div>
              <div>{item.eccn.toFixed(1)}</div>
              <div>{item.rom}</div>
              <div style={{ color: '#71717A', cursor: 'pointer' }}>⊖</div>
            </div>
          ))}
        </div>
      )}

      {/* Floating Action Button */}
      {step === 'summary' && (
        <button
          onClick={resetAll}
          style={{
            position: 'fixed',
            bottom: '20px',
            right: '20px',
            backgroundColor: '#EF4444',
            color: '#FFFFFF',
            padding: '14px 24px',
            borderRadius: '24px',
            border: 'none',
            fontSize: '15px',
            fontWeight: '800',
            boxShadow: '0 10px 25px rgba(239, 68, 68, 0.4)',
            cursor: 'pointer',
            zIndex: 50
          }}
        >
          Next Set (+10kg) →
        </button>
      )}
    </div>
  )
}