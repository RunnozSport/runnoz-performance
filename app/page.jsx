'use client'

import { useState, useRef } from 'react'
import { Zap, Home, Camera, StopCircle } from 'lucide-react'

export default function Page() {
  const [activeTab, setActiveTab] = useState('lift')
  const [cameraActive, setCameraActive] = useState(false)
  const videoRef = useRef(null)

  const startCamera = async () => {
    try {
      console.log('Step 1: Getting permission...')
      
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false
      })
      
      console.log('Step 2: Stream obtained:', stream)
      console.log('Step 3: videoRef.current exists?', videoRef.current ? 'YES' : 'NO')
      
      if (!videoRef.current) {
        throw new Error('Video element not found')
      }
      
      videoRef.current.srcObject = stream
      console.log('Step 4: srcObject set')
      
      videoRef.current.play().then(() => {
        console.log('Step 5: Video playing')
        setCameraActive(true)
      }).catch(err => {
        console.error('Play error:', err)
      })
      
    } catch (err) {
      console.error('Full error:', err)
      alert('Camera Error:\n' + err.message)
    }
  }

  const stopCamera = () => {
    console.log('Stopping camera...')
    if (videoRef.current && videoRef.current.srcObject) {
      videoRef.current.srcObject.getTracks().forEach(t => {
        console.log('Stopping track:', t)
        t.stop()
      })
      videoRef.current.srcObject = null
    }
    setCameraActive(false)
    console.log('Camera stopped')
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <Zap size={20} color="#FF5C4D" />
        <h1 style={styles.title}>RUNNOZ Performance</h1>
      </div>

      <div style={styles.tabs}>
        <button onClick={() => setActiveTab('home')} style={{...styles.tab, ...(activeTab === 'home' && styles.tabActive)}}>
          <Home size={16} /> Home
        </button>
        <button onClick={() => setActiveTab('lift')} style={{...styles.tab, ...(activeTab === 'lift' && styles.tabActive)}}>
          <Camera size={16} /> Lift
        </button>
      </div>

      <div style={styles.content}>
        <h2>Barbell Velocity Tracking</h2>

        {cameraActive ? (
          <div style={styles.cameraBox}>
            <video 
              ref={videoRef}
              autoPlay={true}
              playsInline={true}
              muted={true}
              style={styles.video}
            />
            <button onClick={stopCamera} style={styles.stopBtn}>
              <StopCircle size={18} /> STOP
            </button>
          </div>
        ) : (
          <button onClick={startCamera} style={styles.startBtn}>
            <Camera size={32} />
            START REAR CAMERA
          </button>
        )}

        <div style={styles.form}>
          <h3>Log Lift</h3>
          <input type="number" placeholder="Weight (kg)" defaultValue="30" style={styles.inp} />
          <input type="number" placeholder="Reps" defaultValue="5" style={styles.inp} />
          <input type="number" placeholder="Speed (m/s)" defaultValue="0.98" step="0.01" style={styles.inp} />
          <button style={styles.logBtn}>LOG LIFT</button>
        </div>
      </div>
    </div>
  )
}

const styles = {
  container: { minHeight: '100vh', backgroundColor: '#0D1117', color: '#F0F6FC' },
  header: { display: 'flex', alignItems: 'center', gap: '12px', padding: '16px 20px', borderBottom: '2px solid #FF5C4D', backgroundColor: '#161B22' },
  title: { fontSize: '18px', fontWeight: '700', margin: 0 },
  tabs: { display: 'flex', gap: '8px', padding: '12px 20px', borderBottom: '1px solid #30363D' },
  tab: { display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', backgroundColor: 'transparent', color: '#8B949E', border: '1px solid #30363D', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' },
  tabActive: { backgroundColor: '#FF5C4D', color: '#FFF', borderColor: '#FF5C4D' },
  content: { padding: '20px' },
  startBtn: { width: '100%', padding: '60px 20px', backgroundColor: '#FF5C4D', color: '#FFF', border: 'none', borderRadius: '8px', fontSize: '18px', fontWeight: '700', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px', marginBottom: '20px' },
  cameraBox: { position: 'relative', backgroundColor: '#000', borderRadius: '8px', overflow: 'hidden', marginBottom: '20px', border: '2px solid #FF5C4D', width: '100%' },
  video: { width: '100%', height: 'auto', display: 'block', maxHeight: '600px', backgroundColor: '#000' },
  stopBtn: { position: 'absolute', bottom: '16px', right: '16px', backgroundColor: '#FF5C4D', color: '#FFF', border: 'none', padding: '10px 14px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '600', fontSize: '12px' },
  form: { backgroundColor: '#161B22', padding: '20px', borderRadius: '8px', border: '1px solid #30363D' },
  inp: { width: '100%', backgroundColor: '#0D1117', color: '#F0F6FC', border: '1px solid #30363D', padding: '10px 12px', borderRadius: '6px', fontSize: '13px', marginBottom: '10px', boxSizing: 'border-box' },
  logBtn: { width: '100%', padding: '12px', backgroundColor: '#FF5C4D', color: '#FFF', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '700', fontSize: '14px', marginTop: '8px' },
}