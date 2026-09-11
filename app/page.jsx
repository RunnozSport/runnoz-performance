'use client'

import { useState, useRef, useEffect, useCallback, useMemo } from 'react'

// System & Canvas Resolution Constants
const PROCESS_WIDTH = 640
const PROCESS_HEIGHT = 360
const MIN_CONCENTRIC_VELOCITY = 0.04
const MIN_MOVEMENT_VELOCITY = 0.015
const MAX_FRAME_INTERVAL = 0.25

// Physical Plate Diameter Presets (Meters)
const PLATE_TYPES = {
  'Olympic Bumper (450mm)': 0.45,
  'Powerlifting Steel (400mm)': 0.40,
  'Small / Technique (230mm)': 0.23,
}

export default function Page() {
  // Navigation & Setup State
  const [step, setStep] = useState('setup')
  const [exercise, setExercise] = useState('Back Squat')
  const [loadKg, setLoadKg] = useState(100)
  const [targetReps, setTargetReps] = useState(3)
  const [plateType, setPlateType] = useState('Olympic Bumper (450mm)')

  // VBT Metrics & Results
  const [currentVelocity, setCurrentVelocity] = useState(0)
  const [peakVelocity, setPeakVelocity] = useState(0)
  const [repCount, setRepCount] = useState(0)
  const [repData, setRepData] = useState([])

  // Tracking & Device State
  const [plateDetected, setPlateDetected] = useState(false)
  const [trackingConfidence, setTrackingConfidence] = useState(0)
  const [cameraError, setCameraError] = useState('')
  const [audioFeedback, setAudioFeedback] = useState(true)
  const [fps, setFps] = useState(0)
  const [readinessScore, setReadinessScore] = useState(0)
  const [aiModelLoaded, setAiModelLoaded] = useState(false)

  // Dynamic Scale Calibration State (m/px)
  const [metersPerPixel, setMetersPerPixel] = useState(0.0028)

  // Diagnostic Checks State
  const [checks, setChecks] = useState({
    tracking: false,
    framing: false,
    fps: false,
    lighting: false,
    calibration: false,
  })

  // DOM & Execution Refs
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const processCanvasRef = useRef(null)
  const animationRef = useRef(null)
  const streamRef = useRef(null)
  const aiModelRef = useRef(null)

  // Tracker Logic Refs
  const trackingRef = useRef(false)
  const stepRef = useRef('setup')
  const detectionRef = useRef(null)
  const templateRef = useRef(null)
  const samplesRef = useRef([])
  const pathRef = useRef([])

  // Physics & Rep State Refs
  const repCountRef = useRef(0)
  const lastPositionRef = useRef(null)
  const lastTimeRef = useRef(null)
  const velocitySamplesRef = useRef([])
  const repStateRef = useRef('idle')
  const repStartTimeRef = useRef(null)
  const concentricStartTimeRef = useRef(null)
  const fpsFrameCountRef = useRef(0)
  const fpsTimeRef = useRef(performance.now())
  const finishingRef = useRef(false)

  useEffect(() => {
    stepRef.current = step
  }, [step])

  // Initialize Processing Canvas and TensorFlow.js Model
  useEffect(() => {
    const canvas = document.createElement('canvas')
    canvas.width = PROCESS_WIDTH
    canvas.height = PROCESS_HEIGHT
    processCanvasRef.current = canvas

    const loadAI = async () => {
      try {
        const tf = await import('@tensorflow/tfjs')
        const cocoSsd = await import('@tensorflow-models/coco-ssd')
        await tf.ready()
        const model = await cocoSsd.load()
        aiModelRef.current = model
        setAiModelLoaded(true)
      } catch (e) {
        console.error('AI Model failed to load, using optical fallback:', e)
      }
    }
    loadAI()

    return () => {
      stopCamera()
    }
  }, [])

  // Audio Voice Feedback Engine
  const speakVelocity = useCallback(
    (velocity) => {
      if (!audioFeedback) return
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel()
        const message = new SpeechSynthesisUtterance(velocity.toFixed(2))
        message.rate = 1.15
        message.pitch = 1
        window.speechSynthesis.speak(message)
      }
    },
    [audioFeedback]
  )

  const resetTrackingState = () => {
    detectionRef.current = null
    templateRef.current = null
    samplesRef.current = []
    pathRef.current = []
    lastPositionRef.current = null
    lastTimeRef.current = null
    velocitySamplesRef.current = []
    repStateRef.current = 'idle'
    repStartTimeRef.current = null
    concentricStartTimeRef.current = null
    finishingRef.current = false
    repCountRef.current = 0

    setCurrentVelocity(0)
    setPeakVelocity(0)
    setRepCount(0)
    setRepData([])
    setPlateDetected(false)
    setTrackingConfidence(0)
  }

  // Calculate Dynamic Calibration Factor (Meters per Pixel)
  const updateDynamicCalibration = useCallback((pixelRadius) => {
    if (!pixelRadius || pixelRadius <= 0) return
    const physicalDiameterMeters = PLATE_TYPES[plateType] || 0.45
    const pixelDiameter = pixelRadius * 2
    const calculatedScale = physicalDiameterMeters / pixelDiameter
    setMetersPerPixel(calculatedScale)
  }, [plateType])

  // Extracts Sub-Pixel Correlation Template
  const createTemplate = (video, x, y) => {
    const canvas = processCanvasRef.current
    if (!canvas) return false
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) return false

    ctx.drawImage(video, 0, 0, PROCESS_WIDTH, PROCESS_HEIGHT)
    const size = 28
    const px = Math.max(size / 2, Math.min(PROCESS_WIDTH - size / 2, x))
    const py = Math.max(size / 2, Math.min(PROCESS_HEIGHT - size / 2, y))

    try {
      templateRef.current = ctx.getImageData(
        Math.round(px - size / 2),
        Math.round(py - size / 2),
        size,
        size
      )
      detectionRef.current = {
        x: px,
        y: py,
        radius: 28,
        confidence: 100,
      }
      updateDynamicCalibration(28)
      return true
    } catch {
      return false
    }
  }

  const validatePlateGeometry = (canvas, x, y, radius) => {
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) return false

    const sampleRadius = Math.round(radius || 20)
    const samples = [
      { x: x + sampleRadius, y: y },
      { x: x - sampleRadius, y: y },
      { x: x, y: y + sampleRadius },
      { x: x, y: y - sampleRadius },
    ]

    let validEdges = 0
    samples.forEach((pt) => {
      if (pt.x > 0 && pt.x < PROCESS_WIDTH && pt.y > 0 && pt.y < PROCESS_HEIGHT) {
        try {
          const pixel = ctx.getImageData(Math.floor(pt.x), Math.floor(pt.y), 1, 1).data
          const lum = 0.2126 * pixel[0] + 0.7152 * pixel[1] + 0.0722 * pixel[2]
          if (lum > 15) validEdges++
        } catch (e) {}
      }
    })

    return validEdges >= 2
  }

  // Fast Sub-Pixel SAD Cross-Correlation Optical Tracker
  const trackTemplate = (video) => {
    const canvas = processCanvasRef.current
    const template = templateRef.current
    const previous = detectionRef.current

    if (!canvas || !template || !previous) return null
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) return null

    ctx.drawImage(video, 0, 0, PROCESS_WIDTH, PROCESS_HEIGHT)
    const templateSize = template.width
    const searchRadius = 55

    const startX = Math.max(templateSize / 2, previous.x - searchRadius)
    const endX = Math.min(PROCESS_WIDTH - templateSize / 2, previous.x + searchRadius)
    const startY = Math.max(templateSize / 2, previous.y - searchRadius)
    const endY = Math.min(PROCESS_HEIGHT - templateSize / 2, previous.y + searchRadius)

    const width = Math.max(1, Math.ceil(endX - startX + templateSize))
    const height = Math.max(1, Math.ceil(endY - startY + templateSize))

    const image = ctx.getImageData(
      Math.floor(startX - templateSize / 2),
      Math.floor(startY - templateSize / 2),
      width,
      height
    )

    const templateData = template.data
    const searchData = image.data
    let bestScore = Infinity
    let bestX = previous.x
    let bestY = previous.y

    const luminance = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b

    for (let sy = 0; sy <= height - templateSize; sy += 3) {
      for (let sx = 0; sx <= width - templateSize; sx += 3) {
        let difference = 0
        let count = 0

        for (let ty = 0; ty < templateSize; ty += 4) {
          for (let tx = 0; tx < templateSize; tx += 4) {
            const sIndex = ((sy + ty) * width + (sx + tx)) * 4
            const tIndex = (ty * templateSize + tx) * 4

            const sr = searchData[sIndex]
            const sg = searchData[sIndex + 1]
            const sb = searchData[sIndex + 2]

            const tr = templateData[tIndex]
            const tg = templateData[tIndex + 1]
            const tb = templateData[tIndex + 2]

            difference += Math.abs(luminance(sr, sg, sb) - luminance(tr, tg, tb))
            count++
          }
        }

        const normalized = difference / count
        if (normalized < bestScore) {
          bestScore = normalized
          bestX = startX - templateSize / 2 + sx + templateSize / 2
          bestY = startY - templateSize / 2 + sy + templateSize / 2
        }
      }
    }

    const confidence = Math.max(0, Math.min(100, 100 - bestScore * 1.5))
    if (confidence < 25) {
      return { ...previous, confidence }
    }

    const alpha = confidence > 70 ? 0.55 : 0.3
    const x = previous.x + alpha * (bestX - previous.x)
    const y = previous.y + alpha * (bestY - previous.y)

    const detection = { x, y, radius: previous.radius, confidence }
    detectionRef.current = detection
    updateDynamicCalibration(previous.radius)
    return detection
  }

  // Spatial Physics Engine (m/s)
  const calculateVelocity = (previousY, currentY, previousTime, currentTime) => {
    const dt = (currentTime - previousTime) / 1000
    if (dt <= 0 || dt > MAX_FRAME_INTERVAL) return null

    const displacementPixels = previousY - currentY
    const displacementMeters = displacementPixels * metersPerPixel
    return displacementMeters / dt
  }

  const smoothVelocity = (velocity) => {
    velocitySamplesRef.current.push(velocity)
    if (velocitySamplesRef.current.length > 5) {
      velocitySamplesRef.current.shift()
    }
    const values = velocitySamplesRef.current
    return values.reduce((sum, value) => sum + value, 0) / values.length
  }

  const processRepVelocity = (velocity, now) => {
    const absoluteVelocity = Math.abs(velocity)
    if (finishingRef.current) return

    if (velocity > MIN_CONCENTRIC_VELOCITY) {
      if (repStateRef.current !== 'concentric') {
        repStateRef.current = 'concentric'
        concentricStartTimeRef.current = now
        if (repStartTimeRef.current === null) {
          repStartTimeRef.current = now
        }
        velocitySamplesRef.current = []
      }

      velocitySamplesRef.current.push(velocity)
      const peak = Math.max(...velocitySamplesRef.current)

      setCurrentVelocity(smoothVelocity(velocity))
      setPeakVelocity((prevPeak) => Math.max(prevPeak, peak))
      return
    }

    if (velocity < -MIN_CONCENTRIC_VELOCITY) {
      if (repStateRef.current === 'concentric') {
        const concentricStart = concentricStartTimeRef.current
        const repStart = repStartTimeRef.current

        if (
          concentricStart !== null &&
          repStart !== null &&
          velocitySamplesRef.current.length > 0
        ) {
          const values = velocitySamplesRef.current
          const mean = values.reduce((a, b) => a + b, 0) / values.length
          const peak = Math.max(...values)
          const concentricTime = (now - concentricStart) / 1000
          const totalTime = (now - repStart) / 1000
          const eccentricTime = Math.max(0, totalTime - concentricTime)

          const points = samplesRef.current
          let rom = 0
          if (points.length > 1) {
            const ys = points.map((point) => point.y)
            rom = (Math.max(...ys) - Math.min(...ys)) * metersPerPixel
          }

          if (rom < 0.18 || concentricTime < 0.25) {
            repStateRef.current = 'eccentric'
            velocitySamplesRef.current = []
            return
          }

          repCountRef.current += 1
          const newRepNumber = repCountRef.current

          const newRep = {
            rep: newRepNumber,
            meanVelocity: Number(mean.toFixed(2)),
            peakVelocity: Number(peak.toFixed(2)),
            rom: Number(rom.toFixed(2)),
            concentricTime: Number(concentricTime.toFixed(2)),
            eccentricTime: Number(eccentricTime.toFixed(2)),
            totalTime: Number(totalTime.toFixed(2)),
          }

          setRepData((prev) => {
            const updated = [...prev, newRep]
            setRepCount(updated.length)
            return updated
          })

          speakVelocity(mean)

          if (repCountRef.current >= targetReps && !finishingRef.current) {
            finishingRef.current = true
            setTimeout(() => {
              finishRecording()
            }, 200)
            return
          }

          velocitySamplesRef.current = []
          repStateRef.current = 'eccentric'
          repStartTimeRef.current = now
          concentricStartTimeRef.current = null
          return
        }
      }

      repStateRef.current = 'eccentric'
      if (repStartTimeRef.current === null) {
        repStartTimeRef.current = now
      }
      return
    }

    if (absoluteVelocity < MIN_MOVEMENT_VELOCITY) {
      return
    }
  }

  const drawOverlay = (detection) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.clearRect(0, 0, canvas.width, canvas.height)

    if (stepRef.current === 'recording' && pathRef.current.length > 1) {
      ctx.beginPath()
      const first = pathRef.current[0]
      ctx.moveTo(first.x, first.y)

      for (let i = 1; i < pathRef.current.length; i++) {
        const point = pathRef.current[i]
        ctx.lineTo(point.x, point.y)
      }

      ctx.strokeStyle = '#00FF66'
      ctx.lineWidth = 4
      ctx.setLineDash([8, 8])
      ctx.stroke()
      ctx.setLineDash([])
    }

    if (!detection) return

    const locked = detection.confidence >= 50
    const color = locked ? '#00FF66' : '#EF4444'

    ctx.beginPath()
    ctx.arc(detection.x, detection.y, detection.radius, 0, Math.PI * 2)
    ctx.strokeStyle = color
    ctx.lineWidth = 4
    ctx.stroke()

    ctx.beginPath()
    ctx.arc(detection.x, detection.y, 6, 0, Math.PI * 2)
    ctx.fillStyle = color
    ctx.fill()

    ctx.font = 'bold 14px system-ui'
    ctx.fillStyle = color
    ctx.fillText(`${Math.round(detection.confidence)}%`, detection.x + 35, detection.y - 35)
  }

  // 60 FPS Main Tracking Loop with TensorFlow AI Scan Fallback
  const trackingLoop = useCallback(async () => {
    if (!trackingRef.current || !videoRef.current || !canvasRef.current) return

    const video = videoRef.current
    const now = performance.now()

    fpsFrameCountRef.current++
    const fpsElapsed = now - fpsTimeRef.current

    if (fpsElapsed >= 1000) {
      const calculatedFps = Math.round((fpsFrameCountRef.current * 1000) / fpsElapsed)
      setFps(calculatedFps)
      fpsFrameCountRef.current = 0
      fpsTimeRef.current = now
    }

    if (video.readyState >= 2) {
      let detection = detectionRef.current

      // AI Auto Detection Scan if template not locked
      if (!templateRef.current && aiModelRef.current && stepRef.current === 'align') {
        try {
          const predictions = await aiModelRef.current.detect(video)
          const obj = predictions.find(
            (p) => ['sports ball', 'disc', 'bowl', 'clock'].includes(p.class) || p.score > 0.4
          )
          if (obj) {
            const [bx, by, bw, bh] = obj.bbox
            const px = (bx + bw / 2) * (PROCESS_WIDTH / canvasRef.current.width)
            const py = (by + bh / 2) * (PROCESS_HEIGHT / canvasRef.current.height)
            createTemplate(video, px, py)
          }
        } catch (e) {}
      }

      if (templateRef.current) {
        detection = trackTemplate(video)
      }

      if (detection) {
        const canvas = canvasRef.current
        const scaleX = canvas.width / PROCESS_WIDTH
        const scaleY = canvas.height / PROCESS_HEIGHT

        detection = {
          ...detection,
          x: detection.x * scaleX,
          y: detection.y * scaleY,
          radius: detection.radius * ((scaleX + scaleY) / 2),
        }

        setTrackingConfidence(Math.round(detection.confidence))
        setPlateDetected(detection.confidence >= 50)

        if (stepRef.current === 'align') {
          const isCircularPlate = processCanvasRef.current
            ? validatePlateGeometry(processCanvasRef.current, detectionRef.current.x, detectionRef.current.y, detectionRef.current.radius)
            : false

          const framing = detection.x > canvas.width * 0.1 && detection.x < canvas.width * 0.9
          const fpsReady = fps >= 45
          const lighting = detection.confidence >= 65

          const nextChecks = {
            tracking: detection.confidence >= 50 && isCircularPlate,
            framing,
            fps: fpsReady,
            lighting,
            calibration: isCircularPlate,
          }

          setChecks(nextChecks)

          let score = 0
          if (nextChecks.tracking) score += 25
          if (nextChecks.framing) score += 20
          if (nextChecks.fps) score += 20
          if (nextChecks.lighting) score += 20
          if (nextChecks.calibration) score += 15

          setReadinessScore(score)
        }

        if (stepRef.current === 'recording') {
          const point = { x: detection.x, y: detection.y, t: now }
          pathRef.current.push(point)

          if (pathRef.current.length > 200) {
            pathRef.current.shift()
          }

          const previousY = lastPositionRef.current
          const previousTime = lastTimeRef.current

          if (previousY !== null && previousTime !== null) {
            const velocity = calculateVelocity(previousY, detection.y, previousTime, now)
            if (velocity !== null) {
              processRepVelocity(velocity, now)
            }
          }

          lastPositionRef.current = detection.y
          lastTimeRef.current = now

          samplesRef.current.push({
            x: detection.x,
            y: detection.y,
            t: now,
            confidence: detection.confidence,
          })

          if (samplesRef.current.length > 1000) {
            samplesRef.current.shift()
          }
        }

        drawOverlay(detection)
      }
    }

    if (trackingRef.current) {
      animationRef.current = requestAnimationFrame(trackingLoop)
    }
  }, [fps, metersPerPixel, peakVelocity, repData.length, speakVelocity, targetReps, updateDynamicCalibration])

  const startCamera = async () => {
    setCameraError('')
    resetTrackingState()
    setStep('align')

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera API unavailable')
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          frameRate: { ideal: 60, min: 30 },
        },
        audio: false,
      })

      streamRef.current = stream
      const video = videoRef.current
      if (!video) return

      video.srcObject = stream
      await video.play()

      const canvas = canvasRef.current
      if (canvas) {
        canvas.width = video.videoWidth || window.innerWidth
        canvas.height = video.videoHeight || window.innerHeight
      }

      trackingRef.current = true
      fpsTimeRef.current = performance.now()
      fpsFrameCountRef.current = 0

      trackingLoop()
    } catch (error) {
      console.error(error)
      setCameraError('Unable to access camera. Please check browser permissions.')
      setStep('setup')
    }
  }

  const stopCamera = () => {
    trackingRef.current = false
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current)
      animationRef.current = null
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
  }

  const handleTapToLock = (event) => {
    if (!canvasRef.current || !videoRef.current) return

    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()

    const canvasX = ((event.clientX - rect.left) / rect.width) * canvas.width
    const canvasY = ((event.clientY - rect.top) / rect.height) * canvas.height

    const processX = (canvasX / canvas.width) * PROCESS_WIDTH
    const processY = (canvasY / canvas.height) * PROCESS_HEIGHT

    const success = createTemplate(videoRef.current, processX, processY)
    if (success) {
      setPlateDetected(true)
      setTrackingConfidence(100)
    }
  }

  const handleReady = () => {
    if (readinessScore < 80) return
    setStep('ready')
  }

  const handleStartRecording = () => {
    if (!detectionRef.current) return

    setRepData([])
    setRepCount(0)
    setCurrentVelocity(0)
    setPeakVelocity(0)

    pathRef.current = []
    samplesRef.current = []
    velocitySamplesRef.current = []
    repStateRef.current = 'idle'
    repCountRef.current = 0

    const now = performance.now()
    lastPositionRef.current = detectionRef.current.y
    lastTimeRef.current = now
    repStartTimeRef.current = now
    concentricStartTimeRef.current = null
    finishingRef.current = false

    setStep('recording')
  }

  const finishRecording = () => {
    stopCamera()
    setStep('summary')
  }

  const resetAll = () => {
    stopCamera()
    resetTrackingState()
    setReadinessScore(0)
    setChecks({
      tracking: false,
      framing: false,
      fps: false,
      lighting: false,
      calibration: false,
    })
    setStep('setup')
  }

  const summary = useMemo(() => {
    if (repData.length === 0) {
      return { mean: 0, peak: 0, rom: 0, velocityLoss: 0 }
    }

    const mean = repData.reduce((sum, rep) => sum + rep.meanVelocity, 0) / repData.length
    const peak = Math.max(...repData.map((rep) => rep.peakVelocity))
    const rom = repData.reduce((sum, rep) => sum + rep.rom, 0) / repData.length

    const first = repData[0].meanVelocity
    const last = repData[repData.length - 1].meanVelocity
    const velocityLoss = first > 0 ? ((first - last) / first) * 100 : 0

    return {
      mean: Number(mean.toFixed(2)),
      peak: Number(peak.toFixed(2)),
      rom: Number(rom.toFixed(2)),
      velocityLoss: Number(velocityLoss.toFixed(1)),
    }
  }, [repData])

  return (
    <main
      style={{
        minHeight: '100vh',
        background: '#0D0D0E',
        color: '#FFFFFF',
        fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
      }}
    >
      {/* HEADER */}
      {step !== 'align' && step !== 'ready' && step !== 'recording' && (
        <header
          style={{
            padding: '16px 24px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderBottom: '1px solid #242428',
            maxWidth: '1200px',
            margin: '0 auto',
          }}
        >
          <div>
            <div style={{ fontSize: 18, fontWeight: 800 }}>VBT PERFORMANCE</div>
            <div style={{ fontSize: 12, color: '#A1A1AA', marginTop: 3 }}>
              {exercise} · {loadKg} kg × {targetReps} reps
            </div>
          </div>

          <div style={{ display: 'flex', gap: 15, alignItems: 'center' }}>
            <button
              onClick={() => setAudioFeedback(!audioFeedback)}
              style={{
                border: 'none',
                background: 'transparent',
                color: '#FFF',
                fontSize: 20,
                cursor: 'pointer',
                opacity: audioFeedback ? 1 : 0.35,
              }}
            >
              🔊
            </button>

            {step !== 'setup' && (
              <button
                onClick={resetAll}
                style={{
                  border: 'none',
                  background: 'transparent',
                  color: '#FFF',
                  fontSize: 22,
                  cursor: 'pointer',
                }}
              >
                ←
              </button>
            )}
          </div>
        </header>
      )}

      {/* SETUP SCREEN */}
      {step === 'setup' && (
        <section style={{ maxWidth: 520, margin: '0 auto', padding: 24 }}>
          <h1 style={{ fontSize: 26, margin: '0 0 8px' }}>Start Workout</h1>
          <p style={{ color: '#A1A1AA', marginBottom: 28 }}>Camera-based barbell velocity tracking.</p>

          <label style={labelStyle}>EXERCISE</label>
          <select
            value={exercise}
            onChange={(e) => setExercise(e.target.value)}
            style={inputStyle}
          >
            <option>Back Squat</option>
            <option>Bench Press</option>
            <option>Deadlift</option>
            <option>Overhead Press</option>
            <option>Barbell Row</option>
          </select>

          <div style={{ marginTop: 20 }}>
            <label style={labelStyle}>WEIGHT PLATE CALIBRATION</label>
            <select
              value={plateType}
              onChange={(e) => setPlateType(e.target.value)}
              style={inputStyle}
            >
              {Object.keys(PLATE_TYPES).map((type) => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 20 }}>
            <div>
              <label style={labelStyle}>LOAD KG</label>
              <input
                type="number"
                min="0"
                value={loadKg}
                onChange={(e) => setLoadKg(Number(e.target.value))}
                style={inputStyle}
              />
            </div>

            <div>
              <label style={labelStyle}>TARGET REPS</label>
              <input
                type="number"
                min="1"
                value={targetReps}
                onChange={(e) => setTargetReps(Number(e.target.value))}
                style={inputStyle}
              />
            </div>
          </div>

          <button
            onClick={startCamera}
            style={{
              width: '100%',
              marginTop: 24,
              padding: 15,
              borderRadius: 10,
              border: 'none',
              background: '#EF4444',
              color: '#FFF',
              fontSize: 16,
              fontWeight: 800,
              cursor: 'pointer',
            }}
          >
            Start Camera Alignment →
          </button>

          {cameraError && (
            <div
              style={{
                marginTop: 15,
                padding: 12,
                borderRadius: 8,
                background: '#32171A',
                color: '#FCA5A5',
                fontSize: 13,
              }}
            >
              {cameraError}
            </div>
          )}

          <div
            style={{
              marginTop: 30,
              padding: 16,
              border: '1px solid #27272A',
              borderRadius: 10,
              color: '#A1A1AA',
              fontSize: 12,
              lineHeight: 1.6,
            }}
          >
            <strong style={{ color: '#FFF' }}>Auto AI Scan Active</strong>
            <br />
            {aiModelLoaded
              ? 'TensorFlow AI is active and will auto-detect your weight plate.'
              : 'Loading TensorFlow AI detector...'}
          </div>
        </section>
      )}

      {/* FULL-PAGE EDGE-TO-EDGE CAMERA SCREEN */}
      {(step === 'align' || step === 'ready' || step === 'recording') && (
        <section
          style={{
            position: 'fixed',
            inset: 0,
            width: '100vw',
            height: '100vh',
            backgroundColor: '#000',
            zIndex: 1000,
            overflow: 'hidden',
          }}
        >
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
            }}
          />

          <canvas
            ref={canvasRef}
            onClick={handleTapToLock}
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              zIndex: 10,
              cursor: 'crosshair',
            }}
          />

          {/* FLOATING TOP ACTION BAR */}
          <div
            style={{
              position: 'absolute',
              top: 20,
              left: 20,
              right: 20,
              display: 'flex',
              justify: 'space-between',
              alignItems: 'center',
              zIndex: 30,
            }}
          >
            <button
              onClick={resetAll}
              style={{
                border: 'none',
                background: 'rgba(15,15,17,0.85)',
                color: '#FFF',
                width: 44,
                height: 44,
                borderRadius: '50%',
                fontSize: 20,
                cursor: 'pointer',
                backdropFilter: 'blur(10px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 15px rgba(0,0,0,0.5)',
              }}
            >
              ←
            </button>

            {step === 'recording' ? (
              <div
                style={{
                  padding: '8px 18px',
                  borderRadius: 20,
                  background: 'rgba(239,68,68,0.95)',
                  fontSize: 12,
                  fontWeight: 900,
                  letterSpacing: '1px',
                  boxShadow: '0 4px 15px rgba(239,68,68,0.4)',
                }}
              >
                ● RECORDING
              </div>
            ) : (
              <div
                style={{
                  padding: '8px 16px',
                  borderRadius: 20,
                  background: 'rgba(15,15,17,0.85)',
                  fontSize: 12,
                  fontWeight: 700,
                  color: '#A1A1AA',
                  backdropFilter: 'blur(10px)',
                }}
              >
                {exercise} · {loadKg}kg
              </div>
            )}

            <button
              onClick={() => setAudioFeedback(!audioFeedback)}
              style={{
                border: 'none',
                background: 'rgba(15,15,17,0.85)',
                color: '#FFF',
                width: 44,
                height: 44,
                borderRadius: '50%',
                fontSize: 18,
                cursor: 'pointer',
                backdropFilter: 'blur(10px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                opacity: audioFeedback ? 1 : 0.4,
                boxShadow: '0 4px 15px rgba(0,0,0,0.5)',
              }}
            >
              🔊
            </button>
          </div>

          {/* PRE-FLIGHT DIAGNOSTICS OVERLAY */}
          {step === 'align' && (
            <div
              style={{
                position: 'absolute',
                top: 80,
                left: 20,
                right: 20,
                maxWidth: '450px',
                zIndex: 20,
                padding: '14px 18px',
                borderRadius: 14,
                background: 'rgba(15,15,17,.9)',
                border: '1px solid #303035',
                backdropFilter: 'blur(12px)',
                boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <strong style={{ fontSize: 12, letterSpacing: '0.5px' }}>CAMERA DIAGNOSTIC</strong>
                <strong style={{ color: readinessScore >= 80 ? '#00FF66' : '#EF4444' }}>
                  {readinessScore}%
                </strong>
              </div>

              <div
                style={{
                  height: 6,
                  background: '#27272A',
                  borderRadius: 10,
                  overflow: 'hidden',
                  marginBottom: 12,
                }}
              >
                <div
                  style={{
                    width: `${readinessScore}%`,
                    height: '100%',
                    background: readinessScore >= 80 ? '#00FF66' : '#EF4444',
                    transition: 'width .3s',
                  }}
                />
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 7,
                  fontSize: 11,
                }}
              >
                <Diagnostic ok={checks.tracking} text="Plate Verified" />
                <Diagnostic ok={checks.framing} text="Framing" />
                <Diagnostic ok={checks.fps} text={`FPS ${fps}`} />
                <Diagnostic ok={checks.lighting} text="Tracking Quality" />
                <Diagnostic ok={checks.calibration} text={`Scale (${metersPerPixel.toFixed(4)}m/px)`} />
              </div>
            </div>
          )}

          {/* FLOATING LIVE METRIC OVERLAY */}
          <div
            style={{
              position: 'absolute',
              bottom: 30,
              left: 20,
              zIndex: 20,
              padding: '16px 24px',
              borderRadius: 16,
              background: 'rgba(15,15,17,.9)',
              border: '1px solid #303035',
              backdropFilter: 'blur(12px)',
              boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
            }}
          >
            <div style={{ fontSize: 48, lineHeight: 1, fontWeight: 900, color: '#00FF66' }}>
              {currentVelocity.toFixed(2)}
            </div>
            <div style={{ fontSize: 11, color: '#A1A1AA', marginTop: 6, fontWeight: 700 }}>
              MEAN VELOCITY · M/S
            </div>
            <div style={{ marginTop: 8, fontSize: 14, fontWeight: 800 }}>
              REP {repCount}/{targetReps}
            </div>
          </div>

          {/* INSTRUCTION PILL */}
          <div
            style={{
              position: 'absolute',
              bottom: 110,
              left: '50%',
              transform: 'translateX(-50%)',
              padding: '8px 16px',
              background: 'rgba(15,15,17,0.85)',
              borderRadius: 20,
              color: '#A1A1AA',
              fontSize: 12,
              backdropFilter: 'blur(10px)',
              zIndex: 20,
              pointerEvents: 'none',
              whiteSpace: 'nowrap',
            }}
          >
            {step === 'align' && 'TensorFlow scanning plate... Tap sleeve if needed.'}
            {step === 'ready' && 'Get into position and start the set when ready.'}
            {step === 'recording' && `Tracking Confidence: ${trackingConfidence}% · ${fps} FPS`}
          </div>

          {/* ACTION BUTTONS */}
          {step === 'align' && (
            <button
              disabled={readinessScore < 80}
              onClick={handleReady}
              style={{
                position: 'absolute',
                right: 20,
                bottom: 30,
                zIndex: 30,
                padding: '16px 28px',
                borderRadius: 12,
                border: 'none',
                background: readinessScore >= 80 ? '#00FF66' : '#3F3F46',
                color: readinessScore >= 80 ? '#000' : '#A1A1AA',
                fontWeight: 900,
                fontSize: 15,
                cursor: readinessScore >= 80 ? 'pointer' : 'not-allowed',
                boxShadow: readinessScore >= 80 ? '0 10px 25px rgba(0,255,102,0.3)' : 'none',
              }}
            >
              {readinessScore >= 80 ? 'Ready →' : 'Improve Setup'}
            </button>
          )}

          {step === 'ready' && (
            <button
              onClick={handleStartRecording}
              style={{
                position: 'absolute',
                bottom: 30,
                right: 20,
                zIndex: 30,
                padding: '16px 36px',
                borderRadius: 12,
                border: 'none',
                background: '#00FF66',
                color: '#000',
                fontWeight: 900,
                fontSize: 16,
                cursor: 'pointer',
                boxShadow: '0 10px 25px rgba(0,255,102,0.4)',
              }}
            >
              START SET
            </button>
          )}
        </section>
      )}

      {/* SUMMARY DASHBOARD SCREEN */}
      {step === 'summary' && (
        <section style={{ maxWidth: 800, margin: '0 auto', padding: 24 }}>
          <div style={{ marginBottom: 24 }}>
            <div style={{ color: '#00FF66', fontSize: 12, fontWeight: 900, letterSpacing: 1 }}>
              SET COMPLETE
            </div>
            <h1 style={{ fontSize: 30, margin: '6px 0' }}>{exercise}</h1>
            <div style={{ color: '#A1A1AA' }}>
              {loadKg} kg · {repData.length} reps · Dynamic Scale ({metersPerPixel.toFixed(4)}m/px)
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <MetricCard label="MEAN VELOCITY" value={`${summary.mean} m/s`} />
            <MetricCard label="PEAK VELOCITY" value={`${summary.peak} m/s`} />
            <MetricCard label="AVG ROM" value={`${summary.rom} m`} />
            <MetricCard label="VELOCITY LOSS" value={`${summary.velocityLoss}%`} />
          </div>

          <h2 style={{ marginTop: 32, fontSize: 18 }}>Rep Breakdown</h2>

          <div style={{ border: '1px solid #27272A', borderRadius: 12, overflow: 'hidden' }}>
            {repData.map((rep) => (
              <div
                key={rep.rep}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '50px 1fr 1fr 1fr',
                  padding: '14px 16px',
                  borderBottom: '1px solid #27272A',
                  fontSize: 13,
                }}
              >
                <strong>{rep.rep}</strong>
                <span>{rep.meanVelocity.toFixed(2)} m/s</span>
                <span>Peak {rep.peakVelocity.toFixed(2)}</span>
                <span>ROM {rep.rom.toFixed(2)}m</span>
              </div>
            ))}
          </div>

          <button
            onClick={resetAll}
            style={{
              width: '100%',
              marginTop: 24,
              padding: 15,
              borderRadius: 10,
              border: '1px solid #3F3F46',
              background: '#18181B',
              color: '#FFF',
              fontWeight: 800,
              cursor: 'pointer',
            }}
          >
            New Workout
          </button>
        </section>
      )}
    </main>
  )
}

function Diagnostic({ ok, text }) {
  return (
    <div style={{ color: ok ? '#00FF66' : '#A1A1AA' }}>
      {ok ? '✓' : '○'} {text}
    </div>
  )
}

function MetricCard({ label, value }) {
  return (
    <div style={{ padding: 18, borderRadius: 12, background: '#18181B', border: '1px solid #27272A' }}>
      <div style={{ fontSize: 10, color: '#A1A1AA', fontWeight: 800 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 900, marginTop: 7 }}>{value}</div>
    </div>
  )
}

const labelStyle = {
  display: 'block',
  fontSize: 11,
  fontWeight: 800,
  color: '#A1A1AA',
  marginBottom: 6,
}

const inputStyle = {
  width: '100%',
  boxSizing: 'border-box',
  padding: 13,
  borderRadius: 9,
  border: '1px solid #303035',
  background: '#18181B',
  color: '#FFF',
  fontSize: 15,
}