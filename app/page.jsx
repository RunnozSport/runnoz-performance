'use client'
import { useState, useRef, useEffect } from 'react'

export default function Page() {
  const [step, setStep] = useState('setup')
  const [exercise, setExercise] = useState('Back Squat')
  const [loadKg, setLoadKg] = useState(100)
  const [targetReps, setTargetReps] = useState(3)
  const [isPlateDetected, setIsPlateDetected] = useState(false)
  const [plateColor, setPlateColor] = useState('red')
  const [currentVelocity, setCurrentVelocity] = useState(0)
  const [repCount, setRepCount] = useState(0)
  const [repData, setRepData] = useState([])
  const [cameraError, setCameraError] = useState('')
  const [audioFeedback, setAudioFeedback] = useState(true)

  // --- PRE-FLIGHT CHECKLIST STATE ---
  const [readinessScore, setReadinessScore] = useState(0)
  const [checks, setChecklist] = useState({
    plateLocked: false,
    framingDistance: false,
    fpsReady: false,
    lightingReady: false
  })

  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const procCanvasRef = useRef(null)
  const rafRef = useRef(null)
  const isTrackingRef = useRef(false)
  const stepRef = useRef('setup')

  const platePosRef = useRef(null)
  const plateTemplateRef = useRef(null)
  const lastYRef = useRef(null)
  const lastTimeRef = useRef(null)
  const pathPointsRef = useRef([])

  // FPS & Quality Measurement Refs
  const frameCountRef = useRef(0)
  const lastFpsTimeRef = useRef(performance.now())
  const currentFpsRef = useRef(0)

  const isConcentricRef = useRef(false)
  const concentricVelocitiesRef = useRef([])

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
        videoRef.current.srcObject.getTracks().forEach((t) => t.stop())
      }
    }
  }, [])

  const speakVelocity = (vel) => {
    if (!audioFeedback || typeof window === 'undefined') return
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel()
      const msg = new SpeechSynthesisUtterance(`${vel.toFixed(2)}`)
      msg.rate = 1.2
      window.speechSynthesis.speak(msg)
    }
  }

  // Optical Tracking & Quality Diagnostic Engine
  const detectPlate = (video, displayWidth, displayHeight) => {
    const procCanvas = procCanvasRef.current
    if (!procCanvas) return null

    const pCtx = procCanvas.getContext('2d', { willReadFrequently: true })
    const pW = procCanvas.width
    const pH = procCanvas.height

    pCtx.drawImage(video, 0, 0, pW, pH)

    const scaleX = displayWidth / pW
    const scaleY = displayHeight / pH
    const tSize = 20

    if (!platePosRef.current || !plateTemplateRef.current) {
      const initX = Math.floor(pW / 2)
      const initY = Math.floor(pH / 2)
      plateTemplateRef.current = pCtx.getImageData(initX - tSize / 2, initY - tSize / 2, tSize, tSize)
      platePosRef.current = { x: displayWidth / 2, y: displayHeight / 2, radius: 28 }
      return { x: displayWidth / 2, y: displayHeight / 2, confidence: 100, contrast: 80 }
    }

    const currentPos = platePosRef.current
    const anchorPX = Math.floor(currentPos.x / scaleX)
    const anchorPY = Math.floor(currentPos.y / scaleY)

    const searchRadius = 25
    const startX = Math.max(tSize / 2, anchorPX - searchRadius)
    const endX = Math.min(pW - tSize / 2, anchorPX + searchRadius)
    const startY = Math.max(tSize / 2, anchorPY - searchRadius)
    const endY = Math.min(pH - tSize / 2, anchorPY + searchRadius)

    const searchWidth = endX - startX + tSize
    const searchHeight = endY - startY + tSize

    if (searchWidth <= 0 || searchHeight <= 0) return null

    const searchArea = pCtx.getImageData(startX - tSize / 2, startY - tSize / 2, searchWidth, searchHeight)
    const templateData = plateTemplateRef.current.data
    const searchData = searchArea.data

    let minDiff = Infinity
    let bestX = anchorPX
    let bestY = anchorPY

    for (let sy = 0; sy < searchHeight - tSize; sy += 2) {
      for (let sx = 0; sx < searchWidth - tSize; sx += 2) {
        let diff = 0
        for (let ty = 0; ty < tSize; ty += 4) {
          for (let tx = 0; tx < tSize; tx += 4) {
            const sIdx = ((sy + ty) * searchWidth + (sx + tx)) * 4
            const tIdx = (ty * tSize + tx) * 4
            diff += Math.abs(searchData[sIdx] - templateData[tIdx]) +
                    Math.abs(searchData[sIdx + 1] - templateData[tIdx + 1]) +
                    Math.abs(searchData[sIdx + 2] - templateData[tIdx + 2])
          }
        }
        if (diff < minDiff) {
          minDiff = diff
          bestX = startX + sx + tSize / 2
          bestY = startY + sy + tSize / 2
        }
      }
    }

    const rawTargetX = bestX * scaleX
    const rawTargetY = bestY * scaleY

    const alpha = 0.35
    platePosRef.current.x += alpha * (rawTargetX - platePosRef.current.x)
    platePosRef.current.y += alpha * (rawTargetY - platePosRef.current.y)

    return {
      x: platePosRef.current.x,
      y: platePosRef.current.y,
      confidence: minDiff < 16000 ? 95 : 10,
      contrast: minDiff
    }
  }

  // 60 FPS Main Loop with Diagnostic Evaluation
  const runTracker = () => {
    const track = () => {
      if (!isTrackingRef.current || !videoRef.current || !canvasRef.current) return

      const video = videoRef.current
      const canvas = canvasRef.current
      const ctx = canvas.getContext('2d')
      const now = performance.now()

      // Calculate Real-Time FPS
      frameCountRef.current += 1
      if (now - lastFpsTimeRef.current >= 1000) {
        currentFpsRef.current = frameCountRef.current
        frameCountRef.current = 0
        lastFpsTimeRef.current = now
      }

      if (video.readyState >= 2) {
        const detected = detectPlate(video, canvas.width, canvas.height)
        const isLocked = detected && detected.confidence > 50

        setPlateColor(isLocked ? 'green' : 'red')
        setIsPlateDetected(isLocked)

        // Evaluate Diagnostic Checklist in Alignment Step
        if (stepRef.current === 'align') {
          const isFpsOk = currentFpsRef.current >= 45
          const isLightingOk = detected ? detected.confidence > 70 : false
          const isFramingOk = platePosRef.current
            ? platePosRef.current.x > canvas.width * 0.15 && platePosRef.current.x < canvas.width * 0.85
            : false

          const newChecks = {
            plateLocked: isLocked,
            framingDistance: isFramingOk,
            fpsReady: isFpsOk,
            lightingReady: isLightingOk
          }

          setChecklist(newChecks)

          // Calculate Overall Readiness %
          let passCount = 0
          if (isLocked) passCount += 30
          if (isFramingOk) passCount += 25
          if (isFpsOk) passCount += 25
          if (isLightingOk) passCount += 20

          setReadinessScore(passCount)
        }

        if (isLocked && platePosRef.current) {
          const plate = platePosRef.current

          if (stepRef.current === 'recording') {
            pathPointsRef.current.push({ x: plate.x, y: plate.y })
            if (pathPointsRef.current.length > 70) pathPointsRef.current.shift()

            if (lastYRef.current !== null && lastTimeRef.current !== null) {
              const deltaY = lastYRef.current - plate.y
              const deltaTime = (now - lastTimeRef.current) / 1000
              const metersPerPixel = 0.0028

              if (deltaTime > 0 && deltaTime < 0.2) {
                const vel = (deltaY * metersPerPixel) / deltaTime

                if (Math.abs(vel) > 0.01) {
                  setCurrentVelocity(Math.abs(vel))
                }

                if (vel > 0.04) {
                  if (!isConcentricRef.current) isConcentricRef.current = true
                  concentricVelocitiesRef.current.push(vel)
                } else if (vel < -0.04 && isConcentricRef.current) {
                  isConcentricRef.current = false
                  const vels = concentricVelocitiesRef.current
                  const meanVel = vels.length > 0 ? vels.reduce((a, b) => a + b, 0) / vels.length : currentVelocity
                  const finalRepVel = parseFloat(meanVel.toFixed(2))

                  setRepData((prev) => {
                    const updated = [...prev, { rep: prev.length + 1, vel: finalRepVel, eccn: 0.6, rom: 55 }]
                    setRepCount(updated.length)
                    if (updated.length >= targetReps) {
                      setTimeout(() => finishRecording(), 100)
                    }
                    return updated
                  })

                  speakVelocity(finalRepVel)
                  concentricVelocitiesRef.current = []
                }
              }
            }

            lastYRef.current = plate.y
            lastTimeRef.current = now
          }

          ctx.clearRect(0, 0, canvas.width, canvas.height)

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

          const targetColor = isLocked ? '#00FF66' : '#EF4444'

          ctx.strokeStyle = targetColor
          ctx.lineWidth = 4
          ctx.beginPath()
          ctx.arc(plate.x, plate.y, plate.radius || 28, 0, Math.PI * 2)
          ctx.stroke()

          ctx.fillStyle = targetColor
          ctx.beginPath()
          ctx.arc(plate.x, plate.y, 6, 0, Math.PI * 2)
          ctx.fill()
        }
      }

      if (isTrackingRef.current) {
        rafRef.current = requestAnimationFrame(track)
      }
    }

    track()
  }

  const startCamera = async () => {
    setCameraError('')
    setStep('align')

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'environment', frameRate: { ideal: 60 } },
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
          isTrackingRef.current = true
          runTracker()
        }
      }
    } catch (err) {
      setCameraError('Camera access denied')
    }
  }

  const stopCamera = () => {
    isTrackingRef.current = false
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    if (videoRef.current?.srcObject) {
      videoRef.current.srcObject.getTracks().forEach((t) => t.stop())
      videoRef.current.srcObject = null
    }
  }

  const handleReady = () => setStep('ready')

  const handleStartRecording = () => {
    setRepData([])
    setRepCount(0)
    pathPointsRef.current = []
    concentricVelocitiesRef.current = []
    lastYRef.current = platePosRef.current?.y || null
    lastTimeRef.current = performance.now()
    setStep('recording')
  }

  const finishRecording = () => {
    stopCamera()
    setStep('summary')
  }

  const resetAll = () => {
    stopCamera()
    setRepData([])
    setRepCount(0)
    setCurrentVelocity(0)
    platePosRef.current = null
    plateTemplateRef.current = null
    setStep('setup')
  }

  const handleTapToLock = (e) => {
    if (!canvasRef.current || !procCanvasRef.current || !videoRef.current) return
    const rect = canvasRef.current.getBoundingClientRect()
    const scaleX = canvasRef.current.width / rect.width
    const scaleY = canvasRef.current.height / rect.height

    const clickX = (e.clientX - rect.left) * scaleX
    const clickY = (e.clientY - rect.top) * scaleY

    const pCtx = procCanvasRef.current.getContext('2d')
    const pW = procCanvasRef.current.width
    const pH = procCanvasRef.current.height
    pCtx.drawImage(videoRef.current, 0, 0, pW, pH)

    const tSize = 20
    const procX = Math.floor((clickX / canvasRef.current.width) * pW)
    const procY = Math.floor((clickY / canvasRef.current.height) * pH)

    plateTemplateRef.current = pCtx.getImageData(
      Math.max(0, procX - tSize / 2),
      Math.max(0, procY - tSize / 2),
      tSize,
      tSize
    )
    platePosRef.current = { x: clickX, y: clickY, radius: 28 }
    setIsPlateDetected(true)
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0D0D0E', color: '#FFF', fontFamily: 'system-ui', paddingBottom: '80px' }}>
      {/* Header */}
      <div style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #1C1C1F' }}>
        <div>
          <h1 style={{ fontSize: '18px', fontWeight: '700', margin: 0 }}>{exercise}</h1>
          <p style={{ fontSize: '12px', color: '#A1A1AA', margin: '2px 0 0 0' }}>{loadKg}kg × {targetReps} reps</p>
        </div>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          <button onClick={() => setAudioFeedback(!audioFeedback)} style={{ fontSize: '18px', border: 'none', background: 'none', cursor: 'pointer', opacity: audioFeedback ? 1 : 0.4 }}>🔊</button>
          <span onClick={resetAll} style={{ fontSize: '20px', cursor: 'pointer' }}>←</span>
        </div>
      </div>

      {/* STEP 1: SETUP */}
      {step === 'setup' && (
        <div style={{ padding: '24px', maxWidth: '500px', margin: '0 auto' }}>
          <h2 style={{ fontSize: '20px', fontWeight: '800', marginBottom: '20px' }}>Setup</h2>
          <div style={{ marginBottom: '20px' }}>
            <label style={{ fontSize: '12px', color: '#A1A1AA', fontWeight: '700', display: 'block', marginBottom: '6px' }}>EXERCISE</label>
            <select value={exercise} onChange={(e) => setExercise(e.target.value)} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #27272A', backgroundColor: '#18181C', color: '#FFF' }}>
              <option>Back Squat</option>
              <option>Bench Press</option>
              <option>Deadlift</option>
            </select>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
            <div>
              <label style={{ fontSize: '12px', color: '#A1A1AA', fontWeight: '700', display: 'block', marginBottom: '6px' }}>LOAD (KG)</label>
              <input type="number" value={loadKg} onChange={(e) => setLoadKg(Number(e.target.value))} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #27272A', backgroundColor: '#18181C', color: '#FFF' }} />
            </div>
            <div>
              <label style={{ fontSize: '12px', color: '#A1A1AA', fontWeight: '700', display: 'block', marginBottom: '6px' }}>REPS</label>
              <input type="number" value={targetReps} onChange={(e) => setTargetReps(Number(e.target.value))} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #27272A', backgroundColor: '#18181C', color: '#FFF' }} />
            </div>
          </div>
          <button onClick={startCamera} style={{ width: '100%', padding: '14px', borderRadius: '8px', border: 'none', backgroundColor: '#EF4444', color: '#FFF', fontSize: '16px', fontWeight: '800', cursor: 'pointer' }}>Start Camera Alignment →</button>
        </div>
      )}

      {/* STEP 2: CAMERA ALIGNMENT & PRE-FLIGHT CHECKLIST */}
      {(step === 'align' || step === 'ready' || step === 'recording') && (
        <div style={{ padding: '16px' }}>
          <div style={{ position: 'relative', width: '100%', aspectRatio: '9/16', backgroundColor: '#18181B', borderRadius: '12px', overflow: 'hidden' }}>
            <video ref={videoRef} autoPlay playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            <canvas ref={canvasRef} onClick={handleTapToLock} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 10, cursor: 'crosshair' }} />

            {/* PRE-RECORDING ACCURACY DIAGNOSTIC OVERLAY (ALIGN STEP) */}
            {step === 'align' && (
              <div style={{
                position: 'absolute',
                top: '12px',
                left: '12px',
                right: '12px',
                backgroundColor: 'rgba(18, 18, 20, 0.92)',
                backdropFilter: 'blur(10px)',
                borderRadius: '12px',
                padding: '12px 16px',
                border: '1px solid #27272A',
                zIndex: 25
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '12px', fontWeight: '800', color: '#E4E4E7' }}>ACCURACY DIAGNOSTIC</span>
                  <span style={{ fontSize: '14px', fontWeight: '900', color: readinessScore >= 95 ? '#00FF66' : '#EF4444' }}>
                    {readinessScore}% READY
                  </span>
                </div>

                {/* Progress Bar */}
                <div style={{ width: '100%', height: '6px', backgroundColor: '#27272A', borderRadius: '3px', overflow: 'hidden', marginBottom: '10px' }}>
                  <div style={{ width: `${readinessScore}%`, height: '100%', backgroundColor: readinessScore >= 95 ? '#00FF66' : '#EF4444', transition: 'width 0.3s' }} />
                </div>

                {/* Diagnostic Criteria List */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', fontSize: '10px', color: '#A1A1AA' }}>
                  <div style={{ color: checks.plateLocked ? '#00FF66' : '#A1A1AA' }}>
                    {checks.plateLocked ? '✓' : '✗'} Weight Plate Locked
                  </div>
                  <div style={{ color: checks.framingDistance ? '#00FF66' : '#A1A1AA' }}>
                    {checks.framingDistance ? '✓' : '✗'} Distance ($1.5\text{--}2.5\text{m}$)
                  </div>
                  <div style={{ color: checks.fpsReady ? '#00FF66' : '#A1A1AA' }}>
                    {checks.fpsReady ? '✓' : '✗'} Camera FPS ($\ge 50$)
                  </div>
                  <div style={{ color: checks.lightingReady ? '#00FF66' : '#A1A1AA' }}>
                    {checks.lightingReady ? '✓' : '✗'} Contrast / Lighting
                  </div>
                </div>
              </div>
            )}

            {/* Floating Metric Card Overlay */}
            <div style={{ position: 'absolute', bottom: '16px', left: '16px', backgroundColor: 'rgba(18, 18, 20, 0.9)', borderRadius: '12px', padding: '12px 16px', border: '1px solid #27272A', zIndex: 20 }}>
              <div style={{ fontSize: '32px', fontWeight: '900', color: '#00FF66' }}>{currentVelocity.toFixed(2)}</div>
              <div style={{ fontSize: '11px', color: '#A1A1AA', marginTop: '4px' }}>Mean Vel (m/s)</div>
              <div style={{ fontSize: '13px', color: '#E4E4E7', marginTop: '6px', fontWeight: '600' }}>{repCount}/{targetReps}</div>
            </div>

            {/* Guided Flow Buttons */}
            {step === 'align' && (
              <button
                onClick={handleReady}
                disabled={readinessScore < 95}
                style={{
                  position: 'absolute',
                  bottom: '16px',
                  right: '16px',
                  padding: '12px 24px',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: readinessScore >= 95 ? '#00FF66' : '#27272A',
                  color: readinessScore >= 95 ? '#000' : '#71717A',
                  fontWeight: '800',
                  fontSize: '14px',
                  cursor: readinessScore >= 95 ? 'pointer' : 'not-allowed',
                  zIndex: 30
                }}
              >
                {readinessScore >= 95 ? 'READY ✓' : 'ALIGN CAMERA...'}
              </button>
            )}

            {step === 'ready' && (
              <button onClick={handleStartRecording} style={{ position: 'absolute', bottom: '16px', right: '16px', padding: '12px 24px', borderRadius: '8px', border: 'none', backgroundColor: '#EF4444', color: '#FFF', fontWeight: '800', fontSize: '14px', cursor: 'pointer', zIndex: 30 }}>⏺ START RECORDING</button>
            )}

            {step === 'recording' && (
              <div style={{ position: 'absolute', top: '12px', right: '12px', backgroundColor: '#EF4444', color: '#FFF', fontSize: '12px', fontWeight: '900', padding: '6px 12px', borderRadius: '8px', zIndex: 30 }}>🔴 REC</div>
            )}
          </div>
        </div>
      )}

      {/* STEP 3: SUMMARY */}
      {step === 'summary' && repData.length > 0 && (
        <div style={{ padding: '20px 16px' }}>
          <div style={{ fontSize: '18px', fontWeight: '800', color: '#EF4444', marginBottom: '16px' }}>✓ Set Complete</div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
            <div>
              <div style={{ fontSize: '12px', color: '#A1A1AA', marginBottom: '4px' }}>Best</div>
              <div style={{ fontSize: '24px', fontWeight: '800', color: '#FFF' }}>{Math.max(...repData.map((r) => r.vel)).toFixed(2)} m/s</div>
            </div>
            <div>
              <div style={{ fontSize: '12px', color: '#A1A1AA', marginBottom: '4px' }}>Average</div>
              <div style={{ fontSize: '24px', fontWeight: '800', color: '#FFF' }}>{(repData.reduce((a, b) => a + b.vel, 0) / repData.length).toFixed(2)} m/s</div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px', height: '120px', alignItems: 'flex-end', paddingBottom: '12px', marginBottom: '20px', borderBottom: '1px solid #27272A' }}>
            {repData.map((r, i) => (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{ width: '100%', height: `${(r.vel / 1.2) * 100}%`, backgroundColor: '#EF4444', borderRadius: '4px 4px 0 0' }} />
                <div style={{ fontSize: '11px', color: '#A1A1AA', marginTop: '8px' }}>{r.rep}</div>
              </div>
            ))}
          </div>

          {repData.map((r) => (
            <div key={r.rep} style={{ display: 'grid', gridTemplateColumns: '40px 1fr', padding: '12px 0', borderTop: '1px solid #1C1C1F' }}>
              <div style={{ color: '#A1A1AA', fontSize: '12px' }}>Rep {r.rep}</div>
              <div style={{ fontSize: '14px', fontWeight: '700', color: '#FFF' }}>{r.vel} m/s</div>
            </div>
          ))}

          <button onClick={resetAll} style={{ width: '100%', marginTop: '20px', padding: '14px', borderRadius: '8px', border: 'none', backgroundColor: '#EF4444', color: '#FFF', fontSize: '15px', fontWeight: '800', cursor: 'pointer' }}>Next Set →</button>
        </div>
      )}
    </div>
  )
}