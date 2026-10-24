import React from 'react'

interface CentralKnowledgePortalProps {
  isGenerating?: boolean
}

export default function CentralKnowledgePortal({ isGenerating = false }: CentralKnowledgePortalProps) {
  return (
    <div
      className={`knowledge-portal-container ${isGenerating ? 'is-generating' : ''}`}
      role="img"
      aria-label="Central Knowledge Portal - An illuminated open book surrounded by celestial orbital rings"
    >
      {/* Outer Ambient Glow Aura */}
      <div className="portal-ambient-halo" />

      {/* Orbital Astrolabe & Constellation Rings SVG */}
      <svg
        className="portal-astrolabe-svg"
        viewBox="0 0 320 220"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <defs>
          {/* Golden Gradient for Rings */}
          <linearGradient id="portalGoldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#f5df9e" stopOpacity="0.9" />
            <stop offset="50%" stopColor="#c9a84c" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#e0bf72" stopOpacity="0.85" />
          </linearGradient>

          {/* Lighter Ring Gradient */}
          <linearGradient id="portalRingSoft" x1="0%" y1="50%" x2="100%" y2="50%">
            <stop offset="0%" stopColor="#e0bf72" stopOpacity="0.1" />
            <stop offset="30%" stopColor="#f5df9e" stopOpacity="0.75" />
            <stop offset="70%" stopColor="#c9a84c" stopOpacity="0.75" />
            <stop offset="100%" stopColor="#e0bf72" stopOpacity="0.1" />
          </linearGradient>

          {/* Core Beam Gradient */}
          <linearGradient id="bookBeamGrad" x1="50%" y1="100%" x2="50%" y2="0%">
            <stop offset="0%" stopColor="#ffebad" stopOpacity="0.85" />
            <stop offset="35%" stopColor="#e0bf72" stopOpacity="0.5" />
            <stop offset="75%" stopColor="#c9a84c" stopOpacity="0.15" />
            <stop offset="100%" stopColor="#c9a84c" stopOpacity="0" />
          </linearGradient>

          {/* Radial Page Glow */}
          <radialGradient id="portalPageGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#fff2c2" stopOpacity="0.95" />
            <stop offset="45%" stopColor="#e0bf72" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#c9a84c" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* ── 1. Outer Tilted Elliptical Orbital Ring ── */}
        <g className="portal-ring-outer-orbit" transform="translate(160, 110)">
          <ellipse
            rx="132"
            ry="48"
            transform="rotate(-15)"
            stroke="url(#portalRingSoft)"
            strokeWidth="1.2"
            strokeDasharray="4 8"
          />
          {/* Orbiting Satellite Particle 1 */}
          <circle cx="120" cy="-28" r="3.2" fill="#fff5d1" className="satellite-dot-1" filter="drop-shadow(0 0 6px #f5df9e)" />
          {/* Orbiting Satellite Particle 2 */}
          <circle cx="-118" cy="26" r="2.4" fill="#f0c868" className="satellite-dot-2" filter="drop-shadow(0 0 4px #c9a84c)" />
          {/* Rune glyph on orbit */}
          <text x="95" y="-36" fill="#f5df9e" fontSize="9" fontFamily="serif" opacity="0.85">e</text>
          <text x="-105" y="44" fill="#f5df9e" fontSize="8" fontFamily="serif" opacity="0.85">✦</text>
        </g>

        {/* ── 2. Middle Concentric Astrolabe Ring with Degree Ticks ── */}
        <g className="portal-ring-astrolabe" transform="translate(160, 110)">
          <circle r="72" stroke="url(#portalGoldGrad)" strokeWidth="1.2" strokeOpacity="0.75" />
          <circle r="78" stroke="url(#portalGoldGrad)" strokeWidth="0.8" strokeDasharray="2 6" strokeOpacity="0.6" />

          {/* Astronomical Degree Ticks around the ring */}
          {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((deg) => (
            <line
              key={deg}
              x1="0"
              y1="-72"
              x2="0"
              y2={deg % 90 === 0 ? "-64" : "-68"}
              stroke="#e0bf72"
              strokeWidth={deg % 90 === 0 ? "1.5" : "0.9"}
              strokeOpacity="0.8"
              transform={`rotate(${deg})`}
            />
          ))}

          {/* Cardinal Constellation Nodes */}
          <circle cx="0" cy="-72" r="3" fill="#ffffff" filter="drop-shadow(0 0 5px #e0bf72)" />
          <circle cx="72" cy="0" r="2.5" fill="#f5df9e" />
          <circle cx="0" cy="72" r="2.5" fill="#f5df9e" />
          <circle cx="-72" cy="0" r="2.5" fill="#f5df9e" />

          {/* Celestial Glyph Markers */}
          <text x="-4" y="-82" fill="#fcebc2" fontSize="9" textAnchor="middle" fontFamily="serif">☽</text>
          <text x="86" y="3" fill="#fcebc2" fontSize="9" textAnchor="middle" fontFamily="serif">☉</text>
          <text x="-86" y="3" fill="#fcebc2" fontSize="8" textAnchor="middle" fontFamily="serif">✧</text>
        </g>

        {/* ── 3. Inner Delicate Meridian Rings ── */}
        <g className="portal-ring-inner" transform="translate(160, 110)">
          <circle r="52" stroke="url(#portalGoldGrad)" strokeWidth="0.9" strokeDasharray="5 5" strokeOpacity="0.7" />
          <line x1="-54" y1="0" x2="54" y2="0" stroke="#e0bf72" strokeWidth="0.7" strokeOpacity="0.45" />
          <line x1="0" y1="-54" x2="0" y2="54" stroke="#e0bf72" strokeWidth="0.7" strokeOpacity="0.45" />
        </g>

        {/* ── 4. Vertical Radiant Beam Rising from Book Core ── */}
        <polygon
          points="136,110 184,110 200,20 120,20"
          fill="url(#bookBeamGrad)"
          className="portal-rising-beam"
        />

        {/* Floating Sparks Rising Upward */}
        <circle cx="152" cy="65" r="1.5" fill="#fffdf2" className="spark-particle spark-1" />
        <circle cx="168" cy="48" r="2.0" fill="#fcebc2" className="spark-particle spark-2" />
        <circle cx="145" cy="35" r="1.2" fill="#fffdf2" className="spark-particle spark-3" />
        <circle cx="174" cy="75" r="1.6" fill="#f5df9e" className="spark-particle spark-4" />
      </svg>

      {/* ── 5. Detailed 3D Illuminated Open Book Centerpiece ── */}
      <div className="portal-book-stage">
        {/* Luminous Core Glow */}
        <div className="book-core-light-burst" />

        {/* Open Book Object */}
        <div className="portal-open-book-rig">
          {/* Hardcover Outer Wings */}
          <div className="portal-cover-leaf portal-cover-left" />
          <div className="portal-cover-leaf portal-cover-right" />

          {/* Central Gold Spine Hinge */}
          <div className="portal-book-spine">
            <span className="spine-rib" />
          </div>

          {/* Left Open Page Leaf with Curvature */}
          <div className="portal-page-leaf page-leaf-left">
            <div className="portal-page-curvature" />
            <div className="portal-page-script">
              <span className="script-line w-85" />
              <span className="script-line w-92" />
              <span className="script-line w-75" />
              <span className="script-line w-88" />
            </div>
            <div className="portal-page-gilt" />
          </div>

          {/* Right Open Page Leaf with Curvature */}
          <div className="portal-page-leaf page-leaf-right">
            <div className="portal-page-curvature" />
            <div className="portal-page-script">
              <span className="script-line w-90" />
              <span className="script-line w-82" />
              <span className="script-line w-88" />
              <span className="script-line w-70" />
            </div>
            <div className="portal-page-gilt" />
          </div>

          {/* Radiant Light Burst from Book Fold */}
          <div className="portal-spine-light-burst" />
        </div>
      </div>
    </div>
  )
}
