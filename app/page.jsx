'use client'

import { useState, useRef, useEffect } from 'react'
import { Zap, Home, Camera, StopCircle, Download } from 'lucide-react'

export default function Page() {
  const [activeTab, setActiveTab] = useState('lift')
  const [cameraActive, setCameraActive] = useState(false)
  const [sessions, setSessions] = useState([])
  const [poseLoaded, setPoseLoaded] = useState(false)
  
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const poseRef = useRef(null)
  const rafRef = useRef(null)
  const positionHistoryRef = useRef([])
  const repCountRef = useRef(0)
  const isLiftingRef = useRef(false)

  // Load MediaPipe Pose at runtime
  useEffect(() => {
    const loadMediaPipe = async () => {
      try {
        // Create script for Pose library
        const poseScript = document.createElement('script')
        poseScript.src = 'https://cdn.jsdelivr.net/npm/@mediapipe/pose@0.5.1675469629/pose.min.js'
        poseScript.async = true

        const drawingScript = document.createElement('script')
        drawingScript.src = 'https://cdn.jsdelivr.net/npm/@mediapipe/drawing_utils@0.5.1675469629/drawing_utils.min.js'
        drawingScript.async = true

        document.head.appendChild(poseScript)
        document.head.appendChild(drawingScript)

        poseScript.onload = () => {
          console.log('MediaPipe Pose loaded!')
          setPoseLoaded(true)
        }
      } catch (err) {
        console.error('Failed to load MediaPipe:', err)
      }
    }

    loadMediaPipe()
  }, [])

  const calculateVelocity = (positions) => {
    if (positions.length < 2) return 0

    const recent = positions.slice(-10) // Last 10 frames
    if (recent.length < 2) return 0

    let totalDistance = 0
    for (let i = 1; i < recent.length; i++) {
      const p1 = recent[i - 1]
      const p2 = recent[i]
      const distance = Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2)
      totalDistance += distance
    }

    // Approximate velocity (pixels to m/s conversion ~0.001)
    const velocity = totalDistance * 0.001
    return Math.min(velocity, 2.5) // Cap at 2.5 m/s
  }

  const detectRepetition = (wristY) => {
    const threshold = 0.15 // Movement threshold
    
    if (!isLiftingRef.current && wristY > threshold) {
      isLiftingRef.current = true
    } else if (isLiftingRef.current && wristY < -threshold) {
      repCountRef.current++
      isLiftingRef.current = false
    }
  }

  const startCamera = async () => {
    try {
      if (!poseLoaded) {
        alert('AI is still loading... please wait')
        return
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false
      })

      videoRef.current.srcObject = stream
      setCameraActive(true)
      repCountRef.current = 0
      positionHistoryRef.current = []

      setTimeout(() => initPoseDetection(), 500)
    } catch (err) {
      alert('Camera Error: ' + err.message)
    }
  }

  const initPoseDetection = async () => {
    if (!window.Pose) {
      console.error('Pose not loaded')
      return
    }

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
    let lastVelocity = 0
    let lastBarSpeed = 0

    const onResults = (results) => {
      if (!cameraActive) return

      const canvas = canvasRef.current
      const video = videoRef.current
      if (!canvas || !video) return

      const ctx = canvas.getContext('2d')

      if (canvas.width === 0) {
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
      }

      // Draw video
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

      // Draw pose landmarks if detected
      if (results.poseLandmarks && results.poseLandmarks.length > 0) {
        // Get wrist positions (landmarks 15 and 16)
        const leftWrist = results.poseLandmarks[16]
        const rightWrist = results.poseLandmarks[15]

        if (leftWrist && rightWrist && leftWrist.visibility > 0.3 && rightWrist.visibility > 0.3) {
          // Track position history
          const wristPosition = {
            x: (leftWrist.x + rightWrist.x) / 2,
            y: (leftWrist.y + rightWrist.y) / 2,
            z: (leftWrist.z + rightWrist.z) / 2
          }

          positionHistoryRef.current.push(wristPosition)
          if (positionHistoryRef.current.length > 30) {
            positionHistoryRef.current.shift()
          }

          // Calculate velocity
          lastBarSpeed = calculateVelocity(positionHistoryRef.current)
          lastVelocity = lastBarSpeed

          // Detect rep
          if (positionHistoryRef.current.length > 2) {
            const prevPos = positionHistoryRef.current[positionHistoryRef.current.length - 2]
            const yDelta = wristPosition.y - prevPos.y
            detectRepetition(yDelta)
          }
        }

        // Draw skeleton
        ctx.strokeStyle = '#00FF00'
        ctx.lineWidth = 2
        ctx.fillStyle = '#00FF00'

        // Draw connections
        const connections = [
          [11, 13], [13, 15], // Right arm
          [12, 14], [14, 16], // Left arm
          [11, 12], // Shoulders
          [11, 23], [12, 24], // Torso
          [23, 24], // Hips
          [23, 25], [25, 27], // Right leg
          [24, 26], [26, 28], // Left leg
        ]

        connections.forEach(([start, end]) => {
          const startLandmark = results.poseLandmarks[start]
          const endLandmark = results.poseLandmarks[end]

          if (
            startLandmark &&
            endLandmark &&
            startLandmark.visibility > 0.3 &&
            endLandmark.visibility > 0.3
          ) {
            ctx.beginPath()
            ctx.moveTo(startLandmark.x * canvas.width, startLandmark.y * canvas.height)
            ctx.lineTo(endLandmark.x * canvas.width, endLandmark.y * canvas.height)
            ctx.stroke()
          }
        })

        // Draw joints
        results.poseLandmarks.forEach((landmark) => {
          if (landmark.visibility > 0.3) {
            ctx.beginPath()
            ctx.arc(
              landmark.x * canvas.width,
              landmark.y * canvas.height,
              5,
              0,
              Math.PI * 2
            )
            ctx.fill()
          }
        })

        // Draw bar (red line between wrists)
        if (leftWrist.visibility > 0.3 && rightWrist.visibility > 0.3) {
          ctx.strokeStyle = '#FF5C4D'
          ctx.lineWidth = 4
          ctx.beginPath()
          ctx.moveTo(leftWrist.x * canvas.width, leftWrist.y * canvas.height)
          ctx.lineTo(rightWrist.x * canvas.width, rightWrist.y * canvas.height)
          ctx.stroke()
        }
      }

      // Calculate metrics
      const weight = 30 // Will be from input
      const reps = repCountRef.current
      const barSpeed = lastBarSpeed
      const estimated1RM = weight * (1 + reps / 30)
      const power = (weight * 9.81 * barSpeed) / 1000

      // Draw metrics
      ctx.fillStyle = '#FF5C4D'
      ctx.font = 'bold 20px Arial'
      ctx.shadowColor = '#000'
      ctx.shadowBlur = 3

      ctx.fillText(`Speed: ${barSpeed.toFixed(2)} m/s`, 20, 40)
      ctx.font = '16px Arial'
      ctx.fillText(`Power: ${power.toFixed(0)} W`, 20, 65)
      ctx.fillText(`1RM: ${estimated1RM.toFixed(0)} kg`, 20, 90)
      ctx.fillText(`Reps: ${reps}`, 20, 115)
      ctx.fillText(`RPE: 8/10`, 20, 140)

      frameCount++
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
        type: 'lift',
        timestamp: new Date().toISOString(),
        weight: 30,
        reps: repCountRef.current,
        barSpeed: 0.98,
        estimated1RM: 30 * (1 + repCountRef.current / 30),
        power: (30 * 9.81 * 0.98) / 1000
      }
      setSessions([...sessions, session])
      console.log('Session logged:', session)
    }
  }

  const exportToCSV = () => {
    if (sessions.length === 0) {
      alert('No sessions to export')
      return
    }

    const csv = [
      ['Date', 'Weight (kg)', 'Reps', 'Bar Speed (m/s)', 'Power (W)', '1RM Est'].join(','),
      ...sessions.map((s) =>
        [
          new Date(s.timestamp).toLocaleDateString(),
          s.weight,
          s.reps,
          s.barSpeed.toFixed(2),
          s.power.toFixed(0),
          s.estimated1RM.toFixed(0)
        ].join(',')
      )
    ].join('\n')

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `runnoz-vbt-${Date.now()}.csv`
    a.click()
  }

  return (
    <div style={styles.container}>
      <video ref={videoRef} autoPlay playsInline muted style={{ display: 'none' }} />

      <div style={styles.header}>
        <Zap size={20} color="#FF5C4D" />
        <h1 style={styles.title}>RUNNOZ VBT {poseLoaded ? '✅' : '⏳'}</h1>
        <button onClick={exportToCSV} style={styles.exportBtn}>
          <Download size={16} /> Export
        </button>
      </div>

      <div style={styles.tabs}>
        <button onClick={() => setActiveTab('home')} style={{...styles.tab, ...(activeTab === 'home' && styles.tabActive)}}>
          <Home size={16} /> Home
        </button>
        <button onClick={() => setActiveTab('lift')} style={{...styles.tab, ...(activeTab === 'lift' && styles.tabActive)}}>
          <Camera size={16} /> Lift
        </button>
      </div>

      <div style={styles.content}>
        {activeTab === 'home' && (
          <div>
            <h2>Sessions: {sessions.length}</h2>
            {sessions.map((s) => (
              <div key={s.id} style={styles.sessionCard}>
                <p><strong>{new Date(s.timestamp).toLocaleDateString()}</strong></p>
                <p>{s.weight}kg × {s.reps} reps | Speed: {s.barSpeed.toFixed(2)} m/s | 1RM: {s.estimated1RM.toFixed(0)}kg</p>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'lift' && (
          <div>
            <h2>Velocity Based Training {poseLoaded ? '✅' : '⏳'}</h2>

            {cameraActive && (
              <div style={styles.cameraBox}>
                <canvas ref={canvasRef} style={styles.canvas} />
                <button onClick={stopCamera} style={styles.stopBtn}>
                  <StopCircle size={18} /> STOP
                </button>
              </div>
            )}

            {!cameraActive && (
              <button onClick={startCamera} disabled={!poseLoaded} style={{...styles.startBtn, opacity: poseLoaded ? 1 : 0.5}}>
                <Camera size={32} />
                {poseLoaded ? 'START VBT TRACKING' : 'LOADING AI...'}
              </button>
            )}

            <div style={styles.form}>
              <h3>Quick Log</h3>
              <input type="number" placeholder="Weight (kg)" defaultValue="30" style={styles.inp} />
              <input type="number" placeholder="RPE" defaultValue="8" style={styles.inp} />
              <button style={styles.logBtn}>MANUAL LOG</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

const styles = {
  container: { minHeight: '100vh', backgroundColor: '#0D1117', color: '#F0F6FC', display: 'flex', flexDirection: 'column' },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', padding: '16px 20px', borderBottom: '2px solid #FF5C4D', backgroundColor: '#161B22' },
  title: { fontSize: '18px', fontWeight: '700', margin: 0, flex: 1 },
  exportBtn: { display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: '#FF5C4D', color: '#FFF', border: 'none', padding: '8px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: '600' },
  tabs: { display: 'flex', gap: '8px', padding: '12px 20px', borderBottom: '1px solid #30363D' },
  tab: { display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', backgroundColor: 'transparent', color: '#8B949E', border: '1px solid #30363D', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' },
  tabActive: { backgroundColor: '#FF5C4D', color: '#FFF', borderColor: '#FF5C4D' },
  content: { padding: '20px', flex: 1 },
  startBtn: { width: '100%', padding: '60px 20px', backgroundColor: '#FF5C4D', color: '#FFF', border: 'none', borderRadius: '8px', fontSize: '18px', fontWeight: '700', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px', marginBottom: '20px' },
  cameraBox: { position: 'relative', backgroundColor: '#000', borderRadius: '8px', overflow: 'hidden', marginBottom: '20px', border: '2px solid #FF5C4D' },
  canvas: { width: '100%', height: 'auto', display: 'block', maxHeight: '600px', backgroundColor: '#000' },
  stopBtn: { position: 'absolute', bottom: '16px', right: '16px', backgroundColor: '#FF5C4D', color: '#FFF', border: 'none', padding: '10px 14px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '600', fontSize: '12px' },
  form: { backgroundColor: '#161B22', padding: '20px', borderRadius: '8px', border: '1px solid #30363D' },
  inp: { width: '100%', backgroundColor: '#0D1117', color: '#F0F6FC', border: '1px solid #30363D', padding: '10px 12px', borderRadius: '6px', fontSize: '13px', marginBottom: '10px', boxSizing: 'border-box' },
  logBtn: { width: '100%', padding: '12px', backgroundColor: '#FF5C4D', color: '#FFF', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '700', fontSize: '14px', marginTop: '8px' },
  sessionCard: { backgroundColor: '#161B22', padding: '16px', borderRadius: '8px', marginBottom: '12px', border: '1px solid #30363D' },
}