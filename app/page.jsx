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
  const repCountRef = useRef(0)

  useEffect(() => {
    const loadTF = async () => {
      try {
        console.log('Loading TensorFlow...')
        const tf = await import('@tensorflow/tfjs')
        const webgl = await import('@tensorflow/tfjs-backend-webgl')
        const poseDetection = await import('@tensorflow-models/pose-detection')
        
        await tf.setBackend('webgl')

        const detector = await poseDetection.createDetector(
          poseDetection.SupportedModels.BlazePose,
          { runtime: 'tfjs', enableSmoothing: true }
        )

        detectorRef.current = detector
        setPoseReady(true)
        setStatus('Ready - Click START')
        console.log('✅ TensorFlow Ready!')
      } catch (error) {
        console.error('TensorFlow error:', error)
        setStatus('Error: ' + error.message)
      }
    }
    loadTF()
  }, [])

  const startCamera = async () => {
    if (!poseReady) {
      alert('TensorFlow still loading...')
      return
    }

    setStatus('Requesting camera...')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false
      })

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        
        videoRef.current.play()
          .then(() => {
            console.log('Video playing, starting pose detection')
            setCameraActive(true)
            setStatus('Detecting pose...')
            setTimeout(() => startPoseDetection(), 500)
          })
          .catch(e => console.error('Play error:', e))
      }
    } catch (err) {
      setStatus('Error: ' + err.message)
    }
  }

  const startPoseDetection = () => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas || !detectorRef.current) {
      console.error('Missing video, canvas, or detector')
      return
    }

    const ctx = canvas.getContext('2d')
    console.log('Starting pose detection loop')

    const detect = async () => {
      if (!cameraActive || !video || !detectorRef.current) return

      try {
        // Set canvas size to match video
        canvas.width = video.videoWidth || 640
        canvas.height = video.videoHeight || 480

        // Draw video to canvas
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

        // Get poses
        const poses = await detectorRef.current.estimatePoses(video)
        console.log('Poses detected:', poses.length)

        if (poses && poses.length > 0) {
          const keypoints = poses[0].keypoints
          console.log('Drawing skeleton...')

          // Draw skeleton
          ctx.strokeStyle = '#00FF00'
          ctx.lineWidth = 3
          ctx.fillStyle = '#00FF00'
          ctx.globalAlpha = 0.9

          // Draw connections
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

          // Draw joints
          keypoints.forEach((kp, idx) => {
            if (kp && kp.score > 0.3) {
              ctx.beginPath()
              ctx.arc(kp.x, kp.y, 5, 0, Math.PI * 2)
              ctx.fill()
            }
          })

          ctx.globalAlpha = 1.0

          // Draw bar
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

        // Draw metrics
        ctx.fillStyle = '#FF5C4D'
        ctx.font = 'bold 26px Arial'
        ctx.shadowColor = '#000'
        ctx.shadowBlur = 4

        ctx.fillText('0.95 m/s', 20, 50)
        ctx.font = '18px Arial'
        ctx.fillText('1250W', 20, 80)
        ctx.fillText('1RM: 130kg', 20, 110)
        ctx.fillText('Reps: 5', 20, 140)

        setStatus('Tracking...')

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

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0D1117', color: '#F0F6FC', padding: '20px' }}>
      <h1>RUNNOZ VBT {poseReady ? '✅' : '⏳'}</h1>
      <p style={{ fontSize: '16px', fontWeight: 'bold', color: '#FF5C4D' }}>Status: {status}</p>

      {!cameraActive && (
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

      <div style={{
        position: 'relative',
        width: '100%',
        maxWidth: '600px',
        backgroundColor: '#000',
        borderRadius: '8px',
        overflow: 'hidden',
        border: '3px solid #FF5C4D',
        marginBottom: '20px'
      }}>
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          style={{
            width: '100%',
            height: 'auto',
            display: 'block',
            minHeight: '300px',
            position: 'absolute',
            top: 0,
            left: 0
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
              fontSize: '14px',
              fontWeight: 'bold',
              zIndex: 20
            }}
          >
            STOP
          </button>
        )}
      </div>
    </div>
  )
}