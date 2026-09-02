'use client'
import { useState, useRef } from 'react'

export default function Page() {
  const [status, setStatus] = useState('Click button to test')
  const videoRef = useRef(null)

  const testCamera = async () => {
    setStatus('Testing camera access...')
    
    try {
      // Simple test - just request camera
      console.log('Requesting camera...')
      
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false
      })
      
      console.log('SUCCESS! Stream:', stream)
      setStatus('✅ Camera working! Stream active')
      
      // Try to display it
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.play()
      }
      
    } catch (error) {
      console.error('FAILED:', error)
      setStatus('❌ Error: ' + error.name + ' - ' + error.message)
    }
  }

  return (
    <div style={{minHeight: '100vh', backgroundColor: '#0D1117', color: '#F0F6FC', padding: '20px'}}>
      <h1>Camera Diagnostic Test</h1>
      
      <div style={{backgroundColor: '#161B22', padding: '20px', borderRadius: '8px', marginBottom: '20px'}}>
        <p style={{fontSize: '16px', fontWeight: 'bold'}}>Status: {status}</p>
      </div>

      <button 
        onClick={testCamera}
        style={{
          width: '100%',
          padding: '40px 20px',
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
        TEST CAMERA
      </button>

      <div style={{backgroundColor: '#000', borderRadius: '8px', overflow: 'hidden', border: '2px solid #FF5C4D'}}>
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
            backgroundColor: '#000'
          }}
        />
      </div>

      <p