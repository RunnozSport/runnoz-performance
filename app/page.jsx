'use client'
import { useState, useRef, useEffect } from 'react'

export default function Page() {
  const [status, setStatus] = useState('Initializing...')
  const [cameraActive, setCameraActive] = useState(false)
  const [poseReady, setPoseReady] = useState(false)
  const [sessions, setSessions] = useState([])
  
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const poseRef = useRef(null)
  const rafRef = useRef(null)
  const positionHistoryRef = useRef([])
  const repCountRef = useRef(0)
  const lastYRef = useRef(null)

  // Check for MediaPipe Pose every 100ms
  useEffect(() => {
    const checkPose = setInterval(() => {
      if (typeof window !== 'undefined' && window.Pose) {
        console.log('✅ Pose ready!')
        setPoseReady(true)
        setStatus('Ready - Click START')
        clearInterval(checkPose)
      }
    }, 100)

    return () => clearInterval(checkPose)
  }, [])

  const startCamera = async () => {
    if (!poseReady) {
      alert('Pose Detection still loading...')
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

        setTimeout(() => startPoseDetection(), 500)
      }
    } catch (err) {
      setStatus('Camera Error: ' + err.message)
    }
  }

  const startPoseDetection = () => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas || !window.Pose) return

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
    const ctx = canvas.getContext('2d')

    const onResults = (results) => {
      if (!cameraActive) return

      if (canvas.width === 0) {
        canvas.width = video.videoWidth || 640
        canvas.height = video.videoHeight || 480
      }

      // Draw video
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

      let barSpeed = 0

      if (results.poseLandmarks && results.poseLandmarks.length > 0) {
        const landmarks = results.poseLandmarks

        // Get wrists
        const leftWrist = landmarks[16]
        const rightWrist = landmarks[15]

        if (leftWrist && rightWrist && leftWrist.visibility > 0.3 && rightWrist.visibility > 0.3) {
          const centerX = (leftWrist.x + rightWrist.x) / 2
          const centerY = (leftWrist.y + rightWrist.y) / 2
          const centerZ = (leftWrist.z + rightWrist.z) / 2

          positionHistoryRef.current.push({ x: centerX, y: centerY, z: centerZ })
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
              const dz = recent[i].z - recent[i - 1].z
              const dist = Math.sqrt(dx * dx + dy * dy + dz * dz)
              totalDist += dist
            }
            barSpeed = Math.min(totalDist * 1.5, 2.5)
          }

          // Rep detection
          if (lastYRef.current !== null) {
            const yDelta = centerY - lastYRef.current
            if (yDelta > 0.05) repCountRef.current++
          }
          lastYRef.current = centerY
        }

        // Draw skeleton green
        ctx.strokeStyle = '#00FF00'
        ctx.lineWidth = 2
        ctx.fillStyle = '#00FF00'
        ctx.globalAlpha = 0.8

        const connections = [
          [11, 13], [13, 15], [12, 14], [14, 16],
          [11, 12], [11, 23], [12, 24], [23, 24],
          [23, 25], [25, 27], [24, 26], [26, 28]
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

        landmarks.forEach((landmark) => {
          if (landmark.visibility > 0.3) {
            ctx.beginPath()
            ctx.arc(landmark.x * canvas.width, landmark.y * canvas.height, 4, 0, Math.PI * 2)
            ctx.fill()
          }
        })

        ctx.globalAlpha = 1.0
      }

      // Draw bar red
      if (results.poseLandmarks) {
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

      // Metrics
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

      setStatus(`Tracking... ${reps} reps`)
    }

    pose.onResults(onResults)

    const detect = async () => {
      if (cameraActive && video && poseRef.current) {
        try {
          await poseRef.current.send({ image: video })
          rafRef.current = requestAnimationFrame(detect)
        } catch (e) {
          console.error(e)
        }
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