import React, { useMemo } from 'react'

interface OpenBookConfig {
  id: string
  x: string
  y?: string
  bottom?: string
  scale: number
  rotationZ: number
  rotationX: number
  rotationY: number
  animationType: 'float-1' | 'float-2' | 'float-3' | 'float-4'
  duration: number
  delay: number
  depth: 'foreground' | 'midground' | 'distant'
  coverColor: string
  runeSymbol: string
  hideOnMobile?: boolean
}

// 12 strategically positioned floating open books creating depth & cinematic atmosphere
const FLOATING_BOOKS: OpenBookConfig[] = [
  // Upper framing books (large & crisp, framing the hero)
  {
    id: 'book-top-left',
    x: '3%',
    y: '4%',
    scale: 1.08,
    rotationZ: -14,
    rotationX: 18,
    rotationY: 22,
    animationType: 'float-1',
    duration: 8.5,
    delay: 0,
    depth: 'foreground',
    coverColor: 'linear-gradient(135deg, #2a164d 0%, #170d2c 100%)',
    runeSymbol: '✦ 𝔄 ✧',
  },
  {
    id: 'book-top-right',
    x: '88%',
    y: '5%',
    scale: 1.12,
    rotationZ: 15,
    rotationX: 16,
    rotationY: -22,
    animationType: 'float-2',
    duration: 9.2,
    delay: 1.2,
    depth: 'foreground',
    coverColor: 'linear-gradient(135deg, #162a4d 0%, #0d172c 100%)',
    runeSymbol: '✧ 𝔏 ✦',
  },
  // Distant subtle books behind the hero
  {
    id: 'book-top-center-distant',
    x: '48%',
    y: '2%',
    scale: 0.5,
    rotationZ: 5,
    rotationX: 24,
    rotationY: -8,
    animationType: 'float-3',
    duration: 11.0,
    delay: 2.5,
    depth: 'distant',
    coverColor: 'linear-gradient(135deg, #3d1b32 0%, #1f0b18 100%)',
    runeSymbol: 'ᚱ ᛗ',
    hideOnMobile: true,
  },
  // Upper-mid flankers
  {
    id: 'book-mid-left-high',
    x: '11%',
    y: '22%',
    scale: 0.76,
    rotationZ: -8,
    rotationX: 20,
    rotationY: 18,
    animationType: 'float-4',
    duration: 8.8,
    delay: 3.1,
    depth: 'midground',
    coverColor: 'linear-gradient(135deg, #1f2e1a 0%, #0f170d 100%)',
    runeSymbol: '❧ 𝔖 ❧',
    hideOnMobile: true,
  },
  {
    id: 'book-mid-right-high',
    x: '84%',
    y: '25%',
    scale: 0.78,
    rotationZ: 12,
    rotationX: 18,
    rotationY: -16,
    animationType: 'float-1',
    duration: 9.8,
    delay: 0.8,
    depth: 'midground',
    coverColor: 'linear-gradient(135deg, #382412 0%, #1c1209 100%)',
    runeSymbol: '☙ 𝔙 ☙',
    hideOnMobile: true,
  },
  // Midground flankers framing the catalog grid
  {
    id: 'book-grid-left',
    x: '1.5%',
    y: '48%',
    scale: 0.95,
    rotationZ: -16,
    rotationX: 14,
    rotationY: 25,
    animationType: 'float-2',
    duration: 8.2,
    delay: 1.8,
    depth: 'foreground',
    coverColor: 'linear-gradient(135deg, #2b1740 0%, #13091e 100%)',
    runeSymbol: '✦ ᚠ ✧',
  },
  {
    id: 'book-grid-right',
    x: '90%',
    y: '50%',
    scale: 0.98,
    rotationZ: 18,
    rotationX: 12,
    rotationY: -24,
    animationType: 'float-3',
    duration: 9.4,
    delay: 2.2,
    depth: 'foreground',
    coverColor: 'linear-gradient(135deg, #15273b 0%, #09131e 100%)',
    runeSymbol: '✧ ᛏ ✦',
  },
  // Deep background books (small, soft blur, low opacity)
  {
    id: 'book-deep-left',
    x: '22%',
    y: '44%',
    scale: 0.52,
    rotationZ: -6,
    rotationX: 22,
    rotationY: 14,
    animationType: 'float-4',
    duration: 11.5,
    delay: 4.0,
    depth: 'distant',
    coverColor: 'linear-gradient(135deg, #361b2c 0%, #190913 100%)',
    runeSymbol: '✦ ✧',
    hideOnMobile: true,
  },
  {
    id: 'book-deep-right',
    x: '74%',
    y: '46%',
    scale: 0.54,
    rotationZ: 9,
    rotationX: 20,
    rotationY: -12,
    animationType: 'float-1',
    duration: 10.6,
    delay: 1.5,
    depth: 'distant',
    coverColor: 'linear-gradient(135deg, #1c2b36 0%, #0c161d 100%)',
    runeSymbol: '✧ ✦',
    hideOnMobile: true,
  },
  // Lower framing books
  {
    id: 'book-lower-left',
    x: '4%',
    bottom: '12%',
    scale: 0.88,
    rotationZ: -12,
    rotationX: 16,
    rotationY: 20,
    animationType: 'float-2',
    duration: 8.6,
    delay: 2.8,
    depth: 'midground',
    coverColor: 'linear-gradient(135deg, #301d4a 0%, #170d26 100%)',
    runeSymbol: '✦ 𝔐 ✧',
    hideOnMobile: true,
  },
  {
    id: 'book-lower-right',
    x: '86%',
    bottom: '10%',
    scale: 0.9,
    rotationZ: 14,
    rotationX: 15,
    rotationY: -22,
    animationType: 'float-3',
    duration: 9.0,
    delay: 0.5,
    depth: 'midground',
    coverColor: 'linear-gradient(135deg, #1f2f45 0%, #0d1724 100%)',
    runeSymbol: '✧ 𝔒 ✦',
    hideOnMobile: true,
  },
  {
    id: 'book-bottom-center-distant',
    x: '50%',
    bottom: '4%',
    scale: 0.46,
    rotationZ: -4,
    rotationX: 22,
    rotationY: 10,
    animationType: 'float-4',
    duration: 12.0,
    delay: 3.5,
    depth: 'distant',
    coverColor: 'linear-gradient(135deg, #2b1d36 0%, #150d1c 100%)',
    runeSymbol: 'ᚲ ᚺ',
    hideOnMobile: true,
  },
]

export default function FloatingLibraryBackground() {
  // Deterministic floating magical dust motes
  const dustParticles = useMemo(
    () => [
      { left: '6%', top: '15%', delay: '0s', duration: '8.2s', size: 3.5 },
      { left: '16%', top: '38%', delay: '1.4s', duration: '9.0s', size: 2.5 },
      { left: '28%', top: '18%', delay: '2.8s', duration: '7.8s', size: 4 },
      { left: '36%', top: '65%', delay: '0.9s', duration: '10.2s', size: 2 },
      { left: '46%', top: '24%', delay: '3.6s', duration: '8.6s', size: 3 },
      { left: '58%', top: '42%', delay: '1.8s', duration: '9.4s', size: 2.5 },
      { left: '66%', top: '12%', delay: '4.2s', duration: '8.0s', size: 4 },
      { left: '76%', top: '56%', delay: '2.4s', duration: '9.8s', size: 3 },
      { left: '86%', top: '28%', delay: '0.5s', duration: '7.5s', size: 3.5 },
      { left: '92%', top: '70%', delay: '3.1s', duration: '8.9s', size: 2.5 },
      { left: '12%', top: '80%', delay: '1.7s', duration: '10.0s', size: 3 },
      { left: '82%', top: '85%', delay: '4.0s', duration: '8.4s', size: 3.5 },
    ],
    []
  )

  return (
    <div
      className="floating-library-backdrop"
      aria-hidden="true"
      role="presentation"
    >
      {/* Deep Atmospheric Base & Vignette */}
      <div className="backdrop-deep-glow" />
      <div className="backdrop-volumetric-rays" />

      {/* Floating Golden Dust Particles */}
      <div className="backdrop-dust-container">
        {dustParticles.map((d, i) => (
          <span
            key={i}
            className="backdrop-dust-mote"
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

      {/* 3D Floating Open Books Stage */}
      <div className="floating-books-stage">
        {FLOATING_BOOKS.map((b) => (
          <div
            key={b.id}
            className={`floating-open-book-anchor depth-${b.depth} anim-${b.animationType} ${
              b.hideOnMobile ? 'hide-on-mobile' : ''
            }`}
            style={{
              left: b.x,
              top: b.y,
              bottom: b.bottom,
              animationDuration: `${b.duration}s`,
              animationDelay: `${b.delay}s`,
            }}
          >
            {/* 3D Open Book Object */}
            <div
              className="open-book-3d"
              style={{
                transform: `scale(${b.scale}) rotateZ(${b.rotationZ}deg) rotateX(${b.rotationX}deg) rotateY(${b.rotationY}deg)`,
              }}
            >
              {/* Soft Golden Aura Halo */}
              <div className="open-book-aura" />

              {/* Hardcover Backing Wings (V-angle foundation) */}
              <div
                className="open-book-cover-leaf cover-leaf-left"
                style={{ background: b.coverColor }}
              />
              <div
                className="open-book-cover-leaf cover-leaf-right"
                style={{ background: b.coverColor }}
              />

              {/* Central Spine Ridge Fold */}
              <div className="open-book-spine-fold">
                <span className="spine-rib-highlight" />
              </div>

              {/* Left Curved Open Page Leaf */}
              <div className="open-page-leaf page-leaf-left">
                {/* Cylindrical Curvature Highlight */}
                <div className="page-curl-highlight" />

                {/* Ancient Script Lines & Runes */}
                <div className="page-runic-content">
                  <span className="rune-sigil-header">{b.runeSymbol}</span>
                  <span className="runic-script-line line-w-85" />
                  <span className="runic-script-line line-w-92" />
                  <span className="runic-script-line line-w-78" />
                  <span className="runic-script-line line-w-88" />
                  <span className="runic-script-line line-w-64" />
                </div>

                {/* Stacked Paper Deckled Edges & Gilded Trim */}
                <div className="page-deckled-layers" />
                <div className="page-gilded-rim" />
              </div>

              {/* Right Curved Open Page Leaf */}
              <div className="open-page-leaf page-leaf-right">
                {/* Cylindrical Curvature Highlight */}
                <div className="page-curl-highlight" />

                {/* Ancient Script Lines & Runes */}
                <div className="page-runic-content">
                  <span className="rune-sigil-header">{b.runeSymbol}</span>
                  <span className="runic-script-line line-w-90" />
                  <span className="runic-script-line line-w-82" />
                  <span className="runic-script-line line-w-88" />
                  <span className="runic-script-line line-w-74" />
                  <span className="runic-script-line line-w-68" />
                </div>

                {/* Stacked Paper Deckled Edges & Gilded Trim */}
                <div className="page-deckled-layers" />
                <div className="page-gilded-rim" />
              </div>

              {/* Golden Luminescence Radiating from V-Fold Spine */}
              <div className="open-book-spine-glow" />
            </div>
          </div>
        ))}
      </div>

      {/* Center Subduing Mask: keeps main content readable while edges shine */}
      <div className="backdrop-center-readability-mask" />
    </div>
  )
}
