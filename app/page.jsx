'use client'
import { useState, useRef, useEffect } from 'react'

export default function Page() {
  const [status, setStatus] = useState('Ready')
  const [cameraActive, setCameraActive] = useState(false)
  const videoRef = useRef(null)

  useEffect(() => {
    console.log('Component mounted, videoRef:', videoRef.current)
  }, [])

  const startCamera = async () => {
    setStatus('Requesting camera...')
    console.log('Button clicked')
    console.log('videoRef.current exists?', videoRef.current ? 'YES' : 'NO')
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: 'environment',
          width: { ideal: 640 },
          height: { ideal: 480 }
        },
        audio: false
      })

      console.log('Stream received:', stream.active)

      if (!videoRef.current) {
        console.error('VIDEO REF IS NULL!')
        setStatus('Error: Video element not found')
        return
      }

      console.log('Setting srcObject...')
      videoRef.current.srcObject = stream

      console.log('Attempting to play video...')
      videoRef.current.play()
        .then(() => {
          console.log('✅ VIDEO IS PLAYING!')
          setCameraActive(true)
          setStatus('Camera active!')
        })
        .catch(e => {
          console.error('Play failed:', e)
          setStatus('Play error: ' + e.message)
        })

    } catch (err) {
      console.error('getUserMedia error:', err)
      setStatus('Error: ' + err.message)
    }
  }

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      videoRef.current.srcObject.getTracks().forEach(t => t.stop())
    }
    setCameraActive(false)
    setStatus('Stopped')
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0D1117', color: '#F0F6FC', padding: '20px' }}>
      <h1>RUNNOZ VBT</h1>
      <p style={{ fontSize: '16px', fontWeight: 'bold', color: '#FF5C4D' }}>Status: {status}</p>

      {!cameraActive && (
        <button
          onClick={startCamera}
          style={{
            width: '100%',
            padding: '60px 20px',
            backgroundColor: '#FF5C4D',
            color: '#FFF',
            border: 'none',
            borderRadius: '8px',
            fontSize: '18px',
            fontWeight: '700',
            cursor: 'pointer',
            marginBottom: '20px'
          }}
        >
          START CAMERA
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
            minHeight: '300px'
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
              zIndex: 10
            }}
          >
            STOP
          </button>
        )}
      </div>

      <p style={{ fontSize: '12px', color: '#8B949E' }}>
        Check console - look for "✅ VIDEO IS PLAYING!"
      </p>
    </div>
  )
}