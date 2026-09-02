'use client'
import { useState, useRef } from 'react'

export default function Page() {
  const [status, setStatus] = useState('Ready')
  const [cameraActive, setCameraActive] = useState(false)
  const videoRef = useRef(null)

  const startCamera = async () => {
    setStatus('Requesting camera...')
    console.log('Button clicked, requesting camera')
    
    try {
      console.log('getUserMedia call...')
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: 'environment',
          width: { ideal: 640 },
          height: { ideal: 480 }
        },
        audio: false
      })

      console.log('Stream received:', stream)
      setCameraActive(true)
      setStatus('Camera active!')

      if (videoRef.current) {
        console.log('Setting stream to video element')
        videoRef.current.srcObject = stream
        console.log('Stream set')
      }
    } catch (err) {
      console.error('Camera error:', err)
      setStatus('Error: ' + err.message)
    }
  }

  const stopCamera = () => {
    if (videoRef.current?.srcObject) {
      videoRef.current.srcObject.getTracks().forEach(t => t.stop())
    }
    setCameraActive(false)
    setStatus('Stopped')
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0D1117', color: '#F0F6FC', padding: '20px' }}>
      <h1>RUNNOZ VBT - Camera Test</h1>
      <p>Status: {status}</p>

      {cameraActive ? (
        <div>
          <video
            ref={videoRef}
            autoPlay={true}
            playsInline={true}
            muted={true}
            style={{
              width: '100%',
              maxWidth: '600px',
              height: 'auto',
              backgroundColor: '#000',
              border: '3px solid #FF5C4D',
              borderRadius: '8px',
              display: 'block',
              marginBottom: '20px'
            }}
          />
          <button
            onClick={stopCamera}
            style={{
              padding: '15px 30px',
              backgroundColor: '#FF5C4D',
              color: '#FFF',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '16px',
              fontWeight: 'bold'
            }}
          >
            STOP CAMERA
          </button>
        </div>
      ) : (
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

      <p style={{ fontSize: '12px', color: '#8B949E', marginTop: '20px' }}>
        Check browser console (F12) for debug logs
      </p>
    </div>
  )
}