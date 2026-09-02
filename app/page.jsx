'use client'
import { useState, useRef, useEffect } from 'react'

export default function Page() {
  const [status, setStatus] = useState('Loading AI Models...')
  const [cameraActive, setCameraActive] = useState(false)
  const [poseReady, setPoseReady] = useState(false)

  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const detectorRef = useRef(null)
  const rafRef = useRef(null)
  const isTrackingRef = useRef(false)

  useEffect(() => {
    let isMounted = true

    const initTensorFlow = async () => {
      try {
        const tf = await import('@tensorflow/tfjs')
        await import('@tensorflow/tfjs-backend-webgl')
        const poseDetection = await import('@tensorflow-models/pose-detection')

        await tf.ready()
        await tf.setBackend('webgl')

        // Use MoveNet - lighter, faster, and reliable across all WebGL browsers
        const detector = await poseDetection.createDetector(
          poseDetection.SupportedModels.MoveNet,
          {
            modelType: poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING
          }
        )

        if (isMounted) {
          detectorRef.current = detector
          setPoseReady(true)
          setStatus('✅ Ready - Click START')
          console.log('TFJS & MoveNet loaded successfully')
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
          setStatus('🎥 AI Tracking Active')
          runDetectionLoop()
        }
      }
    } catch (err) {
      console.error('Camera Access Error:', err)
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

        // Synchronize canvas size to video frame size
        if (canvas.width !== video.videoWidth && video.videoWidth > 0) {
          canvas.width = video.videoWidth
          canvas.height = video.videoHeight
        }

        try {
          const poses = await detector.estimatePoses(video)

          // Clear previous canvas drawing
          ctx.clearRect(0, 0, canvas.width, canvas.height)

          if (poses && poses.length > 0 && poses[0].keypoints) {
            const keypoints = poses[0].keypoints

            // 1. Draw Green Skeleton Lines
            const connections = [
              [5, 7], [7, 9], [6, 8], [8, 10],   // Arms
              [5, 6], [5, 11], [6, 12], [11, 12], // Torso
              [11, 13], [13, 15], [12, 14], [14, 16] // Legs
            ]

            ctx.strokeStyle = '#00FF00'
            ctx.lineWidth = 4

            connections.forEach(([start, end]) => {
              const startKp = keypoints[start]
              const endKp = keypoints[end]
              if (startKp && endKp && (startKp.score || 0) > 0.3 && (endKp.score || 0) > 0.3) {
                ctx.beginPath()
                ctx.moveTo(startKp.x, startKp.y)
                ctx.lineTo(endKp.x, endKp.y)
                ctx.stroke()
              }
            })

            // 2. Draw Green Joints
            ctx.fillStyle = '#00FF00'
            keypoints.forEach((kp) => {
              if (kp && (kp.score || 0) > 0.3) {
                ctx.beginPath()
                ctx.arc(kp.x, kp.y, 6, 0, Math.PI * 2)
                ctx.fill()
              }
            })

            // 3. Draw Red Bar Between Wrists (Keypoints 9 & 10 in MoveNet)
            const leftWrist = keypoints[9]
            const rightWrist = keypoints[10]
            if (leftWrist && rightWrist && (leftWrist.score || 0) > 0.3 && (rightWrist.score || 0) > 0.3) {
              ctx.strokeStyle = '#FF5C4D'
              ctx.lineWidth = 6
              ctx.beginPath()
              ctx.moveTo(leftWrist.x, leftWrist.y)
              ctx.lineTo(rightWrist.x, rightWrist.y)
              ctx.stroke()
            }
          }

          // 4. Draw Metrics Text
          ctx.fillStyle = '#FF5C4D'
          ctx.font = 'bold 24px Arial'
          ctx.shadowColor = '#000000'
          ctx.shadowBlur = 4
          ctx.fillText('0.95 m/s', 20, 40)
          ctx.font = '16px Arial'
          ctx.fillText('1250W', 20, 65)
          ctx.fillText('1RM: 130kg', 20, 90)
          ctx.fillText('Reps: 5', 20, 115)
        } catch (err) {
          console.error('Frame pose estimation error:', err)
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
      <p style={{ fontSize: '16px', fontWeight: 'bold', color: '#FF5C4D', marginBottom: '20px' }}>
        {status}
      </p>

      {!cameraActive && (
        <button
          onClick={startCamera}
          disabled={!poseReady}
          style={{
            width: '100%',
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