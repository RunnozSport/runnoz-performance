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

  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const procCanvasRef = useRef(null)
  const rafRef = useRef(null)
  const isTrackingRef = useRef(false)
  const stepRef = useRef('setup')
  const platePosRef = useRef(null)
  const lastYRef = useRef(null)
  const lastTimeRef = useRef(null)
  const repStartRef = useRef(null)
  const peakVelRef = useRef(0)

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

  const detectPlate = (video, width, height) => {
    const procCanvas = procCanvasRef.current
    const pCtx = procCanvas.getContext('2d', { willReadFrequently: true })
    const pW = 320
    const pH = 180

    pCtx.drawImage(video, 0, 0, pW, pH)
    const imgData = pCtx.getImageData(0, 0, pW, pH)
    const data = imgData.data

    let maxEdge = 0
    let centerX = pW / 2
    let centerY = pH / 2

    for (let y = 10; y < pH - 10; y += 2) {
      for (let x = 10; x < pW - 10; x += 2) {
        const idx = (y * pW + x) * 4
        const r = data[idx], g = data[idx + 1], b = data[idx + 2]
        const lum = r * 0.299 + g * 0.587 + b * 0.114
        const rightLum = data[idx + 8] * 0.299 + data[idx + 9] * 0.587 + data[idx + 10] * 0.114
        const edge = Math.abs(lum - rightLum)

        if (edge > maxEdge) {
          maxEdge = edge
          centerX = x
          centerY = y
        }
      }
    }

    const scaleX = width / pW
    const scaleY = height / pH

    return { x: centerX * scaleX, y: centerY * scaleY, strength: maxEdge }
  }

  const runTracker = () => {
    const track = () => {
      if (!isTrackingRef.current || !videoRef.current || !canvasRef.current) return

      const video = videoRef.current
      const canvas = canvasRef.current
      const ctx = canvas.getContext('2d')
      const now = performance.now()

      if (video.readyState >= 2) {
        const detected = detectPlate(video, canvas.width, canvas.height)
        const isLocked = detected.strength > 20
        setPlateColor(isLocked ? 'green' : 'red')
        setIsPlateDetected(isLocked)

        if (isLocked) {
          if (!platePosRef.current) {
            platePosRef.current = { x: detected.x, y: detected.y }
          } else {
            const smooth = 0.5
            platePosRef.current.x += smooth * (detected.x - platePosRef.current.x)
            platePosRef.current.y += smooth * (detected.y - platePosRef.current.y)
          }

          const plate = platePosRef.current

          if (stepRef.current === 'recording') {
            if (lastYRef.current !== null && lastTimeRef.current !== null) {
              const deltaY = lastYRef.current - plate.y
              const deltaTime = (now - lastTimeRef.current) / 1000

              if (deltaTime > 0 && deltaTime < 0.3) {
                const vel = (deltaY / 35) / deltaTime
                setCurrentVelocity(Math.abs(vel))

                if (vel > 0.05) {
                  if (!repStartRef.current) repStartRef.current = plate.y
                  if (Math.abs(vel) > peakVelRef.current) {
                    peakVelRef.current = Math.abs(vel)
                  }
                }

                if (vel < -0.05 && repStartRef.current) {
                  const displacement = Math.abs(repStartRef.current - plate.y)
                  if (displacement > 35) {
                    const newRep = {
                      rep: repData.length + 1,
                      vel: parseFloat(peakVelRef.current.toFixed(2))
                    }

                    setRepData(prev => {
                      const updated = [...prev, newRep]
                      setRepCount(updated.length)
                      if (updated.length >= targetReps) {
                        setTimeout(() => finishRecording(), 100)
                      }
                      return updated
                    })

                    peakVelRef.current = 0
                    repStartRef.current = null
                  }
                }
              }
            }

            lastYRef.current = plate.y
            lastTimeRef.current = now
          }

          ctx.clearRect(0, 0, canvas.width, canvas.height)
          ctx.strokeStyle = plateColor === 'green' ? '#00FF66' : '#EF4444'
          ctx.lineWidth = 5
          ctx.beginPath()
          ctx.arc(plate.x, plate.y, 30, 0, Math.PI * 2)
          ctx.stroke()

          ctx.fillStyle = plateColor === 'green' ? '#00FF66' : '#EF4444'
          ctx.beginPath()
          ctx.arc(plate.x, plate.y, 8, 0, Math.PI * 2)
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
      videoRef.current.srcObject.getTracks().forEach(t => t.stop())
      videoRef.current.srcObject = null
    }
  }

  const handleReady = () => setStep('ready')

  const handleStartRecording = () => {
    setRepData([])
    setRepCount(0)
    peakVelRef.current = 0
    repStartRef.current = null
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
    setStep('setup')
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0D0D0E', color: '#FFF', fontFamily: 'system-ui', paddingBottom: '80px' }}>
      <div style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #1C1C1F' }}>
        <div>
          <h1 style={{ fontSize: '18px', fontWeight: '700', margin: 0 }}>{exercise}</h1>
          <p style={{ fontSize: '12px', color: '#A1A1AA', margin: '2px 0 0 0' }}>{loadKg}kg × {targetReps} reps</p>
        </div>
        <span onClick={resetAll} style={{ fontSize: '20px', cursor: 'pointer' }}>←</span>
      </div>

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
          <button onClick={startCamera} style={{ width: '100%', padding: '14px', borderRadius: '8px', border: 'none', backgroundColor: '#EF4444', color: '#FFF', fontSize: '16px', fontWeight: '800', cursor: 'pointer' }}>Start Camera →</button>
        </div>
      )}

      {(step === 'align' || step === 'ready' || step === 'recording') && (
        <div style={{ padding: '16px' }}>
          <div style={{ position: 'relative', width: '100%', aspectRatio: '9/16', backgroundColor: '#18181B', borderRadius: '12px', overflow: 'hidden' }}>
            <video ref={videoRef} autoPlay playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 10 }} />

            <div style={{ position: 'absolute', top: '12px', left: '12px', backgroundColor: plateColor === 'green' ? 'rgba(0, 255, 102, 0.2)' : 'rgba(239, 68, 68, 0.2)', border: `2px solid ${plateColor === 'green' ? '#00FF66' : '#EF4444'}`, color: plateColor === 'green' ? '#00FF66' : '#EF4444', fontSize: '13px', fontWeight: '800', padding: '8px 14px', borderRadius: '20px', zIndex: 20 }}>
              {plateColor === 'green' ? '🟢 PLATE LOCKED' : '🔴 NO PLATE'}
            </div>

            <div style={{ position: 'absolute', bottom: '16px', left: '16px', backgroundColor: 'rgba(18, 18, 20, 0.9)', borderRadius: '12px', padding: '12px 16px', border: '1px solid #27272A', zIndex: 20 }}>
              <div style={{ fontSize: '32px', fontWeight: '900', color: '#00FF66' }}>{currentVelocity.toFixed(2)}</div>
              <div style={{ fontSize: '11px', color: '#A1A1AA', marginTop: '4px' }}>m/s</div>
              <div style={{ fontSize: '13px', color: '#E4E4E7', marginTop: '6px', fontWeight: '600' }}>{repCount}/{targetReps}</div>
            </div>

            {step === 'align' && plateColor === 'green' && (
              <button onClick={handleReady} style={{ position: 'absolute', bottom: '16px', right: '16px', padding: '12px 24px', borderRadius: '8px', border: 'none', backgroundColor: '#00FF66', color: '#000', fontWeight: '800', fontSize: '14px', cursor: 'pointer', zIndex: 30 }}>READY ✓</button>
            )}

            {step === 'ready' && (
              <button onClick={handleStartRecording} style={{ position: 'absolute', bottom: '16px', right: '16px', padding: '12px 24px', borderRadius: '8px', border: 'none', backgroundColor: '#EF4444', color: '#FFF', fontWeight: '800', fontSize: '14px', cursor: 'pointer', zIndex: 30 }}>⏺ RECORD</button>
            )}

            {step === 'recording' && (
              <div style={{ position: 'absolute', top: '12px', right: '12px', backgroundColor: '#EF4444', color: '#FFF', fontSize: '12px', fontWeight: '900', padding: '6px 12px', borderRadius: '8px', zIndex: 30 }}>🔴 REC</div>
            )}
          </div>
        </div>
      )}

      {step === 'summary' && repData.length > 0 && (
        <div style={{ padding: '20px 16px' }}>
          <div style={{ fontSize: '18px', fontWeight: '800', color: '#EF4444', marginBottom: '16px' }}>✓ Set Complete</div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
            <div>
              <div style={{ fontSize: '12px', color: '#A1A1AA', marginBottom: '4px' }}>Best</div>
              <div style={{ fontSize: '24px', fontWeight: '800', color: '#FFF' }}>{Math.max(...repData.map(r => r.vel)).toFixed(2)} m/s</div>
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