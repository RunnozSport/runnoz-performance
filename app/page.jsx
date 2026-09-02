'use client'
import { useState, useRef, useEffect } from 'react'

export default function Page() {
  const [status, setStatus] = useState('Loading AI Models...')
  const [cameraActive, setCameraActive] = useState(false)
  const [poseReady, setPoseReady] = useState(false)
  const [loadKg, setLoadKg] = useState(100)

  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const detectorRef = useRef(null)
  const rafRef = useRef(null)
  const isTrackingRef = useRef(false)

  // Synchronous Tracking Refs (Fixes zero calculations)
  const lastYRef = useRef(null)
  const lastTimeRef = useRef(null)
  const isConcentricRef = useRef(false)
  
  // Real-time Metric Refs
  const currentVelRef = useRef(0)
  const peakVelRef = useRef(0)
  const peakPowerRef = useRef(0)
  const repCountRef = useRef(0)
  const est1RMRef = useRef(0)

  useEffect(() => {
    let isMounted = true

    const initTensorFlow = async () => {
      if (typeof window === 'undefined') return

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

          // Reset metric tracking variables
          lastYRef.current = null
          lastTimeRef.current = null
          currentVelRef.current = 0
          peakVelRef.current = 0
          peakPowerRef.current = 0
          repCountRef.current = 0
          est1RMRef.current = 0

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

            // 1. Calculate Pixels to Meters Ratio
            let metersPerPixel = 0.003 // Responsive baseline (~330px per meter)
            if (shoulder && hip && (shoulder.score || 0) > 0.05 && (hip.score || 0) > 0.05) {
              const torsoPx = Math.hypot(shoulder.x - hip.x, shoulder.y - hip.y)
              if (torsoPx > 10) {
                metersPerPixel = 0.50 / torsoPx
              }
            }

            // 2. Wrist Position Detection
            let currentY = null
            if (leftWrist && rightWrist && (leftWrist.score || 0) > 0.05 && (rightWrist.score || 0) > 0.05) {
              currentY = (leftWrist.y + rightWrist.y) / 2
            } else if (leftWrist && (leftWrist.score || 0) > 0.05) {
              currentY = leftWrist.y
            } else if (rightWrist && (rightWrist.score || 0) > 0.05) {
              currentY = rightWrist.y
            }

            // 3. Real-Time Math & Calculation Engine
            if (currentY !== null) {
              if (lastYRef.current !== null && lastTimeRef.current !== null) {
                const deltaY = lastYRef.current - currentY // In canvas coordinates, Up = positive
                const deltaTime = (now - lastTimeRef.current) / 1000 // Convert ms to Seconds

                if (deltaTime > 0 && deltaTime < 0.2) {
                  const rawVelocity = (deltaY * metersPerPixel) / deltaTime
                  currentVelRef.current = rawVelocity

                  // Upward Concentric Lift Phase Detection (> 0.03 m/s threshold)
                  if (rawVelocity > 0.03) {
                    if (!isConcentricRef.current) {
                      isConcentricRef.current = true
                    }

                    // Calculate Peak Velocity
                    if (rawVelocity > peakVelRef.current) {
                      peakVelRef.current = parseFloat(rawVelocity.toFixed(2))
                      
                      // Calculate Power: Force (Load * 9.81) * Velocity
                      const force = loadKg * 9.81
                      peakPowerRef.current = Math.round(force * rawVelocity)

                      // Calculate 1RM estimation
                      const calculated1RM = Math.round(loadKg / (1.13 - 0.7 * rawVelocity))
                      if (calculated1RM > loadKg) {
                        est1RMRef.current = calculated1RM
                      }
                    }
                  } else if (rawVelocity < -0.03 && isConcentricRef.current) {
                    // Descent transition -> Increment rep count
                    isConcentricRef.current = false
                    repCountRef.current += 1
                  }
                }
              }

              lastYRef.current = currentY
              lastTimeRef.current = now

              // Draw Red Bar Line between wrists
              if (leftWrist && rightWrist) {
                ctx.strokeStyle = '#FF5C4D'
                ctx.lineWidth = 6
                ctx.beginPath()
                ctx.moveTo(leftWrist.x, leftWrist.y)
                ctx.lineTo(rightWrist.x, rightWrist.y)
                ctx.stroke()
              }
            }

            // Draw Skeleton
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
              if (startKp && endKp && (startKp.score || 0) > 0.05 && (endKp.score || 0) > 0.05) {
                ctx.beginPath()
                ctx.moveTo(startKp.x, startKp.y)
                ctx.lineTo(endKp.x, endKp.y)
                ctx.stroke()
              }
            })
          }

          // Direct Canvas Text HUD Render (Reads straight from Refs)
          const vel = currentVelRef.current
          ctx.fillStyle = vel > 0.03 ? '#00FF00' : '#FF5C4D'
          ctx.font = 'bold 26px Arial'
          ctx.shadowColor = '#000000'
          ctx.shadowBlur = 4
          ctx.fillText(`VELOCITY: ${vel.toFixed(2)} m/s`, 20, 45)

          ctx.fillStyle = '#FFFFFF'
          ctx.font = 'bold 18px Arial'
          ctx.fillText(`PEAK VEL: ${peakVelRef.current} m/s`, 20, 75)
          ctx.fillText(`POWER: ${peakPowerRef.current} W`, 20, 100)
          ctx.fillText(`EST 1RM: ${est1RMRef.current} kg`, 20, 125)
          ctx.fillText(`REPS: ${repCountRef.current}`, 20, 150)

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