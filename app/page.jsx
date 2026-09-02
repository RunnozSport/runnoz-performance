const drawVBT = () => {
  const canvas = canvasRef.current
  const video = videoRef.current
  if (!canvas || !video) return

  const ctx = canvas.getContext('2d')

  const draw = () => {
    if (!cameraActive) return

    // Make sure canvas size matches video
    if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
      canvas.width = video.videoWidth || 640
      canvas.height = video.videoHeight || 480
    }

    // Draw video frame to canvas
    try {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    } catch (e) {
      console.error('Draw error:', e)
    }

    // Draw demo skeleton (green)
    ctx.strokeStyle = '#00FF00'
    ctx.lineWidth = 3
    ctx.fillStyle = '#00FF00'

    const w = canvas.width
    const h = canvas.height

    // Skeleton joints
    const joints = [
      { x: w * 0.2, y: h * 0.2 },
      { x: w * 0.8, y: h * 0.2 },
      { x: w * 0.15, y: h * 0.45 },
      { x: w * 0.85, y: h * 0.45 },
      { x: w * 0.1, y: h * 0.7 },
      { x: w * 0.9, y: h * 0.7 },
      { x: w * 0.5, y: h * 0.35 },
      { x: w * 0.5, y: h * 0.8 },
    ]

    // Draw connections
    const connections = [
      [0, 2], [1, 3], [2, 4], [3, 5], [0, 1], [0, 6], [1, 6], [6, 7],
    ]

    connections.forEach(([start, end]) => {
      ctx.beginPath()
      ctx.moveTo(joints[start].x, joints[start].y)
      ctx.lineTo(joints[end].x, joints[end].y)
      ctx.stroke()
    })

    // Draw circles at joints
    joints.forEach((j) => {
      ctx.beginPath()
      ctx.arc(j.x, j.y, 6, 0, Math.PI * 2)
      ctx.fill()
    })

    // Draw bar (red line)
    ctx.strokeStyle = '#FF5C4D'
    ctx.lineWidth = 5
    ctx.beginPath()
    ctx.moveTo(joints[4].x, joints[4].y)
    ctx.lineTo(joints[5].x, joints[5].y)
    ctx.stroke()

    // Simulate velocity
    const simulatedVelocity = 0.85 + Math.sin(Date.now() / 1000) * 0.15
    const weight = 30
    const reps = Math.floor((Date.now() % 10000) / 1000)
    const estimated1RM = weight * (1 + reps / 30)
    const power = (weight * 9.81 * simulatedVelocity) / 1000

    // Draw metrics
    ctx.fillStyle = '#FF5C4D'
    ctx.font = 'bold 24px Arial'
    ctx.shadowColor = '#000'
    ctx.shadowBlur = 3

    ctx.fillText(`Speed: ${simulatedVelocity.toFixed(2)} m/s`, 20, 50)
    ctx.font = '18px Arial'
    ctx.fillText(`Power: ${power.toFixed(0)} W`, 20, 80)
    ctx.fillText(`1RM: ${estimated1RM.toFixed(0)} kg`, 20, 110)
    ctx.fillText(`Reps: ${reps}`, 20, 140)

    if (cameraActive) {
      rafRef.current = requestAnimationFrame(draw)
    }
  }

  draw()
}