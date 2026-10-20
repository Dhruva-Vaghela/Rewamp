import { Link } from 'react-router-dom'
import Nav from '../components/Nav'

const features = [
  {
    icon: '📖',
    title: 'Beautiful Reading Experience',
    description: 'Read your PDFs in an elegant, distraction-free interface with adjustable zoom, smooth page navigation, and a design crafted for long reading sessions.',
    badge: null,
  },
  {
    icon: '🗂️',
    title: 'Personal Book Library',
    description: 'Your entire PDF collection, beautifully organized and searchable. Find any book in seconds and dive straight into reading.',
    badge: null,
  },
  {
    icon: '🤖',
    title: 'AI Book Companion',
    description: 'Coming soon — ask questions, surface insights, and explore themes grounded directly in your own books. No hallucinations, only answers sourced from your texts.',
    badge: 'Coming Soon',
  },
  {
    icon: '🔎',
    title: 'Deep Text Understanding',
    description: 'Future AI capabilities will read and comprehend your books at depth, enabling nuanced conversations about characters, themes, and ideas.',
    badge: 'Coming Soon',
  },
  {
    icon: '🌒',
    title: 'Light & Dark Modes',
    description: 'Switch effortlessly between a warm parchment light mode and a midnight dark mode. Your eyes will thank you for the evening reading sessions.',
    badge: null,
  },
  {
    icon: '🔒',
    title: 'Private by Design',
    description: 'Your books stay on your own infrastructure. No third-party cloud storage, no data mining — your library remains entirely yours.',
    badge: null,
  },
]

const steps = [
  {
    number: '01',
    title: 'Upload your PDFs',
    description: 'Place your PDF books in the library folder. Rewamp Library automatically detects and indexes them — titles, authors, and page counts.',
  },
  {
    number: '02',
    title: 'Explore & Read',
    description: 'Browse your beautifully organized library and open any book in a full-featured PDF reader with zoom, navigation, and a distraction-free layout.',
  },
  {
    number: '03',
    title: 'Converse with Your Books',
    description: 'Soon, engage an AI that has deeply read your collection — ask anything and receive answers grounded exclusively in your own texts.',
  },
]

// Decorative CSS book component
function CSSBook({
  width = 90,
  height = 130,
  gradient,
  delay = 0,
}: {
  width?: number
  height?: number
  gradient: string
  delay?: number
}) {
  return (
    <div
      style={{
        position: 'relative',
        width,
        height,
        animation: `bookFloat 6s ${delay}s ease-in-out infinite alternate`,
        transformOrigin: 'center bottom',
        flexShrink: 0,
      }}
    >
      {/* Spine */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: 8,
          background: 'rgba(0,0,0,0.25)',
          borderRadius: '3px 0 0 3px',
          zIndex: 2,
        }}
      />
      {/* Cover */}
      <div
        style={{
          position: 'absolute',
          left: 6,
          top: 0,
          right: 0,
          bottom: 0,
          background: gradient,
          borderRadius: '2px 8px 8px 2px',
          boxShadow: '4px 6px 24px rgba(0,0,0,0.5)',
          overflow: 'hidden',
        }}
      >
        {/* Sheen */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(145deg, rgba(255,255,255,0.1) 0%, transparent 50%)',
          }}
        />
        {/* Lines */}
        <div style={{ position: 'absolute', top: 16, left: 12, right: 12, height: 1, background: 'rgba(255,255,255,0.15)' }} />
        <div style={{ position: 'absolute', top: 20, left: 12, right: 12, height: 1, background: 'rgba(255,255,255,0.1)' }} />
        <div style={{ position: 'absolute', bottom: 16, left: 12, right: 12, height: 1, background: 'rgba(255,255,255,0.15)' }} />
        {/* Pages on right edge */}
        <div
          style={{
            position: 'absolute',
            right: 0,
            top: 2,
            bottom: 2,
            width: 4,
            background: 'linear-gradient(90deg, #f5f0e0, #e8e0cc)',
            borderRadius: '0 4px 4px 0',
          }}
        />
      </div>
      <style>{`
        @keyframes bookFloat {
          from { transform: translateY(0) rotate(-1deg); }
          to { transform: translateY(-14px) rotate(1.5deg); }
        }
      `}</style>
    </div>
  )
}

export default function LandingPage() {
  return (
    <div className="landing">
      <Nav />

      {/* ── HERO ── */}
      <section className="hero" aria-label="Hero">
        {/* Ambient orbs */}
        <div className="hero-ambient" aria-hidden="true">
          <div className="hero-ambient-orb hero-ambient-orb-1" />
          <div className="hero-ambient-orb hero-ambient-orb-2" />
        </div>

        <div className="hero-content">
          <div className="hero-eyebrow" role="text">
            <span>✦</span> Your Personal Reading Sanctuary
          </div>

          <h1 className="hero-title">
            Every Great Story
            <br />
            <em className="hero-title-accent">Deserves to be Read</em>
          </h1>

          <p className="hero-subtitle">
            Rewamp Library transforms your PDF collection into a beautifully
            organized, distraction-free reading experience — with AI-powered
            book intelligence on the horizon.
          </p>

          <div className="hero-actions">
            <Link to="/library" className="btn btn-primary" id="hero-explore-btn">
              Explore the Library
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </Link>
            <a href="#features" className="btn btn-secondary" id="hero-learn-btn">
              Discover Features
            </a>
          </div>

          {/* Decorative floating books */}
          <div
            aria-hidden="true"
            style={{
              display: 'flex',
              gap: 20,
              justifyContent: 'center',
              alignItems: 'flex-end',
              marginBottom: 48,
              opacity: 0.75,
            }}
          >
            <CSSBook
              width={75}
              height={110}
              gradient="linear-gradient(160deg, #1a0a2e, #2d1250)"
              delay={0}
            />
            <CSSBook
              width={90}
              height={135}
              gradient="linear-gradient(160deg, #1a0808, #3d1a10)"
              delay={-2}
            />
            <CSSBook
              width={80}
              height={120}
              gradient="linear-gradient(160deg, #0a1a12, #1c4232)"
              delay={-4}
            />
            <CSSBook
              width={70}
              height={105}
              gradient="linear-gradient(160deg, #1a1208, #3d2c10)"
              delay={-1}
            />
            <CSSBook
              width={85}
              height={125}
              gradient="linear-gradient(160deg, #0a0e1a, #1a2b4a)"
              delay={-3}
            />
          </div>

          {/* Stats */}
          <div className="hero-stats">
            <div className="hero-stat">
              <div className="hero-stat-value">8</div>
              <div className="hero-stat-label">Books in Library</div>
            </div>
            <div className="hero-stat">
              <div className="hero-stat-value">∞</div>
              <div className="hero-stat-label">Pages to Explore</div>
            </div>
            <div className="hero-stat">
              <div className="hero-stat-value">AI</div>
              <div className="hero-stat-label">Coming Soon</div>
            </div>
          </div>
        </div>

        <a href="#features" className="hero-scroll" aria-label="Scroll to features">
          <div className="hero-scroll-arrow" aria-hidden="true" />
        </a>
      </section>

      {/* ── FEATURES ── */}
      <section id="features" className="section" aria-label="Features">
        <div className="section-inner">
          <p className="section-eyebrow">Why Rewamp Library</p>
          <h2 className="section-title">
            A Reading Experience<br />Built for Book Lovers
          </h2>
          <p className="section-subtitle">
            Every detail is crafted to keep you immersed in the pages,
            not fighting the interface.
          </p>

          <div className="features-grid">
            {features.map((f) => (
              <article key={f.title} className="feature-card">
                <div className="feature-icon" aria-hidden="true">{f.icon}</div>
                <h3 className="feature-title">{f.title}</h3>
                <p className="feature-description">{f.description}</p>
                {f.badge && (
                  <span className="feature-badge">{f.badge}</span>
                )}
              </article>
            ))}
          </div>
        </div>
      </section>

      <div className="section-divider" aria-hidden="true" />

      {/* ── HOW IT WORKS ── */}
      <section id="how-it-works" className="section how-it-works" aria-label="How it works">
        <div className="section-inner">
          <p className="section-eyebrow">Simple by Design</p>
          <h2 className="section-title">How Rewamp Library Works</h2>
          <p className="section-subtitle">
            From PDF files to a rich reading experience in seconds.
          </p>

          <div className="steps-grid">
            {steps.map((step) => (
              <div key={step.number} className="step-card">
                <div className="step-number" aria-hidden="true">{step.number}</div>
                <h3 className="step-title">{step.title}</h3>
                <p className="step-description">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <section className="section cta-section" aria-label="Call to action">
        <div className="cta-glow" aria-hidden="true" />
        <div className="section-inner">
          <p className="section-eyebrow">Ready to Begin?</p>
          <h2 className="cta-title">
            Open the Library.<br />
            <em style={{ fontStyle: 'italic', color: 'var(--accent-gold)' }}>Start Reading.</em>
          </h2>
          <p className="cta-subtitle">
            Your collection is waiting. Discover classic literature in a
            reading environment built for the love of books.
          </p>
          <Link to="/library" className="btn btn-primary" id="cta-explore-btn">
            Enter the Library
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
            </svg>
          </Link>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="footer">
        <div className="footer-inner">
          <div>
            <Link to="/" className="footer-logo" aria-label="Rewamp Library">
              <svg width="24" height="24" viewBox="0 0 32 32" fill="none">
                <rect width="32" height="32" rx="8" fill="var(--accent-gold)" fillOpacity="0.15" />
                <path d="M8 6h11a3 3 0 0 1 3 3v17a1 1 0 0 1-1 1H8a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z" fill="var(--accent-gold)" opacity="0.85" />
                <path d="M19 6h1a3 3 0 0 1 3 3v17a1 1 0 0 1-1 1h-3V6z" fill="var(--accent-gold-dark)" />
                <path d="M10 11h9M10 14h9M10 17h6" stroke="var(--bg-primary)" strokeWidth="1.2" strokeLinecap="round" />
              </svg>
              <span className="footer-logo-text">Rewamp Library</span>
            </Link>
            <p className="footer-tagline">A personal reading sanctuary.</p>
          </div>
          <div className="footer-copy">
            <p>Phase 1 — Reading & Library</p>
            <p style={{ marginTop: 4, color: 'var(--text-muted)' }}>AI features coming in Phase 2.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
