import React, { useMemo } from 'react'

export default function ChatMagicalBackground() {
  // Deterministic golden dust motes
  const dustMotes = useMemo(
    () => [
      { left: '8%', top: '22%', delay: '0s', duration: '8.5s', size: 3.5 },
      { left: '15%', top: '48%', delay: '1.8s', duration: '9.2s', size: 2.5 },
      { left: '22%', top: '15%', delay: '3.4s', duration: '7.8s', size: 3 },
      { left: '28%', top: '68%', delay: '0.9s', duration: '10.1s', size: 2 },
      { left: '72%', top: '20%', delay: '4.2s', duration: '8.7s', size: 3 },
      { left: '78%', top: '55%', delay: '2.1s', duration: '9.5s', size: 3.5 },
      { left: '86%', top: '32%', delay: '5.1s', duration: '8.2s', size: 2.5 },
      { left: '92%', top: '65%', delay: '1.2s', duration: '9.8s', size: 3 },
      { left: '12%', top: '78%', delay: '3.9s', duration: '7.5s', size: 3.5 },
      { left: '84%', top: '82%', delay: '0.4s', duration: '9.1s', size: 2.5 },
    ],
    []
  )

  return (
    <div
      className="chat-magical-backdrop"
      aria-hidden="true"
      role="presentation"
    >
      {/* ── 1. Atmospheric Deep Navy / Indigo Base ── */}
      <div className="chat-backdrop-deep-glow" />

      {/* ── 2. Subtle Gothic Library Arches & Window Rays in Silhouette ── */}
      <svg
        className="chat-library-arches-svg"
        viewBox="0 0 1440 900"
        preserveAspectRatio="xMidYMid slice"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="archWindowGlow" x1="50%" y1="0%" x2="50%" y2="100%">
            <stop offset="0%" stopColor="#251c4a" stopOpacity="0.45" />
            <stop offset="60%" stopColor="#0f1124" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#070814" stopOpacity="0.9" />
          </linearGradient>

          <linearGradient id="warmLanternGlowLeft" x1="0%" y1="50%" x2="100%" y2="50%">
            <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.25" />
            <stop offset="50%" stopColor="#d97706" stopOpacity="0.1" />
            <stop offset="100%" stopColor="transparent" stopOpacity="0" />
          </linearGradient>

          <linearGradient id="warmLanternGlowRight" x1="100%" y1="50%" x2="0%" y2="50%">
            <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.25" />
            <stop offset="50%" stopColor="#d97706" stopOpacity="0.1" />
            <stop offset="100%" stopColor="transparent" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Far Background Library Arches */}
        <path
          d="M120 0 V420 C120 510 240 580 340 580 C440 580 560 510 560 420 V0 Z"
          fill="url(#archWindowGlow)"
          opacity="0.35"
        />
        <path
          d="M880 0 V420 C880 510 1000 580 1100 580 C1200 580 1320 510 1320 420 V0 Z"
          fill="url(#archWindowGlow)"
          opacity="0.35"
        />

        {/* Ambient Lantern Illumination on Left and Right Sides */}
        <circle cx="80" cy="520" r="280" fill="url(#warmLanternGlowLeft)" />
        <circle cx="1360" cy="540" r="280" fill="url(#warmLanternGlowRight)" />
      </svg>

      {/* ── 3. Golden Constellations Graph (Thin lines and glowing star nodes) ── */}
      <svg
        className="chat-constellations-svg"
        viewBox="0 0 1440 800"
        preserveAspectRatio="xMidYMid slice"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Left Constellation Cluster */}
        <g className="constellation-cluster constellation-left">
          <line x1="80" y1="240" x2="160" y2="210" stroke="#e0bf72" strokeWidth="0.8" strokeOpacity="0.5" />
          <line x1="160" y1="210" x2="220" y2="280" stroke="#e0bf72" strokeWidth="0.8" strokeOpacity="0.5" />
          <line x1="220" y1="280" x2="280" y2="230" stroke="#e0bf72" strokeWidth="0.8" strokeOpacity="0.4" />
          <line x1="160" y1="210" x2="190" y2="150" stroke="#e0bf72" strokeWidth="0.8" strokeOpacity="0.4" />
          <line x1="220" y1="280" x2="240" y2="360" stroke="#e0bf72" strokeWidth="0.8" strokeOpacity="0.4" />

          {/* Glowing Nodes */}
          <circle cx="80" cy="240" r="2.5" fill="#f5df9e" className="pulse-star star-1" />
          <circle cx="160" cy="210" r="3.5" fill="#fffdf2" className="pulse-star star-2" />
          <circle cx="220" cy="280" r="3.0" fill="#f5df9e" className="pulse-star star-3" />
          <circle cx="280" cy="230" r="2.2" fill="#e0bf72" className="pulse-star star-4" />
          <circle cx="190" cy="150" r="2.8" fill="#fffdf2" className="pulse-star star-5" />
          <circle cx="240" cy="360" r="2.4" fill="#f5df9e" className="pulse-star star-6" />
        </g>

        {/* Right Constellation Cluster */}
        <g className="constellation-cluster constellation-right">
          <line x1="1360" y1="260" x2="1260" y2="220" stroke="#e0bf72" strokeWidth="0.8" strokeOpacity="0.5" />
          <line x1="1260" y1="220" x2="1190" y2="290" stroke="#e0bf72" strokeWidth="0.8" strokeOpacity="0.5" />
          <line x1="1190" y1="290" x2="1120" y2="240" stroke="#e0bf72" strokeWidth="0.8" strokeOpacity="0.4" />
          <line x1="1260" y1="220" x2="1230" y2="160" stroke="#e0bf72" strokeWidth="0.8" strokeOpacity="0.4" />
          <line x1="1190" y1="290" x2="1220" y2="380" stroke="#e0bf72" strokeWidth="0.8" strokeOpacity="0.4" />

          {/* Glowing Nodes */}
          <circle cx="1360" cy="260" r="2.5" fill="#f5df9e" className="pulse-star star-1" />
          <circle cx="1260" cy="220" r="3.5" fill="#fffdf2" className="pulse-star star-2" />
          <circle cx="1190" cy="290" r="3.0" fill="#f5df9e" className="pulse-star star-3" />
          <circle cx="1120" cy="240" r="2.2" fill="#e0bf72" className="pulse-star star-4" />
          <circle cx="1230" cy="160" r="2.8" fill="#fffdf2" className="pulse-star star-5" />
          <circle cx="1220" cy="380" r="2.4" fill="#f5df9e" className="pulse-star star-6" />
        </g>
      </svg>

      {/* ── 4. Illuminated Floating Literary Text Ribbons (As in Reference Image) ── */}
      {/* Left Literary Arc */}
      <div className="literary-text-stream stream-left">
        <div className="stream-arc-line" />
        <p className="literary-quote-line">Ideas connect</p>
        <p className="literary-quote-line">Stories reveal</p>
        <p className="literary-quote-line">Knowledge endures</p>
      </div>

      {/* Right Literary Arc */}
      <div className="literary-text-stream stream-right">
        <div className="stream-arc-line" />
        <p className="literary-quote-line">Every question ✦</p>
        <p className="literary-quote-line">opens another</p>
        <p className="literary-quote-line">world ✦</p>
      </div>

      {/* ── 5. Golden Glowing Parchment Script Fragment in Bottom Right ── */}
      <div className="illuminated-parchment-fragment">
        <div className="parchment-glow-aura" />
        <div className="parchment-cursive-script">
          <span className="cursive-line cursive-w-90" />
          <span className="cursive-line cursive-w-75" />
          <span className="cursive-line cursive-w-85" />
          <span className="cursive-line cursive-w-65" />
        </div>
      </div>

      {/* ── 6. Floating Golden Magical Dust Particles ── */}
      <div className="chat-backdrop-dust-container">
        {dustMotes.map((d, i) => (
          <span
            key={i}
            className="chat-dust-mote"
            style={{
              left: d.left,
              top: d.top,
              width: `${d.size}px`,
              height: `${d.size}px`,
              animationDelay: d.delay,
              animationDuration: d.duration,
            }}
          />
        ))}
      </div>

      {/* ── 7. Central Contrast Vignette (Ensures Chat Text & Cards Pop) ── */}
      <div className="chat-backdrop-center-vignette" />
    </div>
  )
}
