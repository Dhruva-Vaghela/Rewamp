import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

export default function LandingPage() {
  const [isEntering, setIsEntering] = useState(false)
  const navigate = useNavigate()

  const handleEnter = () => {
    if (isEntering) return
    setIsEntering(true)
    // Wait for the cinematic 3D door swing & camera zoom-in before routing
    setTimeout(() => {
      navigate('/library')
    }, 1300)
  }

  return (
    <div
      className="cinematic-landing"
      style={{
        position: 'fixed',
        inset: 0,
        width: '100vw',
        height: '100vh',
        overflow: 'hidden',
        backgroundColor: '#070604',
        userSelect: 'none',
      }}
    >
      {/* ── 3D Viewport & Camera Scene ── */}
      <div
        className={`scene-camera ${isEntering ? 'camera-zoom-in' : ''}`}
        style={{
          position: 'absolute',
          inset: 0,
          perspective: 1200,
          perspectiveOrigin: 'center 46%',
          transformStyle: 'preserve-3d',
          transition: 'transform 1.3s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        {/* Background Library Scene */}
        <div
          className={`scene-background ${isEntering ? 'bg-depth-zoom' : ''}`}
          style={{
            position: 'absolute',
            inset: '-5%',
            width: '110%',
            height: '110%',
            backgroundImage: 'url(/library-entrance.jpg)',
            backgroundSize: 'cover',
            backgroundPosition: 'center 46%',
            backgroundRepeat: 'no-repeat',
            transition: 'transform 1.3s cubic-bezier(0.3, 0, 0.1, 1), filter 1.3s ease',
            filter: isEntering ? 'brightness(1.5) saturate(1.2)' : 'brightness(0.95)',
          }}
        />

        {/* Ambient Vignette & Shadow Gradients */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: `
              radial-gradient(ellipse 90% 70% at 50% 48%, rgba(0, 0, 0, 0.1) 0%, rgba(5, 4, 3, 0.55) 60%, rgba(5, 4, 3, 0.95) 100%),
              linear-gradient(180deg, rgba(5,4,3,0.5) 0%, transparent 25%, transparent 70%, rgba(5,4,3,0.85) 100%)
            `,
            pointerEvents: 'none',
          }}
        />

        {/* ── 3D Animated Grand Portal Doors ── */}
        <div
          className="portal-doors-wrapper"
          style={{
            position: 'absolute',
            top: '24%',
            left: '38%',
            width: '24%',
            height: '46%',
            pointerEvents: 'none',
            perspective: 900,
            transformStyle: 'preserve-3d',
            display: 'flex',
          }}
        >
          {/* Left Door Leaf */}
          <div
            className={`door-leaf door-leaf-left ${isEntering ? 'open-door-left' : ''}`}
            style={{
              width: '50%',
              height: '100%',
              transformOrigin: 'left center',
              transition: 'transform 1.25s cubic-bezier(0.2, 0, 0.1, 1)',
              background: 'linear-gradient(90deg, rgba(45, 25, 12, 0.4) 0%, rgba(20, 10, 5, 0.2) 100%)',
              boxShadow: isEntering ? 'none' : 'inset -4px 0 15px rgba(0,0,0,0.6)',
              borderRight: '1px solid rgba(201, 168, 76, 0.25)',
              transform: isEntering ? 'rotateY(-85deg)' : 'rotateY(0deg)',
            }}
          />

          {/* Right Door Leaf */}
          <div
            className={`door-leaf door-leaf-right ${isEntering ? 'open-door-right' : ''}`}
            style={{
              width: '50%',
              height: '100%',
              transformOrigin: 'right center',
              transition: 'transform 1.25s cubic-bezier(0.2, 0, 0.1, 1)',
              background: 'linear-gradient(-90deg, rgba(45, 25, 12, 0.4) 0%, rgba(20, 10, 5, 0.2) 100%)',
              boxShadow: isEntering ? 'none' : 'inset 4px 0 15px rgba(0,0,0,0.6)',
              borderLeft: '1px solid rgba(201, 168, 76, 0.25)',
              transform: isEntering ? 'rotateY(85deg)' : 'rotateY(0deg)',
            }}
          />
        </div>

        {/* Sunbeam & Volumetric Light Bloom on Enter */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'radial-gradient(circle at 50% 46%, rgba(255, 230, 160, 0.9) 0%, rgba(212, 155, 45, 0.5) 45%, rgba(10, 8, 5, 0.95) 100%)',
            opacity: isEntering ? 1 : 0,
            transition: 'opacity 1.2s cubic-bezier(0.4, 0, 0.2, 1)',
            pointerEvents: 'none',
            mixBlendMode: 'screen',
          }}
        />
      </div>

      {/* ── Center Majestic Typography ── */}
      <div
        className={`content-overlay ${isEntering ? 'fade-out-content' : ''}`}
        style={{
          position: 'absolute',
          top: '22%',
          left: 0,
          right: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          padding: '0 20px',
          pointerEvents: isEntering ? 'none' : 'auto',
          transition: 'opacity 0.6s ease, transform 0.8s ease',
          opacity: isEntering ? 0 : 1,
          transform: isEntering ? 'scale(1.15) translateY(-30px)' : 'scale(1) translateY(0)',
          zIndex: 10,
        }}
      >
        {/* Top Filigree Ornament */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            marginBottom: 12,
            opacity: 0.85,
          }}
        >
          <span style={{ width: 42, height: 1, background: 'linear-gradient(90deg, transparent, #e0bf72)' }} />
          <span style={{ color: '#e0bf72', fontSize: 13, letterSpacing: '0.2em' }}>✦</span>
          <span style={{ width: 42, height: 1, background: 'linear-gradient(90deg, #e0bf72, transparent)' }} />
        </div>

        {/* Main Title: REWAMP LIBRARY */}
        <h1
          style={{
            margin: 0,
            fontFamily: "'Playfair Display', Georgia, serif",
            fontSize: 'clamp(38px, 6.5vw, 76px)',
            fontWeight: 700,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: '#fefbf3',
            textShadow: `
              0 2px 4px rgba(0, 0, 0, 0.9),
              0 6px 25px rgba(0, 0, 0, 0.95),
              0 0 45px rgba(201, 168, 76, 0.45)
            `,
            lineHeight: 1.1,
          }}
        >
          Rewamp Library
        </h1>

        {/* Bottom Filigree Flourish */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            margin: '12px 0 16px',
            opacity: 0.85,
          }}
        >
          <span style={{ width: 60, height: 1, background: 'linear-gradient(90deg, transparent, #c9a84c)' }} />
          <span style={{ color: '#e0bf72', fontSize: 11 }}>❖</span>
          <span style={{ width: 60, height: 1, background: 'linear-gradient(90deg, #c9a84c, transparent)' }} />
        </div>

        {/* Subtitle */}
        <p
          style={{
            margin: 0,
            fontFamily: "'Crimson Pro', Georgia, serif",
            fontStyle: 'italic',
            fontSize: 'clamp(16px, 2.2vw, 24px)',
            fontWeight: 400,
            letterSpacing: '0.04em',
            color: '#ebdcb9',
            textShadow: '0 2px 14px rgba(0, 0, 0, 0.95), 0 0 25px rgba(0, 0, 0, 0.8)',
            maxWidth: 620,
          }}
        >
          A universe of knowledge, waiting to be explored.
        </p>
      </div>

      {/* ── Lower-Center Action Button ── */}
      <div
        className={`button-container ${isEntering ? 'fade-out-button' : ''}`}
        style={{
          position: 'absolute',
          bottom: '18%',
          left: 0,
          right: 0,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 20,
          padding: '0 20px',
          transition: 'opacity 0.5s ease, transform 0.6s ease',
          opacity: isEntering ? 0 : 1,
          transform: isEntering ? 'scale(0.9) translateY(20px)' : 'scale(1) translateY(0)',
          pointerEvents: isEntering ? 'none' : 'auto',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          {/* Left Decorative Line */}
          <div
            style={{
              width: 38,
              height: 1,
              background: 'linear-gradient(90deg, transparent, rgba(224, 191, 114, 0.6))',
            }}
          />

          {/* Primary Action Button */}
          <button
            onClick={handleEnter}
            id="enter-library-btn"
            aria-label="Enter the Library"
            style={{
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 12,
              padding: '16px 42px',
              borderRadius: 36,
              background: 'linear-gradient(135deg, rgba(46, 32, 14, 0.85) 0%, rgba(20, 14, 6, 0.92) 100%)',
              border: '1.5px solid rgba(224, 191, 114, 0.65)',
              color: '#fdf3d6',
              fontFamily: "'Playfair Display', Georgia, serif",
              fontSize: 'clamp(14px, 1.4vw, 17px)',
              fontWeight: 600,
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
              boxShadow: `
                0 6px 28px rgba(0, 0, 0, 0.85),
                0 0 24px rgba(201, 168, 76, 0.3),
                inset 0 1px 1px rgba(255, 235, 180, 0.4)
              `,
              backdropFilter: 'blur(10px)',
              WebkitBackdropFilter: 'blur(10px)',
              transition: 'all 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px) scale(1.03)'
              e.currentTarget.style.borderColor = '#f5da8e'
              e.currentTarget.style.boxShadow = '0 10px 40px rgba(0, 0, 0, 0.95), 0 0 35px rgba(224, 191, 114, 0.6), inset 0 1px 2px rgba(255, 255, 255, 0.6)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'none'
              e.currentTarget.style.borderColor = 'rgba(224, 191, 114, 0.65)'
              e.currentTarget.style.boxShadow = '0 6px 28px rgba(0, 0, 0, 0.85), 0 0 24px rgba(201, 168, 76, 0.3), inset 0 1px 1px rgba(255, 235, 180, 0.4)'
            }}
          >
            <span>Enter the Library</span>
            <span style={{ fontSize: 18, transform: 'translateY(-1px)' }}>→</span>
          </button>

          {/* Right Decorative Line */}
          <div
            style={{
              width: 38,
              height: 1,
              background: 'linear-gradient(90deg, rgba(224, 191, 114, 0.6), transparent)',
            }}
          />
        </div>
      </div>

      {/* Embedded CSS Keyframes for 3D Animation */}
      <style>{`
        .camera-zoom-in {
          transform: scale(2.2) translateZ(420px) translateY(-2%);
        }

        .bg-depth-zoom {
          transform: scale(1.3) translateY(4%);
        }

        @keyframes ambientFloat {
          0% { transform: scale(1.01) translateY(0); }
          50% { transform: scale(1.03) translateY(-6px); }
          100% { transform: scale(1.01) translateY(0); }
        }

        @media (max-width: 768px) {
          .portal-doors-wrapper {
            top: 28% !important;
            left: 28% !important;
            width: 44% !important;
            height: 40% !important;
          }
        }
      `}</style>
    </div>
  )
}
