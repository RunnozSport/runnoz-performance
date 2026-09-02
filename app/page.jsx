'use client'

import { useState, useRef, useEffect } from 'react'
import { Zap, Home, Camera, StopCircle } from 'lucide-react'

export default function Page() {
  const [activeTab, setActiveTab] = useState('lift')
  const [cameraActive, setCameraActive] = useState(false)
  const [poseLoaded, setPoseLoaded] = useState(false)
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const poseRef = useRef(null)
  const animationRef = useRef(null)

  // Load MediaPipe at runtime
  useEffect(() => {
    if (typeof window === 'undefined') return

    const loadMediaPipe = async () => {
      try {
        // Load scripts dynamically
        const script1 = document.createElement('script')
        script1.src = 'https://cdn.jsdelivr.net/npm/@mediapipe/pose@0.5.1675469629/pose.min.js'
        document.head.appendChild(script1)

        script1.onload = () => {
          if (window.Pose) {
            setPoseLoaded(true)
            console.log('MediaPipe Pose loaded!')
          }
        }
      } catch (err) {
        console.error('MediaPipe load error:', err)
      }
    }

    loadMediaPipe()
  }, [])

  const startPoseDetection = async () => {
    if (!poseLoaded || !window.Pose) {
      alert('MediaPipe still loading... please wait')
      return
    }

    const pose = new window.Pose({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose@0.5.1675469629/${file}`
    })

    pose.setOptions({
      modelComplexity: 1,
      smoothLandmarks: true,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5
    })

    poseRef.current = pose

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

      // Draw video frame
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

      // Draw pose landmarks
      if (results.poseLandmarks && results.poseLandmarks.length > 0) {
        // Draw skeleton connections
        ctx.strokeStyle = '#00FF00'
        ctx.lineWidth = 2
        ctx.globalAlpha = 0.8

        const connections = [
          [11, 13], [13, 15],
          [12, 14], [14, 16],
          [11, 12],
          [11, 23], [12, 24],
          [23, 24],
          [23, 25], [25, 27],
          [24, 26], [26, 28],
        ]

        connections.forEach(([start, end]) => {
          const startLandmark = results.poseLandmarks[start]
          const endLandmark = results.poseLandmarks[end]

          if (
            startLandmark &&
            endLandmark &&
            startLandmark.visibility > 0.5 &&
            endLandmark.visibility > 0.5
          ) {
            ctx.beginPath()
            ctx.moveTo(startLandmark.x * canvas.width, startLandmark.y * canvas.height)
            ctx.lineTo(endLandmark.x * canvas.width, endLandmark.y * canvas.height)
            ctx.stroke()
          }
        })

        // Draw joints
        ctx.fillStyle = '#00FF00'
        results.poseLandmarks.forEach((landmark) => {
          if (landmark.visibility > 0.5) {
            ctx.beginPath()
            ctx.arc(landmark.x * canvas.width, landmark.y * canvas.height, 5, 0, Math.PI * 2)
            ctx.fill()
          }
        })

        // Draw bar line (between wrists)
        const leftWrist = results.poseLandmarks[16]
        const rightWrist = results.poseLandmarks[15]

        if (leftWrist && rightWrist && leftWrist.visibility > 0.5 && rightWrist.visibility > 0.5) {
          ctx.strokeStyle = '#FF5C4D'
          ctx.lineWidth = 4
          ctx.beginPath()
          ctx.moveTo(leftWrist.x * canvas.width, leftWrist.y * canvas.height)
          ctx.lineTo(rightWrist.x * canvas.width, rightWrist.y * canvas.height)
          ctx.stroke()
        }

        ctx.globalAlpha = 1.0
      }

      // Draw metrics
      ctx.fillStyle = '#FF5C4D'
      ctx.font = 'bold 20px Arial'
      ctx.fillText('Bar Speed: 0.98 m/s', 20, 40)
      ctx.font = '16px Arial'
      ctx.fillText('Power: 1,250 W', 20, 65)
      ctx.fillText('1RM Est: 130 kg', 20, 90)
      ctx.fillText('RPE: 8/10', 20, 115)
    }

    pose.onResults(onResults)

    const detect = async () => {
      if (cameraActive && videoRef.current && poseRef.current) {
        await poseRef.current.send({ image: videoRef.current })
        animationRef.current = requestAnimationFrame(detect)
      }
    }

    detect()
  }

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false
      })

      videoRef.current.srcObject = stream
      setCameraActive(true)

      setTimeout(() => {
        startPoseDetection()
      }, 500)
    } catch (err) {
      alert('Camera Error: ' + err.message)
    }
  }

  const stopCamera = () => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current)
    }
    if (videoRef.current?.srcObject) {
      videoRef.current.srcObject.getTracks().forEach((t) => t.stop())
    }
    setCameraActive(false)
  }

  return (
    <div style={styles.container}>
      <video ref={videoRef} autoPlay playsInline muted style={{ display: 'none' }} />
      <canvas ref={canvasRef} style={{ display: cameraActive ? 'block' : 'none', width: '100%', maxHeight: '600px' }} />

      <div style={styles.header}>
        <Zap size={20} color="#FF5C4D" />
        <h1 style={styles.title}>RUNNOZ Performance</h1>
      </div>

      <div style={styles.tabs}>
        <button onClick={() => setActiveTab('home')} style={{ ...styles.tab, ...(activeTab === 'home' && styles.tabActive) }}>
          <Home size={16} /> Home
        </button>
        <button onClick={() => setActiveTab('lift')} style={{ ...styles.tab, ...(activeTab === 'lift' && styles.tabActive) }}>
          <Camera size={16} /> Lift
        </button>
      </div>

      <div style={styles.content}>
        <h2>Barbell Velocity Tracking {poseLoaded ? '✅' : '⏳'}</h2>

        {!cameraActive && (
          <button onClick={startCamera} disabled={!poseLoaded} style={{ ...styles.startBtn, opacity: poseLoaded ? 1 : 0.5 }}>
            <Camera size={32} />
            {poseLoaded ? 'START REAR CAMERA' : 'LOADING AI...'}
          </button>
        )}

        {cameraActive && (
          <div style={styles.cameraBox}>
            <button onClick={stopCamera} style={styles.stopBtn}>
              <StopCircle size={18} /> STOP
            </button>
          </div>
        )}

        <div style={styles.form}>
          <h3>Log Lift</h3>
          <input type="number" placeholder="Weight (kg)" defaultValue="30" style={styles.inp} />
          <input type="number" placeholder="Reps" defaultValue="5" style={styles.inp} />
          <input type="number" placeholder="Speed (m/s)" defaultValue="0.98" step="0.01" style={styles.inp} />
          <button style={styles.logBtn}>LOG LIFT</button>
        </div>
      </div>
    </div>
  )
}

const styles = {
  container: { minHeight: '100vh', backgroundColor: '#0D1117', color: '#F0F6FC' },
  header: { display: 'flex', alignItems: 'center', gap: '12px', padding: '16px 20px', borderBottom: '2px solid #FF5C4D', backgroundColor: '#161B22' },
  title: { fontSize: '18px', fontWeight: '700', margin: 0 },
  tabs: { display: 'flex', gap: '8px', padding: '12px 20px', borderBottom: '1px solid #30363D' },
  tab: { display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', backgroundColor: 'transparent', color: '#8B949E', border: '1px solid #30363D', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' },
  tabActive: { backgroundColor: '#FF5C4D', color: '#FFF', borderColor: '#FF5C4D' },
  content: { padding: '20px' },
  startBtn: { width: '100%', padding: '60px 20px', backgroundColor: '#FF5C4D', color: '#FFF', border: 'none', borderRadius: '8px', fontSize: '18px', fontWeight: '700', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px', marginBottom: '20px' },
  cameraBox: { position: 'relative', backgroundColor: '#000', borderRadius: '8px', overflow: 'hidden', marginBottom: '20px', border: '2px solid #FF5C4D' },
  stopBtn: { position: 'absolute', bottom: '16px', right: '16px', backgroundColor: '#FF5C4D', color: '#FFF', border: 'none', padding: '10px 14px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '600', fontSize: '12px' },
  form: { backgroundColor: '#161B22', padding: '20px', borderRadius: '8px', border: '1px solid #30363D' },
  inp: { width: '100%', backgroundColor: '#0D1117', color: '#F0F6FC', border: '1px solid #30363D', padding: '10px 12px', borderRadius: '6px', fontSize: '13px', marginBottom: '10px', boxSizing: 'border-box' },
  logBtn: { width: '100%', padding: '12px', backgroundColor: '#FF5C4D', color: '#FFF', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '700', fontSize: '14px', marginTop: '8px' },
}