{cameraActive ? (
  <div style={{position: 'relative', marginBottom: '20px', width: '100%', maxWidth: '100%'}}>
    <div style={{position: 'relative', backgroundColor: '#000', borderRadius: '8px', overflow: 'hidden', border: '2px solid #FF5C4D', width: '100%', paddingBottom: '75%'}}>
      <video 
        ref={videoRef}
        autoPlay={true}
        playsInline={true}
        muted={true}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          display: 'block',
          objectFit: 'cover'
        }}
      />
      <canvas 
        ref={canvasRef}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%'
        }}
      />
      <button 
        onClick={stopCamera}
        style={{
          position: 'absolute',
          bottom: '16px',
          right: '16px',
          backgroundColor: '#FF5C4D',
          color: '#FFF',
          border: 'none',
          padding: '10px 14px',
          borderRadius: '6px',
          cursor: 'pointer',
          fontSize: '12px',
          fontWeight: '600',
          zIndex: 10
        }}
      >
        STOP
      </button>
    </div>
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
    START VBT TRACKING
  </button>
)}