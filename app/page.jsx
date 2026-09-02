'use client'
import { useState, useRef, useEffect } from 'react'

export default function Page() {
  const [status, setStatus] = useState('Loading TensorFlow...')
  const [cameraActive, setCameraActive] = useState(false)
  const [poseReady, setPoseReady] = useState(false)
  const [sessions, setSessions] = useState([])
  
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const detectorRef = useRef(null)
  const rafRef = useRef(null)
  const positionHistoryRef = useRef([])
  const repCountRef = useRef(0)
  const lastYRef = useRef(null)

  // Initialize TensorFlow.js Pose Detection
  useEffect(() => {
    const initTF = async () => {
      try {
        console.log('Loading TensorFlow...')
        const tf = await import('@tensorflow/tfjs')
        const webgl = await import('@tensorflow/tfjs-backend-webgl')
        const poseDetection = await import('@tensorflow-models/pose-detection')
        
        // Set backend
        await tf.setBackend('webgl')
        console.log('TensorFlow backend:', tf.getBackend())

        // Create detector
        const detector = await poseDetection.createDetector(
          poseDetection.SupportedModels.MovenetSinglePose,
          {
            modelType: poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING,
            enableSmoothing: true
          }
        )

        detectorRef.current = detector
        setPoseReady(true)
        setStatus('Ready - Click START')
        console.log('✅ TensorFlow Pose Detection Ready!')
      } catch (error) {
        console.error('TensorFlow init error:', error)
        setStatus('Error: ' + error.message)
      }
    }

    initTF()
  }, [])

  const startCamera = async () => {
    if (!poseReady) {
      alert('TensorFlow still loading...')
      return
    }

    setStatus('Requesting camera...')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false
      })

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        setCameraActive(true)
        setStatus('Detecting pose...')
        repCountRef.current = 0
        positionHistoryRef.current = []
        lastYRef.current = null

        setTimeout(() => startPoseDetection(), 1000)
      }
    } catch (err) {
      setStatus('Camera Error: ' + err.message)
    }
  }

  const startPoseDetection = () => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas || !detectorRef.current) return

    const ctx = canvas.getContext('2d')

    const detect = async () => {
      if (!cameraActive || !video || !detectorRef.current) return

      try {
        // Run pose detection
        const poses = await detectorRef.current.estimatePoses(video)

        // Set canvas size
        if (canvas.width === 0) {
          canvas.width = video.videoWidth || 640
          canvas.height = video.videoHeight || 480
        }

        // Draw video
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

        let barSpeed = 0

        if (poses && poses.length > 0) {
          const keypoints = poses[0].keypoints

          // Wrists: 9=left, 10=right
          const leftWrist = keypoints[9]
          const rightWrist = keypoints[10]

          if (leftWrist && rightWrist && leftWrist.score > 0.3 && rightWrist.score > 0.3) {
            const centerX = (leftWrist.x + rightWrist.x) / 2 / canvas.width
            const centerY = (leftWrist.y + rightWrist.y) / 2 / canvas.height

            positionHistoryRef.current.push({ x: centerX, y: centerY })
            if (positionHistoryRef.current.length > 30) {
              positionHistoryRef.current.shift()
            }

            // Calculate velocity
            if (positionHistoryRef.current.length > 5) {
              let totalDist = 0
              const recent = positionHistoryRef.current
              for (let i = 1; i < recent.length; i++) {
                const dx = recent[i].x - recent[i - 1].x
                const dy = recent[i].y - recent[i - 1].y
                const dist = Math.sqrt(dx * dx + dy * dy)
                totalDist += dist
              }
              barSpeed = Math.min(totalDist * 2.0, 2.5)
            }

            // Rep detection
            if (lastYRef.current !== null) {
              const yDelta = centerY - lastYRef.current
              if (yDelta > 0.06 && lastYRef.current > centerY) {
                repCountRef.current++
              }
            }
            lastYRef.current = centerY
          }

          // Draw skeleton
          ctx.strokeStyle = '#00FF00'
          ctx.lineWidth = 2
          ctx.fillStyle = '#00FF00'
          ctx.globalAlpha = 0.8

          // Skeleton connections
          const connections = [
            [5, 7], [7, 9],       // Left arm
            [6, 8], [8, 10],      // Right arm
            [5, 6],               // Shoulders
            [5, 11], [6, 12],     // Torso
            [11, 12],             // Hips
            [11, 13], [13, 15],   // Left leg
            [12, 14], [14, 16]    // Right leg
          ]

          connections.forEach(([start, end]) => {
            const startKp = keypoints[start]
            const endKp = keypoints[end]
            if (startKp && endKp && startKp.score > 0.3 && endKp.score > 0.3) {
              ctx.beginPath()
              ctx.moveTo(startKp.x, startKp.y)
              ctx.lineTo(endKp.x, endKp.y)
              ctx.stroke()
            }
          })

          // Draw joints
          keypoints.forEach((kp) => {
            if (kp && kp.score > 0.3) {
              ctx.beginPath()
              ctx.arc(kp.x, kp.y, 4, 0, Math.PI * 2)
              ctx.fill()
            }
          })

          ctx.globalAlpha = 1.0

          // Draw bar (red line between wrists)
          if (leftWrist && rightWrist && leftWrist.score > 0.3 && rightWrist.score > 0.3) {
            ctx.strokeStyle = '#FF5C4D'
            ctx.lineWidth = 4
            ctx.beginPath()
            ctx.moveTo(leftWrist.x, leftWrist.y)
            ctx.lineTo(rightWrist.x, rightWrist.y)
            ctx.stroke()
          }
        }

        // Draw metrics
        const weight = 30
        const reps = repCountRef.current
        const power = (weight * 9.81 * barSpeed) / 1000
        const est1rm = weight * (1 + Math.max(reps, 1) / 30)

        ctx.fillStyle = '#FF5C4D'
        ctx.font = 'bold 26px Arial'
        ctx.shadowColor = '#000'
        ctx.shadowBlur = 4

        ctx.fillText(`${barSpeed.toFixed(2)} m/s`, 20, 50)
        ctx.font = '18px Arial'
        ctx.fillText(`${power.toFixed(0)}W`, 20, 80)
        ctx.fillText(`1RM: ${est1rm.toFixed(0)}kg`, 20, 110)
        ctx.fillText(`Reps: ${reps}`, 20, 140)

        setStatus(`Tracking... ${reps} reps | Speed: ${barSpeed.toFixed(2)} m/s`)

        if (cameraActive) {
          rafRef.current = requestAnimationFrame(detect)
        }
      } catch (error) {
        console.error('Detection error:', error)
      }
    }

    detect()
  }

  const stopCamera = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    if (videoRef.current?.srcObject) {
      videoRef.current.srcObject.getTracks().forEach((t) => t.stop())
    }
    setCameraActive(false)

    if (repCountRef.current > 0) {
      const session = {
        id: Date.now(),
        timestamp: new Date().toLocaleString(),
        weight: 30,
        reps: repCountRef.current,
        est1rm: 30 * (1 + repCountRef.current / 30)
      }
      setSessions([...sessions, session])
      setStatus('Session saved')
    }
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0D1117', color: '#F0F6FC' }}>
      <div style={{ padding: '16px 20px', borderBottom: '2px solid #FF5C4D', backgroundColor: '#161B22' }}>
        <h1 style={{ margin: 0, fontSize: '18px', fontWeight: '700' }}>RUNNOZ VBT {poseReady ? '✅' : '⏳'}</h1>
        <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#8B949E' }}>{status}</p>
      </div>

      <div style={{ padding: '20px' }}>
        <h2>AI Velocity Based Training</h2>

        {cameraActive ? (
          <div style={{ position: 'relative', marginBottom: '20px', width: '100%' }}>
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
                backgroundColor: '#000'
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
            disabled={!poseReady}
            style={{
              width: '100%',
              padding: '60px 20px',
              backgroundColor: poseReady ? '#FF5C4D' : '#666',
              color: '#FFF',
              border: 'none',
              borderRadius: '8px',
              fontSize: '18px',
              fontWeight: '700',
              cursor: poseReady ? 'pointer' : 'not-allowed',
              marginBottom: '20px',
              opacity: poseReady ? 1 : 0.6
            }}
          >
            {poseReady ? 'START VBT TRACKING' : 'LOADING AI...'}
          </button>
        )}

        <div style={{ backgroundColor: '#161B22', padding: '20px', borderRadius: '8px', border: '1px solid #30363D' }}>
          <h3>Sessions ({sessions.length})</h3>
          {sessions.map((s) => (
            <div key={s.id} style={{ padding: '10px', fontSize: '12px', borderBottom: '1px solid #30363D' }}>
              <strong>{s.timestamp}</strong><br/>{s.weight}kg × {s.reps} reps | 1RM: {s.est1rm.toFixed(0)}kg
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}