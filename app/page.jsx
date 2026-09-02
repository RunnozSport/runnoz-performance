'use client'
import { useState, useRef } from 'react'

export default function Page() {
  const [status, setStatus] = useState('Ready')
  const videoRef = useRef(null)

  const testCamera = async () => {
    setStatus('Requesting camera...')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false
      })
      setStatus('Camera OK - Stream active')
      if (videoRef.current) {
        videoRef.current.srcObject = stream
      }
    } catch (err) {
      setStatus('Error: ' + err.message)
    }
  }

  return (
    <div style={{minHeight: '100vh', backgroundColor: '#0D1117', color: '#F0F6FC', padding: '20px'}}>
      <h1>Camera Test</h1>
      <p>Status: {status}</p>
      
      <button 
        onClick={testCamera}
        style={{width: '100%', padding: '40px', backgroundColor: '#FF5C4D', color: '#FFF', border: 'none', borderRadius: '8px', fontSize: '18px', fontWeight: '700', cursor: 'pointer', marginBottom: '20px'}}
      >
        TEST CAMERA
      </button>

      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        style={{width: '100%', maxHeight: '600px', backgroundColor: '#000', borderRadius: '8px', border: '2px solid #FF5C4D'}}
      />
    </div>
  )
}