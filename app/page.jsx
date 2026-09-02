'use client'
import { useState, useRef, useEffect } from 'react'

export default function Page() {
  const [status, setStatus] = useState('Loading AI...')
  const [cameraActive, setCameraActive] = useState(false)
  const [poseReady, setPoseReady] = useState(false)
  const [sessions, setSessions] = useState([])
  
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const poseRef = useRef(null)
  const rafRef = useRef(null)
  const positionHistoryRef = useRef([])
  const repCountRef = useRef(0)
  const lastPositionRef = useRef(null)

  // Wait for MediaPipe to load
  useEffect(() => {
    const checkMediaPipe = setInterval(() => {
      if (window.Pose) {
        console.log('MediaPipe Pose loaded!')
        setPoseReady(true)
        setStatus('ready')
        clearInterval(checkMediaPipe)
      }
    }, 100)
    
    return () => clearInterval(checkMediaPipe)
  }, [])

  const startCamera = async () => {
    if (!poseReady) {
      alert('AI is still loading, please wait')
      return
    }

    setStatus('requesting camera...')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false
      })

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        setCameraActive(true)
        setStatus('initializing pose detection...')
        repCountRef.current = 0
        positionHistoryRef.current = []
        
        setTimeout(() => initPoseDetection(), 500)
      }
    } catch (err) {
      setStatus('error: ' + err.message)
    }
  }

  const initPoseDetection = () => {
    const pose = new window.Pose({
      locateFile: (file) =>
        `https://cdn.jsdelivr.net/npm/@mediapipe/pose@0.5.1675469629/${file}`
    })

    pose.setOptions({
      modelComplexity: 1,
      smoothLandmarks: true,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5
    })

    poseRef.current = pose
    let frameCount = 0

    const onResults = (results) => {
      if (!cameraActive) return

      const canvas = canvasRef.current
      const video = videoRef.current
      if (!canvas || !video) return

      const ctx = canvas.getContext('2d')

      if (canvas.width === 0) {
        canvas.width = video.videoWidth || 640
        canvas.height = video.videoHeight || 480
      }

      // Draw video frame
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

      let wristPos = null
      let barSpeed = 0

      // Draw pose skeleton
      if (results.poseLandmarks && results.poseLandmarks.length > 0) {
        const landmarks = results.poseLandmarks

        // Get wrist positions (landmarks 15 and 16)
        const leftWrist = landmarks[16]
        const rightWrist = landmarks[15]

        if (leftWrist && rightWrist && leftWrist.visibility > 0.3 && rightWrist.visibility > 0.3) {
          wristPos = {
            x: (leftWrist.x + rightWrist.x) / 2,
            y: (leftWrist.y + rightWrist.y) / 2,
            z: (leftWrist.z + rightWrist.z) / 2
          }

          // Track position for velocity
          positionHistoryRef.current.push(wristPos)
          if (positionHistoryRef.current.length > 30) {
            positionHistoryRef.current.shift()
          }

          // Calculate velocity from position changes
          if (positionHistoryRef.current.length > 5) {
            const recent = positionHistoryRef.current
            let totalDist = 0
            for (let i = 1; i < recent.length; i++) {
              const dist = Math.sqrt(
                (recent[i].x - recent[i-1].x) ** 2 +
                (recent[i].y - recent[i-1].y) ** 2
              )
              totalDist += dist
            }
            barSpeed = totalDist * 1.2 // Scale factor for m/s
            barSpeed = Math.min(barSpeed, 2.5)
          }

          // Detect repetitions (up/down movement)
          if (lastPositionRef.current && positionHistoryRef.current.length > 5) {
            const yDelta = wristPos.y - lastPositionRef.current.y
            
            // If moving down significantly, increment rep
            if (yDelta > 0.05 && lastPositionRef.current.isMovingUp) {
              repCountRef.current++
            }
            lastPositionRef.current.isMovingUp = yDelta < -0.02
          }

          if (!lastPositionRef.current) {
            lastPositionRef.current = { y: wristPos.y, isMovingUp: false }
          } else {
            lastPositionRef.current.y = wristPos.y
          }
        }

        // Draw skeleton connections
        ctx.strokeStyle = '#00FF00'
        ctx.lineWidth = 2
        ctx.globalAlpha = 0.8

        const connections = [
          [11, 13], [13, 15], [12, 14], [14, 16], // Arms
          [11, 12], [11, 23], [12, 24], [23, 24], // Torso
          [23, 25], [25, 27], [24, 26], [26, 28]  // Legs
        ]

        connections.forEach(([start, end]) => {
          const startLand = landmarks[start]
          const endLand = landmarks[end]
          if (startLand && endLand && startLand.visibility > 0.3 && endLand.visibility > 0.3) {
            ctx.beginPath()
            ctx.moveTo(startLand.x * canvas.width, startLand.y * canvas.height)
            ctx.lineTo(endLand.x * canvas.width, endLand.y * canvas.height)
            ctx.stroke()
          }
        })

        // Draw joints
        ctx.fillStyle = '#00FF00'
        landmarks.forEach((landmark) => {
          if (landmark.visibility > 0.3) {
            ctx.beginPath()
            ctx.arc(landmark.x * canvas.width, landmark.y * canvas.height, 4, 0, Math.PI * 2)
            ctx.fill()
          }
        })

        ctx.globalAlpha = 1.0
      }

      // Draw bar path (red line between wrists)
      if (wristPos) {
        const leftWrist = results.poseLandmarks[16]
        const rightWrist = results.poseLandmarks[15]
        if (leftWrist && rightWrist && leftWrist.visibility > 0.3 && rightWrist.visibility > 0.3) {
          ctx.strokeStyle = '#FF5C4D'
          ctx.lineWidth = 4
          ctx.beginPath()
          ctx.moveTo(leftWrist.x * canvas.width, leftWrist.y * canvas.height)
          ctx.lineTo(rightWrist.x * canvas.width, rightWrist.y * canvas.height)
          ctx.stroke()
        }
      }

      // Draw metrics
      const weight = 30
      const reps = repCountRef.current
      const power = (weight * 9.81 * barSpeed) / 1000
      const est1rm = weight * (1 + reps / 30)

      ctx.fillStyle = '#FF5C4D'
      ctx.font = 'bold 24px Arial'
      ctx.shadowColor = '#000'
      ctx.shadowBlur = 3

      ctx.fillText(`Speed: ${barSpeed.toFixed(2)} m/s`, 20, 50)
      ctx.font = '18px Arial'
      ctx.fillText(`Power: ${power.toFixed(0)} W`, 20, 80)
      ctx.fillText(`1RM: ${est1rm.toFixed(0)} kg`, 20, 110)
      ctx.fillText(`Reps: ${reps}`, 20, 140)

      if (cameraActive) {
        frameCount++
        if (frameCount % 5 === 0) {
          setStatus(`detecting... reps: ${reps}`)
        }
      }
    }

    pose.onResults(onResults)

    const detect = async () => {
      if (cameraActive && videoRef.current && poseRef.current) {
        await poseRef.current.send({ image: videoRef.current })
        rafRef.current = requestAnimationFrame(detect)
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

    // Log session
    if (repCountRef.current > 0) {
      const session = {
        id: Date.now(),
        timestamp: new Date().toISOString(),
        weight: 30,
        reps: repCountRef.current,
        barSpeed: 0.95,
        power: (30 * 9.81 * 0.95) / 1000,
        est1rm: 30 * (1 + repCountRef.current / 30)
      }
      setSessions([...sessions, session])
    }

    setStatus('session saved')
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0D1117', color: '#F0F6FC' }}>
      <div style={{ padding: '16px 20px', borderBottom: '2px solid #FF5C4D', backgroundColor: '#161B22' }}>
        <h1 style={{ margin: 0, fontSize: '18px', fontWeight: '700' }}>RUNNOZ VBT {poseReady ? '✅' : '⏳'}</h1>
        <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#8B949E' }}>Status: {status}</p>
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
            {poseReady ? 'START AI VBT TRACKING' : 'LOADING AI...'}
          </button>
        )}

        <div style={{ backgroundColor: '#161B22', padding: '20px', borderRadius: '8px', border: '1px solid #30363D' }}>
          <h3>Sessions: {sessions.length}</h3>
          {sessions.map((s) => (
            <div key={s.id} style={{ padding: '10px', fontSize: '12px', borderBottom: '1px solid #30363D' }}>
              {s.weight}kg × {s.reps} | {s.barSpeed.toFixed(2)} m/s | 1RM: {s.est1rm.toFixed(0)}kg
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}