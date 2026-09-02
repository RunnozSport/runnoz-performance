'use client'
import { useState, useRef, useEffect } from 'react'

export default function Page() {
  const [status, setStatus] = useState('Loading AI Models...')
  const [cameraActive, setCameraActive] = useState(false)
  const [poseReady, setPoseReady] = useState(false)
  
  // VBT Metrics State
  const [loadKg, setLoadKg] = useState(100) // Default load in kg
  const [currentVel, setCurrentVel] = useState(0)
  const [peakVel, setPeakVel] = useState(0)
  const [peakPower, setPeakPower] = useState(0)
  const [repCount, setRepCount] = useState(0)
  const [est1RM, setEst1RM] = useState(0)

  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const detectorRef = useRef(null)
  const rafRef = useRef(null)
  const isTrackingRef = useRef(false)

  // Tracking Math Variables (kept in Refs to avoid react re-renders inside the animation loop)
  const lastYRef = useRef(null)
  const lastTimeRef = useRef(null)
  const isConcentricRef = useRef(false) // Tracking rep ascent
  const repVelocitiesRef = useRef([])

  useEffect(() => {
    let isMounted = true

    const initTensorFlow = async () => {
      try {
        const tf = await import('@tensorflow/tfjs')
        await import('@tensorflow/tfjs-backend-webgl')
        const poseDetection = await import('@tensorflow-models/pose-detection')

        await tf.ready()
        await tf.setBackend('webgl')

        const detector = await poseDetection.createDetector(
          poseDetection.SupportedModels.MoveNet,
          { modelType: poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING }
        )

        if (isMounted) {
          detectorRef.current = detector
          setPoseReady(true)
          setStatus('✅ Ready - Click START')
        }
      } catch (error) {
        console.error('TFJS Load Error:', error)
        if (isMounted) setStatus('Error loading AI model: ' + error.message)
      }
    }

    initTensorFlow()

    return () => {
      isMounted = false
      isTrackingRef.current = false
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [])

  const startCamera = async () => {
    if (!poseReady) return

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
        audio: false
      })

      if (videoRef.current) {
        videoRef.current.srcObject = stream

        videoRef.current.onloadedmetadata = () => {
          videoRef.current.play()
          
          if (canvasRef.current && videoRef.current) {
            canvasRef.current.width = videoRef.current.videoWidth || 640
            canvasRef.current.height = videoRef.current.videoHeight || 480
          }

          isTrackingRef.current = true
          setCameraActive(true)
          setStatus('🎥 Tracking Barbell Velocity')
          runDetectionLoop()
        }
      }
    } catch (err) {
      setStatus('Camera error: ' + err.message)
    }
  }

  const runDetectionLoop = () => {
    const detect = async () => {
      if (!isTrackingRef.current) return

      const video = videoRef.current
      const canvas = canvasRef.current
      const detector = detectorRef.current

      if (video && canvas && detector && video.readyState >= 2) {
        const ctx = canvas.getContext('2d')
        const now = performance.now()

        if (canvas.width !== video.videoWidth && video.videoWidth > 0) {
          canvas.width = video.videoWidth
          canvas.height = video.videoHeight
        }

        try {
          const poses = await detector.estimatePoses(video)
          ctx.clearRect(0, 0, canvas.width, canvas.height)

          if (poses && poses.length > 0 && poses[0].keypoints) {
            const keypoints = poses[0].keypoints

            const shoulder = keypoints[5]
            const hip = keypoints[11]
            const leftWrist = keypoints[9]
            const rightWrist = keypoints[10]

            // 1. Calculate Pixels to Meters Ratio based on Torso
            let metersPerPixel = 0.0025 // Default fallback scale (~400px per meter)
            if (shoulder && hip && shoulder.score > 0.1 && hip.score > 0.1) {
              const torsoPx = Math.hypot(shoulder.x - hip.x, shoulder.y - hip.y)
              if (torsoPx > 10) {
                metersPerPixel = 0.50 / torsoPx
              }
            }

            // Fallback wrist position: use left wrist, right wrist, or average
            let currentY = null
            if (leftWrist && rightWrist && leftWrist.score > 0.1 && rightWrist.score > 0.1) {
              currentY = (leftWrist.y + rightWrist.y) / 2
            } else if (leftWrist && leftWrist.score > 0.1) {
              currentY = leftWrist.y
            } else if (rightWrist && rightWrist.score > 0.1) {
              currentY = rightWrist.y
            }

            // 2. Velocity Calculation Loop
            if (currentY !== null) {
              if (lastYRef.current !== null && lastTimeRef.current !== null) {
                const deltaY = lastYRef.current - currentY // Positive = Upward movement
                const deltaTime = (now - lastTimeRef.current) / 1000 // Seconds

                if (deltaTime > 0 && deltaTime < 0.2) { // Ignore frame stalls > 200ms
                  const rawVelocity = (deltaY * metersPerPixel) / deltaTime

                  // Instant raw velocity (display positive for upward movement, negative for downward)
                  const displayVel = Math.abs(rawVelocity) > 0.01 ? rawVelocity : 0
                  setCurrentVel(displayVel)

                  // Concentric Ascent Phase Tracking
                  if (rawVelocity > 0.05) { // Active upward movement threshold
                    if (!isConcentricRef.current) {
                      isConcentricRef.current = true
                    }

                    // Update Peak Velocity & Power
                    setPeakVel((prev) => {
                      const maxV = Math.max(prev, rawVelocity)
                      const force = loadKg * 9.81
                      setPeakPower(Math.round(force * maxV))

                      if (maxV > 0) {
                        const calculated1RM = Math.round(loadKg / (1.13 - 0.7 * maxV))
                        if (calculated1RM > loadKg) setEst1RM(calculated1RM)
                      }
                      return parseFloat(maxV.toFixed(2))
                    })
                  } else if (rawVelocity < -0.05 && isConcentricRef.current) {
                    // Moving back down after concentric phase -> Count Rep
                    isConcentricRef.current = false
                    setRepCount((prev) => prev + 1)
                  }
                }
              }

              lastYRef.current = currentY
              lastTimeRef.current = now

              // Draw Red Line between wrists
              if (leftWrist && rightWrist) {
                ctx.strokeStyle = '#FF5C4D'
                ctx.lineWidth = 6
                ctx.beginPath()
                ctx.moveTo(leftWrist.x, leftWrist.y)
                ctx.lineTo(rightWrist.x, rightWrist.y)
                ctx.stroke()
              }
            }

            // Draw Skeleton Lines
            const connections = [
              [5, 7], [7, 9], [6, 8], [8, 10],
              [5, 6], [5, 11], [6, 12], [11, 12],
              [11, 13], [13, 15], [12, 14], [14, 16]
            ]
            ctx.strokeStyle = '#00FF00'
            ctx.lineWidth = 3
            connections.forEach(([start, end]) => {
              const startKp = keypoints[start]
              const endKp = keypoints[end]
              if (startKp && endKp && startKp.score > 0.1 && endKp.score > 0.1) {
                ctx.beginPath()
                ctx.moveTo(startKp.x, startKp.y)
                ctx.lineTo(endKp.x, endKp.y)
                ctx.stroke()
              }
            })
          }

          // Render Live Debug Metrics HUD
          ctx.fillStyle = currentVel > 0 ? '#00FF00' : '#FF5C4D'
          ctx.font = 'bold 26px Arial'
          ctx.shadowColor = '#000000'
          ctx.shadowBlur = 4
          ctx.fillText(`VELOCITY: ${currentVel.toFixed(2)} m/s`, 20, 45)

          ctx.fillStyle = '#FFFFFF'
          ctx.font = 'bold 18px Arial'
          ctx.fillText(`PEAK VEL: ${peakVel} m/s`, 20, 75)
          ctx.fillText(`POWER: ${peakPower} W`, 20, 100)
          ctx.fillText(`EST 1RM: ${est1RM} kg`, 20, 125)
          ctx.fillText(`REPS: ${repCount}`, 20, 150)

        } catch (err) {
          console.error('Frame calculations error:', err)
        }
      }

      if (isTrackingRef.current) {
        rafRef.current = requestAnimationFrame(detect)
      }
    }

    detect()
  }
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
    setStatus('Stopped')
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0D1117', color: '#F0F6FC', padding: '20px' }}>
      <h1 style={{ fontSize: '28px', fontWeight: 'bold', marginBottom: '8px' }}>
        RUNNOZ VBT {poseReady ? '✅' : '⏳'}
      </h1>
      <p style={{ fontSize: '16px', fontWeight: 'bold', color: '#FF5C4D', marginBottom: '16px' }}>
        {status}
      </p>

      {/* Bar Weight Input Control */}
      <div style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <label style={{ fontWeight: 'bold' }}>BAR LOAD (KG):</label>
        <input 
          type="number" 
          value={loadKg} 
          onChange={(e) => setLoadKg(Number(e.target.value))}
          style={{
            padding: '8px 12px',
            borderRadius: '6px',
            border: '1px solid #FF5C4D',
            backgroundColor: '#161B22',
            color: '#FFF',
            width: '100px',
            fontSize: '16px',
            fontWeight: 'bold'
          }}
        />
      </div>

      {!cameraActive && (
        <button
          onClick={startCamera}
          disabled={!poseReady}
          style={{
            width: '100%',
            maxWidth: '600px',
            padding: '20px',
            backgroundColor: poseReady ? '#FF5C4D' : '#666',
            color: '#FFF',
            border: 'none',
            borderRadius: '8px',
            fontSize: '18px',
            fontWeight: '700',
            cursor: poseReady ? 'pointer' : 'not-allowed',
            marginBottom: '20px'
          }}
        >
          {poseReady ? '▶ START VBT TRACKING' : 'LOADING AI...'}
        </button>
      )}

      <div style={{
        position: 'relative',
        width: '100%',
        maxWidth: '600px',
        borderRadius: '8px',
        overflow: 'hidden',
        border: '3px solid #FF5C4D'
      }}>
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          style={{ width: '100%', height: 'auto', display: 'block' }}
        />
        <canvas
          ref={canvasRef}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            pointerEvents: 'none',
            zIndex: 10
          }}
        />

        {cameraActive && (
          <button
            onClick={stopCamera}
            style={{
              position: 'absolute',
              bottom: '16px',
              right: '16px',
              padding: '10px 16px',
              backgroundColor: '#FF5C4D',
              color: '#FFF',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: 'bold',
              zIndex: 20
            }}
          >
            ⏹ STOP
          </button>
        )}
      </div>
    </div>
  )
}