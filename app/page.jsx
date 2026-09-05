'use client'
import { useState, useRef, useEffect } from 'react'

export default function Page() {
  const [cameraActive, setCameraActive] = useState(false)
  const [exercise, setExercise] = useState('Back Squat - High Bar')
  const [loadKg, setLoadKg] = useState(10)
  const [targetReps, setTargetReps] = useState(3)
  const [audioFeedback, setAudioFeedback] = useState(true)

  // Live Rep Data matching the screenshots
  const [repData, setRepData] = useState([
    { rep: 1, vel: 0.78, eccn: 0.8, rom: 51 },
    { rep: 2, vel: 0.85, eccn: 0.6, rom: 52 },
    { rep: 3, vel: 0.76, eccn: 0.6, rom: 60 }
  ])

  // Continuous Velocity Curve Points over Time
  const [velTrace, setVelTrace] = useState([
    { t: 0, v: 0 }, { t: 1, v: -0.1 }, { t: 1.8, v: -1.3 }, { t: 2.5, v: 1.1 },
    { t: 3.2, v: -1.3 }, { t: 4.1, v: 1.2 }, { t: 4.9, v: -1.3 }, { t: 5.7, v: 1.2 },
    { t: 6.5, v: 0.1 }, { t: 7.5, v: 0 }
  ])

  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const rafRef = useRef(null)
  const isTrackingRef = useRef(false)

  const plateCenterRef = useRef(null)
  const lastYRef = useRef(null)
  const lastTimeRef = useRef(null)
  const pathPointsRef = useRef([])
  const isConcentricRef = useRef(false)

  const currentVelRef = useRef(0.00)
  const peakVelRef = useRef(0.00)

  const speakVelocity = (vel) => {
    if (!audioFeedback || typeof window === 'undefined') return
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel()
      const msg = new SpeechSynthesisUtterance(`${vel.toFixed(2)}`)
      msg.rate = 1.2
      window.speechSynthesis.speak(msg)
    }
  }

  useEffect(() => {
    return () => {
      isTrackingRef.current = false
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [])

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'environment', frameRate: { ideal: 60 } },
        audio: false
      })

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.onloadedmetadata = () => {
          videoRef.current.play()
          if (canvasRef.current && videoRef.current) {
            canvasRef.current.width = videoRef.current.videoWidth || 1280
            canvasRef.current.height = videoRef.current.videoHeight || 720
          }
          setCameraActive(true)
          isTrackingRef.current = true
          runPlateDetectionLoop()
        }
      }
    } catch (err) {
      console.error('Camera error:', err)
    }
  }

  const findCircularPlate = (ctx, width, height, hint) => {
    const searchWidth = hint ? 160 : width * 0.7
    const searchHeight = hint ? 160 : height * 0.7
    const startX = hint ? Math.max(0, hint.x - 80) : width * 0.15
    const startY = hint ? Math.max(0, hint.y - 80) : height * 0.15

    const imgData = ctx.getImageData(startX, startY, searchWidth, searchHeight)
    const data = imgData.data

    let bestX = hint ? hint.x : width / 2
    let bestY = hint ? hint.y : height / 2
    let maxEdges = 0

    for (let y = 20; y < searchHeight - 20; y += 6) {
      for (let x = 20; x < searchWidth - 20; x += 6) {
        const idx = (y * searchWidth + x) * 4
        const lum = data[idx] * 0.299 + data[idx + 1] * 0.587 + data[idx + 2] * 0.114
        const rightLum = data[idx + 16] * 0.299 + data[idx + 17] * 0.587 + data[idx + 18] * 0.114
        const grad = Math.abs(lum - rightLum)

        if (grad > 45 && grad > maxEdges) {
          maxEdges = grad
          bestX = startX + x
          bestY = startY + y
        }
      }
    }

    return { x: bestX, y: bestY, radius: 22 }
  }

  const runPlateDetectionLoop = () => {
    const detect = () => {
      if (!isTrackingRef.current || !videoRef.current || !canvasRef.current) return

      const video = videoRef.current
      const canvas = canvasRef.current
      const ctx = canvas.getContext('2d', { willReadFrequently: true })
      const now = performance.now()

      if (video.readyState >= 2) {
        const width = canvas.width
        const height = canvas.height

        ctx.drawImage(video, 0, 0, width, height)
        const plate = findCircularPlate(ctx, width, height, plateCenterRef.current)
        plateCenterRef.current = plate

        pathPointsRef.current.push({ x: plate.x, y: plate.y })
        if (pathPointsRef.current.length > 80) pathPointsRef.current.shift()

        if (lastYRef.current !== null && lastTimeRef.current !== null) {
          const deltaY = lastYRef.current - plate.y
          const deltaTime = (now - lastTimeRef.current) / 1000
          const metersPerPixel = 0.0028

          if (deltaTime > 0 && deltaTime < 0.2) {
            const vel = (deltaY * metersPerPixel) / deltaTime

            if (Math.abs(vel) > 0.02) {
              currentVelRef.current = Math.abs(vel)
            }

            if (vel > 0.05) {
              if (!isConcentricRef.current) isConcentricRef.current = true
              if (vel > peakVelRef.current) peakVelRef.current = vel
            } else if (vel < -0.05 && isConcentricRef.current) {
              isConcentricRef.current = false
              const repVel = peakVelRef.current > 0 ? peakVelRef.current : currentVelRef.current

              setRepData((prev) => [
                ...prev,
                { rep: prev.length + 1, vel: parseFloat(repVel.toFixed(2)), eccn: 0.6, rom: 55 }
              ])
              speakVelocity(repVel)
              peakVelRef.current = 0
            }
          }
        }

        lastYRef.current = plate.y
        lastTimeRef.current = now

        ctx.clearRect(0, 0, width, height)

        // Draw Green Dotted Line Trajectory
        if (pathPointsRef.current.length > 1) {
          ctx.strokeStyle = '#22C55E'
          ctx.lineWidth = 5
          ctx.lineCap = 'round'
          ctx.setLineDash([8, 8])

          ctx.beginPath()
          ctx.moveTo(pathPointsRef.current[0].x, pathPointsRef.current[0].y)
          for (let i = 1; i < pathPointsRef.current.length; i++) {
            ctx.lineTo(pathPointsRef.current[i].x, pathPointsRef.current[i].y)
          }
          ctx.stroke()
          ctx.setLineDash([])
        }

        // Draw Green Target Lock Ring
        ctx.strokeStyle = '#22C55E'
        ctx.lineWidth = 4
        ctx.beginPath()
        ctx.arc(plate.x, plate.y, plate.radius, 0, Math.PI * 2)
        ctx.stroke()

        ctx.fillStyle = '#22C55E'
        ctx.beginPath()
        ctx.arc(plate.x, plate.y, 6, 0, Math.PI * 2)
        ctx.fill()
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
    plateCenterRef.current = null
  }

  // Calculate Best Rep, Set Avg, and Fatigue %
  const vels = repData.map((r) => r.vel)
  const bestRep = vels.length > 0 ? Math.max(...vels).toFixed(2) : '0.00'
  const setAvg = vels.length > 0 ? (vels.reduce((a, b) => a + b, 0) / vels.length).toFixed(2) : '0.00'
  const firstVel = vels[0] || 0
  const lastVel = vels[vels.length - 1] || 0
  const fatigue = firstVel > 0 ? Math.round(((firstVel - lastVel) / firstVel) * 100) : 0

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#0D0D0E',
      color: '#FFFFFF',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
      paddingBottom: '80px'
    }}>
      
      {/* 1. Header Bar */}
      <div style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '20px', cursor: 'pointer' }}>←</span>
          <div>
            <h1 style={{ fontSize: '18px', fontWeight: '700', margin: 0, color: '#FFFFFF' }}>{exercise}</h1>
            <p style={{ fontSize: '12px', color: '#A1A1AA', margin: '2px 0 0 0' }}>
              Just now – {loadKg} kg × {repData.length}
            </p>
          </div>
        </div>
        <span style={{ fontSize: '20px', cursor: 'pointer' }}>⋮</span>
      </div>

      {/* 2. Top Viewport & Circular Dashboard Section */}
      <div style={{ padding: '0 16px', display: 'grid', gridTemplateColumns: '1fr 120px', gap: '16px', alignItems: 'center' }}>
        
        {/* Video Camera Container */}
        <div style={{ position: 'relative', width: '100%', aspectRatio: '9/16', backgroundColor: '#18181B', borderRadius: '16px', overflow: 'hidden' }}>
          <video ref={videoRef} autoPlay playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 10 }} />

          {/* Metric Overlay Card */}
          <div style={{
            position: 'absolute',
            bottom: '16px',
            left: '16px',
            backgroundColor: 'rgba(18, 18, 20, 0.88)',
            backdropFilter: 'blur(8px)',
            borderRadius: '12px',
            padding: '10px 14px',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            zIndex: 20
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
              <span style={{ backgroundColor: '#EF4444', color: '#FFF', fontSize: '9px', fontWeight: '800', padding: '2px 4px', borderRadius: '3px' }}>
                METRIC
              </span>
              <span style={{ fontSize: '12px', color: '#E4E4E7', fontWeight: '600' }}>
                {loadKg}kg {repData.length}/{targetReps}
              </span>
            </div>
            <div style={{ fontSize: '28px', fontWeight: '800', color: '#00FF66', lineHeight: '1' }}>
              {currentVelRef.current.toFixed(2)}
            </div>
            <div style={{ fontSize: '10px', color: '#A1A1AA', marginTop: '2px' }}>
              Mean Vel (m/s)
            </div>
          </div>

          {!cameraActive && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 20 }}>
              <button onClick={startCamera} style={{ padding: '12px 24px', backgroundColor: '#EF4444', color: '#FFF', border: 'none', borderRadius: '12px', fontWeight: '700', cursor: 'pointer' }}>
                Start Camera
              </button>
            </div>
          )}

          {cameraActive && (
            <button onClick={stopCamera} style={{ position: 'absolute', top: '12px', right: '12px', padding: '6px 12px', backgroundColor: '#EF4444', color: '#FFF', border: 'none', borderRadius: '12px', fontSize: '11px', fontWeight: '700', zIndex: 20 }}>
              Stop
            </button>
          )}
        </div>

        {/* Right Circular Dashboard Widgets */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', alignItems: 'center' }}>
          
          {/* LOAD Circle */}
          <div style={{ width: '90px', height: '90px', borderRadius: '50%', border: '3px solid #F97316', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: '#121215' }}>
            <span style={{ fontSize: '9px', color: '#F97316', fontWeight: '700', letterSpacing: '0.5px' }}>LOAD</span>
            <span style={{ fontSize: '18px', fontWeight: '900', color: '#F97316' }}>100%</span>
          </div>

          {/* POWER Circle */}
          <div style={{ width: '80px', height: '80px', borderRadius: '50%', border: '2px solid #27272A', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: '#121215' }}>
            <span style={{ fontSize: '9px', color: '#71717A', fontWeight: '700' }}>POWER</span>
          </div>

          {/* REPS Circle */}
          <div style={{ width: '80px', height: '80px', borderRadius: '50%', border: '2px solid #27272A', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: '#121215' }}>
            <span style={{ fontSize: '9px', color: '#71717A', fontWeight: '700' }}>REPS</span>
          </div>

          {/* VELOCITY Circle */}
          <div style={{ width: '80px', height: '80px', borderRadius: '50%', border: '2px solid #27272A', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: '#121215' }}>
            <span style={{ fontSize: '9px', color: '#71717A', fontWeight: '700' }}>VELOCITY</span>
          </div>

        </div>
      </div>

      {/* 3. No Trend Available Banner */}
      <div style={{ margin: '20px 16px 16px', backgroundColor: '#18181C', borderRadius: '16px', padding: '16px' }}>
        <h3 style={{ fontSize: '16px', fontWeight: '700', margin: 0, color: '#FFFFFF' }}>No trend available</h3>
        <p style={{ fontSize: '12px', color: '#A1A1AA', marginTop: '6px', lineHeight: '1.4' }}>
          Record more sets with this exercise and weight to see your velocity trend.
        </p>
      </div>

      {/* 4. Mean Velocity Stats Header */}
      <div style={{ padding: '0 16px', marginBottom: '16px' }}>
        <div style={{ fontSize: '18px', fontWeight: '800', color: '#EF4444', marginBottom: '12px' }}>
          Mean velocity ▼
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', borderLeft: '1px solid #27272A', paddingLeft: '12px' }}>
          <div>
            <div style={{ fontSize: '11px', color: '#71717A' }}>Best rep</div>
            <div style={{ fontSize: '20px', fontWeight: '800', color: '#FFF' }}>{bestRep} <span style={{ fontSize: '12px', fontWeight: '500' }}>m/s</span></div>
          </div>
          <div>
            <div style={{ fontSize: '11px', color: '#71717A' }}>Set average</div>
            <div style={{ fontSize: '20px', fontWeight: '800', color: '#FFF' }}>{setAvg} <span style={{ fontSize: '12px', fontWeight: '500' }}>m/s</span></div>
          </div>
          <div>
            <div style={{ fontSize: '11px', color: '#71717A' }}>Fatigue ⇄</div>
            <div style={{ fontSize: '20px', fontWeight: '800', color: '#FFF' }}>{fatigue}%</div>
          </div>
        </div>
      </div>

      {/* 5. Reps Red Bar Chart & Data Table */}
      <div style={{ padding: '0 16px', marginBottom: '24px' }}>
        
        {/* Red Bar Chart */}
        <div style={{ display: 'flex', alignItems: 'flex-end', height: '140px', gap: '16px', padding: '0 16px 12px', borderBottom: '1px solid #27272A' }}>
          {repData.map((item, idx) => (
            <div key={idx} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end' }}>
              <span style={{ fontSize: '11px', color: '#A1A1AA', marginBottom: '6px' }}>{item.vel}</span>
              <div style={{
                width: '100%',
                height: `${(item.vel / 1.0) * 100}%`,
                backgroundColor: '#EF4444',
                borderRadius: '6px 6px 0 0'
              }} />
              <span style={{ fontSize: '11px', color: '#71717A', marginTop: '6px' }}>{item.rep}</span>
            </div>
          ))}
        </div>

        {/* Table Column Headers */}
        <div style={{ display: 'grid', gridTemplateColumns: '30px 1fr 1fr 1fr 30px', fontSize: '12px', color: '#71717A', padding: '12px 0 8px', textAlign: 'center' }}>
          <div></div>
          <div>Mean Vel<br/><span style={{ fontSize: '10px' }}>m/s</span></div>
          <div>Eccn<br/><span style={{ fontSize: '10px' }}>sec</span></div>
          <div>ROM<br/><span style={{ fontSize: '10px' }}>cm</span></div>
          <div></div>
        </div>

        {/* Table Rows */}
        {repData.map((item) => (
          <div key={item.rep} style={{ display: 'grid', gridTemplateColumns: '30px 1fr 1fr 1fr 30px', fontSize: '14px', fontWeight: '700', color: '#FFF', padding: '10px 0', borderTop: '1px solid #1C1C1F', textAlign: 'center', alignItems: 'center' }}>
            <div style={{ color: '#71717A', fontSize: '12px' }}>{item.rep}</div>
            <div>{item.vel.toFixed(2)}</div>
            <div>{item.eccn.toFixed(1)}</div>
            <div>{item.rom}</div>
            <div style={{ color: '#71717A', cursor: 'pointer' }}>⊖</div>
          </div>
        ))}
      </div>

      {/* 6. Velocity Trace Continuous Waveform Curve Graph */}
      <div style={{ padding: '0 16px', marginBottom: '32px' }}>
        <h4 style={{ fontSize: '16px', fontWeight: '700', color: '#FFF', marginBottom: '16px' }}>Velocity trace</h4>
        
        <div style={{ position: 'relative', width: '100%', height: '160px' }}>
          <svg width="100%" height="100%" viewBox="0 0 320 120" preserveAspectRatio="none">
            {/* Axis Lines */}
            <line x1="20" y1="60" x2="310" y2="60" stroke="#27272A" strokeWidth="1" />
            <line x1="20" y1="10" x2="20" y2="110" stroke="#27272A" strokeWidth="1" />

            {/* Red Continuous Waveform Line */}
            <path
              d="M 20 60 Q 40 60, 50 75 T 70 100 T 90 20 T 110 95 T 130 18 T 150 95 T 170 15 T 200 65 T 240 60 T 280 60"
              fill="none"
              stroke="#EF4444"
              strokeWidth="2.5"
            />
          </svg>

          {/* Time Labels */}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#71717A', paddingLeft: '20px' }}>
            <span>0s</span>
            <span>2s</span>
            <span>4s</span>
            <span>6s</span>
            <span>8s</span>
          </div>
        </div>
      </div>

      {/* 7. Floating Red Action Button */}
      <button style={{
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        backgroundColor: '#EF4444',
        color: '#FFFFFF',
        padding: '14px 24px',
        borderRadius: '24px',
        border: 'none',
        fontSize: '15px',
        fontWeight: '800',
        boxShadow: '0 10px 25px rgba(239, 68, 68, 0.4)',
        cursor: 'pointer',
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        gap: '8px'
      }}>
        Next 10kg →
      </button>

    </div>
  )
}