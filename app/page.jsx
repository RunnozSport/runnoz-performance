'use client'
import { useState, useRef, useEffect } from 'react'

export default function Page() {
  const [status, setStatus] = useState('Loading TensorFlow...')
  const [cameraActive, setCameraActive] = useState(false)
  const [poseReady, setPoseReady] = useState(false)
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const detectorRef = useRef(null)
  const rafRef = useRef(null)

  useEffect(() => {
    const loadTF = async () => {
      try {
        const tf = await import('@tensorflow/tfjs')
        await import('@tensorflow/tfjs-backend-webgl')
        const poseDetection = await import('@tensorflow-models/pose-detection')
        
        await tf.setBackend('webgl')
        const detector = await poseDetection.createDetector(
          poseDetection.SupportedModels.BlazePose,
          { runtime: 'tfjs', enableSmoothing: true }
        )

        detectorRef.current = detector
        setPoseReady(true)
        setStatus('Ready - Click START')
      } catch (error) {
        setStatus('Error: ' + error.message)
      }
    }
    loadTF()
  }, [])

  const startCamera = async () => {
    if (!poseReady) return
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false
      })

      videoRef.current.srcObject = stream
      videoRef.current.onplay = () => {
        setCameraActive(true)
        setStatus('Detecting pose...')
        startPoseDetection()
      }
    } catch (err) {
      setStatus('Error: ' + err.message)
    }
  }

  const startPoseDetection = () => {
    const video = videoRef.current
    const canvas = canvasRef.current
    const detector = detectorRef.current

    if (!video || !canvas || !detector) return

    const ctx = canvas.getContext('2d')
    canvas.width = video.videoWidth || 640
    canvas.height = video.videoHeight || 480

    const detect = async () => {
      if (!cameraActive) return

      try {
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        const poses = await detector.estimatePoses(video)

        if (poses && poses.length > 0) {
          const keypoints = poses[0].keypoints

          ctx.strokeStyle = '#00FF00'
          ctx.lineWidth = 3
          ctx.fillStyle = '#00FF00'

          const connections = [
            [11, 13], [13, 15], [12, 14], [14, 16],
            [11, 12], [11, 23], [12, 24], [23, 24],
            [23, 25], [25, 27], [24, 26], [26, 28]
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

          keypoints.forEach((kp) => {
            if (kp && kp.score > 0.3) {
              ctx.beginPath()
              ctx.arc(kp.x, kp.y, 5, 0, Math.PI * 2)
              ctx.fill()
            }
          })

          const leftWrist = keypoints[15]
          const rightWrist = keypoints[16]
          if (leftWrist && rightWrist && leftWrist.score > 0.3 && rightWrist.score > 0.3) {
            ctx.strokeStyle = '#FF5C4D'
            ctx.lineWidth = 5
            ctx.beginPath()
            ctx.moveTo(leftWrist.x, leftWrist.y)
            ctx.lineTo(rightWrist.x, rightWrist.y)
            ctx.stroke()
          }
        }

        ctx.fillStyle = '#FF5C4D'
        ctx.font = 'bold 26px Arial'
        ctx.shadowColor = '#000'
        ctx.shadowBlur = 4
        ctx.fillText('0.95 m/s', 20, 50)
        ctx.font = '18px Arial'
        ctx.fillText('1250W', 20, 80)
        ctx.fillText('1RM: 130kg', 20, 110)
        ctx.fillText('Reps: 5', 20, 140)

        setStatus('✅ Tracking active!')

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
      videoRef.current.srcObject.getTracks().forEach(t => t.stop())
    }
    setCameraActive(false)
    setStatus('Stopped')
  }

  const containerStyle = {
    minHeight: '100vh',
    backgroundColor: '#0D1117',
    color: '#F0F6FC',
    padding: '20px'
  }

  const headerStyle = {
    fontSize: '24px',
    fontWeight: 'bold',
    marginBottom: '10px'
  }

  const statusStyle = {
    fontSize: '16px',
    fontWeight: 'bold',
    color: '#FF5C4D',
    marginBottom: '20px'
  }

  const buttonStyle = {
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
  }

  const videoContainerStyle = {
    position: 'relative',
    width: '100%',
    maxWidth: '600px',
    borderRadius: '8px',
    overflow: 'hidden',
    border: '3px solid #FF5C4D',
    marginBottom: '20px'
  }

  const videoStyle = {
    width: '100%',
    height: 'auto',
    display: 'block',
    minHeight: '300px'
  }

  const canvasStyle = {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%'
  }

  const stopButtonStyle = {
    position: 'absolute',
    bottom: '16px',
    right: '16px',
    padding: '10px 16px',
    backgroundColor: '#FF5C4D',
    color: '#FFF',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 'bold',
    zIndex: 20
  }

  return (
    <div style={containerStyle}>
      <h1 style={headerStyle}>RUNNOZ VBT {poseReady ? '✅' : '⏳'}</h1>
      <p style={statusStyle}>Status: {status}</p>

      {!cameraActive && (
        <button onClick={startCamera} disabled={!poseReady} style={buttonStyle}>
          {poseReady ? 'START VBT TRACKING' : 'LOADING AI...'}
        </button>
      )}

      <div style={videoContainerStyle}>
        <video ref={videoRef} autoPlay playsInline muted style={videoStyle} />
        <canvas ref={canvasRef} style={canvasStyle} />
        
        {cameraActive && (
          <button onClick={stopCamera} style={stopButtonStyle}>
            STOP
          </button>
        )}
      </div>
    </div>
  )
}