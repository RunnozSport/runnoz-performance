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
  
  // Use a Ref to track active state inside animation frames without closure staleness
  const isTrackingRef = useRef(false)

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
        setStatus('✅ Ready - Click START')
        console.log('TensorFlow loaded')
      } catch (error) {
        setStatus('Error loading TensorFlow')
        console.error(error)
      }
    }
    loadTF()

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [])

  const startCamera = async () => {
    if (!poseReady) return
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false
      })

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        
        videoRef.current.onloadedmetadata = () => {
          if (canvasRef.current && videoRef.current) {
            canvasRef.current.width = videoRef.current.videoWidth
            canvasRef.current.height = videoRef.current.videoHeight
          }
          
          isTrackingRef.current = true
          setCameraActive(true)
          setStatus('Warming up AI...')
          warmupDetector()
        }
      }
    } catch (err) {
      setStatus('Camera error: ' + err.message)
    }
  }

  const warmupDetector = async () => {
    try {
      if (videoRef.current && detectorRef.current) {
        await detectorRef.current.estimatePoses(videoRef.current)
        setStatus('🎥 Tracking...')
        startPoseDetection()
      }
    } catch (error) {
      console.error('Warmup error:', error)
      setStatus('Detection error')
    }
  }

  const startPoseDetection = () => {
    const video = videoRef.current
    const canvas = canvasRef.current
    const detector = detectorRef.current

    if (!video || !canvas || !detector) return

    const ctx = canvas.getContext('2d')

    const detect = async () => {
      // Check ref instead of state to avoid stale closure issues
      if (!isTrackingRef.current) return

      try {
        if (video.readyState >= 2) {
          const poses = await detector.estimatePoses(video)

          ctx.clearRect(0, 0, canvas.width, canvas.height)

          if (poses && poses.length > 0) {
            const keypoints = poses[0].keypoints

            // 1. Draw GREEN skeleton
            ctx.strokeStyle = '#00FF00'
            ctx.lineWidth = 3
            ctx.fillStyle = '#00FF00'
            ctx.globalAlpha = 0.9

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

            ctx.globalAlpha = 1.0

            // 2. Draw RED bar between wrists
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

          // 3. Draw metrics text
          ctx.fillStyle = '#FF5C4D'
          ctx.font = 'bold 26px Arial'
          ctx.shadowColor = '#000'
          ctx.shadowBlur = 4
          ctx.fillText('0.95 m/s', 20, 50)
          ctx.font = '18px Arial'
          ctx.fillText('1250W', 20, 80)
          ctx.fillText('1RM: 130kg', 20, 110)
          ctx.fillText('Reps: 5', 20, 140)
        }
      } catch (error) {
        console.error('Detection error:', error)
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
      stream.getTracks().forEach(t => t.stop())
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
          {poseReady ? '▶ START VBT TRACKING' : 'LOADING AI...'}
        </button>
      )}

      <div style={{
        position: 'relative',
        width: '100%',
        maxWidth: '600px',
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
            minHeight: '300px'
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
            ⏹ STOP
          </button>
        )}
      </div>
    </div>
  )
}