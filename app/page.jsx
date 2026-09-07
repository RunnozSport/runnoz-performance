'use client'
import { useState, useRef, useEffect } from 'react'

export default function Page() {
  // Simple states: detect plate → record velocity
  const [step, setStep] = useState('setup')
  const [exercise, setExercise] = useState('Back Squat')
  const [loadKg, setLoadKg] = useState(100)
  const [targetReps, setTargetReps] = useState(3)
  
  // Detection & Recording
  const [isPlateDetected, setIsPlateDetected] = useState(false)
  const [plateColor, setPlateColor] = useState('red') // 'red' | 'green'
  const [currentVelocity, setCurrentVelocity] = useState(0)
  const [repCount, setRepCount] = useState(0)
  const [repData, setRepData] = useState([])
  const [cameraError, setCameraError] = useState('')

  // Refs for tracking
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const procCanvasRef = useRef(null)
  const rafRef = useRef(null)
  const isTrackingRef = useRef(false)
  const stepRef = useRef('setup')

  // Barbell position tracking
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

  // Simple plate detection - find bright edges (weight plate)
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

    // Find strongest edge (weight plate hub)
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

    return {
      x: centerX * scaleX,
      y: centerY * scaleY,
      strength: maxEdge
    }
  }

  // Main tracking loop
  const runTracker = () => {
    const track = () => {
      if (!isTrackingRef.current || !videoRef.current || !canvasRef.current) return

      const video = videoRef.current
      const canvas = canvasRef.current
      const ctx = canvas.getContext('2d')
      const now = performance.now()

      if (video.readyState >= 2) {
        const detected = detectPlate(video, canvas.width, canvas.height)
        
        // RED if no plate, GREEN if detected
        const isLocked = detected.strength > 20
        setPlateColor(isLocked ? 'green' : 'red')
        setIsPlateDetected(isLocked)

        if (isLocked) {
          // Smooth position
          if (!platePosRef.current) {
            platePosRef.current = { x: detected.x, y: detected.y }
          } else {
            const smooth = 0.5
            platePosRef.current.x += smooth * (detected.x - platePosRef.current.x)
            platePosRef.current.y += smooth * (detected.y - platePosRef.current.y)
          }

          const plate = platePosRef.current

          // RECORDING MODE - Track barbell displacement
          if (stepRef.current === 'recording') {
            if (lastYRef.current !== null && lastTimeRef.current !== null) {
              const deltaY = lastYRef.current - plate.y // Up = positive
              const deltaTime = (now - lastTimeRef.current) / 1000

              if (deltaTime > 0 && deltaTime < 0.3) {
                // Simple velocity = displacement / time
                const vel = (deltaY / 35) / deltaTime // 35 pixels ≈ 10cm calibration

                setCurrentVelocity(Math.abs(vel))

                // Track peak velocity during rep
                if (vel > 0.05) {
                  if (!repStartRef.current) repStartRef.current = plate.y
                  if (Math.abs(vel) > peakVelRef.current) {
                    peakVelRef.current = Math.abs(vel)
                  }
                }

                // Rep complete when bar returns down (10cm+ movement)
                if (vel < -0.05 && repStartRef.current) {
                  const displacement = Math.abs(repStartRef.current - plate.y)
                  
                  // Only count if moved 10cm+ (35 pixels)
                  if (displacement > 35) {
                    const newRep = {
                      rep: repData.length + 1,
                      vel: parseFloat(peakVelRef.current.toFixed(2))
                    }
                    
                    setRepData(prev => {
                      const updated = [...prev, newRep]
                      setRepCount(updated.length)
                      
                      // Auto-finish when target reps reached
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

          // Draw detection circle
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
      setCameraError('Camera access denied: ' + err.message)
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

  const handleReady = () => {
    setStep('ready')
  }

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
      {/* Header */}
      <div style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #1C1C1F' }}>
        <div>
          <h1 style={{ fontSize: '18px', fontWeight: '700', margin: 0 }}>{exercise}</h1>
          <p style={{ fontSize: '12px', color: '#A1A1AA', margin: '2px 0 0 0' }}>{loadKg}kg × {targetReps} reps</p>
        </div>
        <span onClick={resetAll} style={{ fontSize: '20px', cursor: 'pointer' }}>←</span>
      </div>

      {/* SETUP */}
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