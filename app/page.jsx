'use client'
import { useState, useRef, useEffect } from 'react'

export default function Page() {
  const [status, setStatus] = useState('Ready')
  const [cameraActive, setCameraActive] = useState(false)
  const videoRef = useRef(null)

  // Log when ref is attached
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

      // Make absolutely sure ref exists
      if (!videoRef.current) {
        console.error('VIDEO REF IS NULL!')
        setStatus('Error: Video element not found')
        return
      }

      console.log('Setting srcObject...')
      videoRef.current.srcObject = stream

      // Try to play immediately
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
    if (videoRef.current?.srcObject) {
      videoRef.current.srcObject.getTracks().forEach(t => t.stop())
    }
    setCameraActive(false)
    setStatus('Stopped')
  }

  return (
    <div style={{