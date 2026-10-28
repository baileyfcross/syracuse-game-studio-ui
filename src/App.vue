<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { site } from './site'

const menuOpen = ref(false)
const features = [
  {
    id: '01',
    label: 'EXPLORE',
    title: 'A different path forward.',
    description: 'Seed-driven room routes and branching exits make the way ahead part of the adventure.',
    icon: 'route',
  },
  {
    id: '02',
    label: 'MOVE',
    title: 'Every direction matters.',
    description: 'Top-down movement with independent 360° aiming puts precision in your hands.',
    icon: 'target',
  },
  {
    id: '03',
    label: 'FIGHT',
    title: 'Up close or at range.',
    description: 'Knife and blaster combat bring two distinct approaches to each encounter.',
    icon: 'combat',
  },
]

const year = site.copyrightYear
let escapeHandler
function closeMenu() { menuOpen.value = false }
function toggleMenu() { menuOpen.value = !menuOpen.value }

onMounted(() => {
  escapeHandler = (event) => { if (event.key === 'Escape') closeMenu() }
  document.addEventListener('keydown', escapeHandler)
})
onBeforeUnmount(() => {
  if (escapeHandler) document.removeEventListener('keydown', escapeHandler)
})
</script>

<template>
  <div class="site-shell">
    <a class="skip-link" href="#main">Skip to content</a>
    <header class="site-header">
      <div class="header-inner container">
        <a class="brand" href="#top" aria-label="SyracuseGameStudio home" @click="closeMenu">
          <svg class="brand-mark" viewBox="0 0 48 48" role="presentation" aria-hidden="true">
            <path d="M24 2 46 24 24 46 2 24Z" fill="none" stroke="currentColor" stroke-width="1.5" />
            <path d="M24 9 39 24 24 39 9 24Z" fill="none" stroke="currentColor" stroke-width="1.5" opacity=".65" />
            <path d="M24 16 32 24 24 32 16 24Z" fill="currentColor" />
          </svg>
          <span class="brand-name">SYRACUSE<span>GAME</span>STUDIO<span class="brand-period">.</span></span>
        </a>

        <button class="menu-toggle" type="button" :aria-expanded="menuOpen" aria-controls="primary-navigation"
          :aria-label="menuOpen ? 'Close navigation' : 'Open navigation'" @click="toggleMenu">
          <span></span><span></span><span></span>
        </button>

        <nav id="primary-navigation" class="site-nav" :class="{ 'is-open': menuOpen }" aria-label="Main navigation">
          <a href="#game" @click="closeMenu">THE GAME</a>
          <a href="#experience" @click="closeMenu">THE EXPERIENCE</a>
          <a href="#studio" @click="closeMenu">OUR STUDIO</a>
          <a href="/AstralRuinShortStory" @click="closeMenu">SHORT STORY</a>
          <a href="#updates" class="nav-special" @click="closeMenu">DEVELOPMENT <span aria-hidden="true">↗</span></a>
          <a href="/ProFootballDynasty/index.html" class="nav-special" @click="closeMenu">PRO FOOTBALL DYNASTY <span aria-hidden="true">↗</span></a>
        </nav>
      </div>
    </header>

    <main id="main">
      <section id="top" class="hero">
        <div class="hero-art" aria-hidden="true">
          <img src="/astral-art.svg" alt="" fetchpriority="high" />
        </div>
        <div class="hero-art-wash" aria-hidden="true"></div>
        <div class="star-lines" aria-hidden="true"></div>
        <div class="container hero-container">
          <div class="hero-copy">
            <div class="eyebrow"><span class="eyebrow-line"></span> THE NEXT WORLD FROM SYRACUSEGAMESTUDIO</div>
            <p class="overline hero-overline">A SPACE-THEMED DUNGEON CRAWLER</p>
            <h1><span>ASTRAL</span><span class="ruin">RUIN<span class="title-dot">.</span></span></h1>
            <p class="hero-tagline">Every door is a decision.</p>
            <p class="hero-description">Chart a path through the unknown in a top-down adventure built around
              exploration, precise movement, and action.</p>
            <div class="hero-actions">
              <a class="button button-primary" href="#game">DISCOVER THE GAME <span aria-hidden="true">↗</span></a>
              <a class="button button-ghost" href="#studio">MEET THE STUDIO <span aria-hidden="true">↗</span></a>
              <a class="hero-story-link" href="/AstralRuinShortStory">READ THE SHORT STORY <span
                  aria-hidden="true">↗</span></a>
            </div>
          </div>
          <div class="hero-side-label" aria-hidden="true"><span>SGS / 001</span><span>ORBITAL ARCHIVE</span><span>EST.
              IN THE UNKNOWN</span></div>
          <div class="hero-bottom">
            <div class="status-indicator"><span class="pulse"></span> PROJECT STATUS <b>{{ site.status }}</b></div>
            <a class="scroll-cue" href="#game">SCROLL TO EXPLORE <span aria-hidden="true">↓</span></a>
          </div>
        </div>
      </section>

      <section class="info-strip" aria-label="Game at a glance">
        <div class="container info-strip-inner">
          <div><span class="strip-small">FEATURED PROJECT</span><strong>01 <span class="strip-divider">/</span> ASTRAL
              RUIN</strong></div>
          <div><span class="strip-small">FORMAT</span><strong>TOP-DOWN <span class="strip-divider">/</span> 2D</strong>
          </div>
          <div><span class="strip-small">GENRE</span><strong>SPACE DUNGEON CRAWLER</strong></div>
          <div class="strip-status"><span class="tiny-square"></span> IN DEVELOPMENT</div>
        </div>
      </section>

      <section id="game" class="intro-section section-padding">
        <div class="container intro-layout">
          <div class="section-meta"><span class="small-index">01 / THE GAME</span><span class="vertical-rule"></span>
          </div>
          <div class="intro-main">
            <p class="section-eyebrow">ENTER THE UNKNOWN</p>
            <h2>ONE MORE DOOR.<br /><em>ONE MORE DISCOVERY.</em></h2>
            <div class="intro-bottom">
              <p>Astral Ruin is a space-themed, top-down dungeon crawler in development at SyracuseGameStudio. Navigate
                an old derelict spaceship, make your way forward, and find your way home.</p>
              <div class="project-badge">
                <div class="badge-orbit"><span>AR</span></div><span>PROJECT<br />ASTRAL RUIN</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="experience" class="features-section section-padding">
        <div class="container">
          <div class="section-heading-row">
            <div>
              <p class="section-eyebrow">BUILT AROUND THE JOURNEY</p>
              <h2>THE <em>EXPERIENCE.</em></h2>
            </div>
            <p>Thoughtful systems. Focused action. A journey that keeps moving forward.</p>
          </div>
          <div class="feature-grid">
            <article v-for="feature in features" :key="feature.id" class="feature-card">
              <div class="feature-top"><span>{{ feature.id }} / {{ feature.label }}</span><span
                  class="feature-plus">+</span></div>
              <div class="feature-icon" aria-hidden="true">
                <svg v-if="feature.icon === 'route'" viewBox="0 0 80 80">
                  <rect x="7" y="34" width="15" height="15" rx="2" />
                  <rect x="57" y="9" width="15" height="15" rx="2" />
                  <rect x="57" y="57" width="15" height="15" rx="2" />
                  <path d="M22 41h15c11 0 7-24 20-24M37 41c11 0 7 24 20 24" />
                </svg>
                <svg v-else-if="feature.icon === 'target'" viewBox="0 0 80 80">
                  <circle cx="40" cy="40" r="26" />
                  <circle cx="40" cy="40" r="14" />
                  <circle cx="40" cy="40" r="3" fill="currentColor" stroke="none" />
                  <path d="M40 3v16M40 61v16M3 40h16M61 40h16" />
                </svg>
                <svg v-else viewBox="0 0 80 80">
                  <path d="m12 66 48-48 9-5-5 9-48 48-6 1zM12 12l56 56M26 12l42 42M10 26l43 42" />
                  <path d="m48 30 9 9M30 48l9 9" />
                </svg>
              </div>
              <h3>{{ feature.title }}</h3>
              <p>{{ feature.description }}</p>
              <div class="feature-foot"><span>ASTRAL RUIN</span><span aria-hidden="true">↗</span></div>
            </article>
          </div>
          <p class="features-note">* Game systems and artwork are in active development and may change before release.
          </p>
        </div>
      </section>

      <section class="statement-section">
        <div class="statement-image" aria-hidden="true"><img src="/astral-art.svg" alt="" loading="lazy" /></div>
        <div class="statement-vignette" aria-hidden="true"></div>
        <div class="container statement-container">
          <div class="statement-top"><span class="small-index">ASTRAL RUIN / TRANSMISSION 001</span><span>° UNKNOWN
              COORDINATES</span></div>
          <div class="statement-content">
            <p>BEYOND THE<br />NEXT <em>THRESHOLD.</em></p><span>There is always another way forward.</span>
          </div>
          <div class="statement-bottom"><span>ILLUSTRATIVE ARTWORK / NOT GAMEPLAY FOOTAGE</span><span>SGS - AR -
              001</span></div>
        </div>
      </section>

      <section id="studio" class="studio-section section-padding">
        <div class="container studio-layout">
          <div class="studio-intro">
            <p class="section-eyebrow">THE PEOPLE BEHIND THE PIXELS</p>
            <h2>INDEPENDENT<br />BY <em>DESIGN.</em></h2>
            <p>We are SyracuseGameStudio. We're creating games with an emphasis on meaningful mechanics, a distinctive
              atmosphere, and the joy of discovering what comes next.</p><a href="#updates" class="text-link">SEE WHAT
              WE'RE BUILDING <span aria-hidden="true">↗</span></a>
          </div>
          <div class="studio-people">
            <div class="studio-person">
              <img src="/profile-pics/b-cross.jpg" alt="Team Member 1" loading="lazy" />
              <span class="studio-person-name">Bailey Cross</span>
              <span class="studio-person-role">Lead Developer</span>
            </div>
            <div class="studio-person">
              <img src="/profile-pics/default-icon.jpg" alt="Team Member 2" loading="lazy" />
              <span class="studio-person-name">Nate P.</span>
              <span class="studio-person-role">Lead Developer</span>
            </div>
            <div class="studio-person">
              <img src="/profile-pics/default-icon.jpg" alt="Team Member 3" loading="lazy" />
              <span class="studio-person-name">Logan W.</span>
              <span class="studio-person-role">Art Designer</span>
            </div>
          </div>
          <div class="studio-graphic" aria-hidden="true">
            <div class="studio-square studio-square-a"></div>
            <div class="studio-square studio-square-b"></div>
            <div class="studio-square studio-square-c"></div>
            <div class="studio-graphic-center">SGS<span>®</span></div>
            <div class="studio-graphic-bottom">SYRACUSE / GAME / STUDIO</div>
          </div>
        </div>
      </section>

      <section id="updates" class="updates-section section-padding">
        <div class="container">
          <div class="updates-header">
            <div>
              <p class="section-eyebrow">THE JOURNEY IS UNDERWAY</p>
              <h2>STAY IN <em>THE LOOP.</em></h2>
            </div><span class="updates-tag"><span class="pulse"></span> ACTIVE DEVELOPMENT</span>
          </div>
          <a href="/ProFootballDynasty/index.html" class="updates-panel game-link"
            aria-label="Play Pro Football Dynasty in your browser">
            <div class="updates-panel-left">
              <span class="updates-kicker">FIELD NOTES / 001</span>

              <h3>Pro Football Dynasty.</h3>

              <p>
                Take control of a professional football franchise.
                Manage your roster, draft players, negotiate contracts,
                and build a championship-winning team.
              </p>

              <span class="updates-coming">
                PLAY IN YOUR BROWSER
                <span aria-hidden="true">↗</span>
              </span>
            </div>

            <div class="updates-panel-right">
              <div class="signal-ring signal-ring-one"></div>
              <div class="signal-ring signal-ring-two"></div>
              <div class="signal-ring signal-ring-three"></div>
              <div class="signal-core">✦</div>
            </div>
          </a>
          <div v-if="site.steamUrl || site.discordUrl || site.youtubeUrl || site.contactEmail" class="connect-row">
            <span>CONNECT WITH US</span>
            <div><a v-if="site.steamUrl" :href="site.steamUrl" target="_blank" rel="noopener noreferrer">STEAM ↗</a><a
                v-if="site.discordUrl" :href="site.discordUrl" target="_blank" rel="noopener noreferrer">DISCORD ↗</a><a
                v-if="site.youtubeUrl" :href="site.youtubeUrl" target="_blank" rel="noopener noreferrer">YOUTUBE ↗</a><a
                v-if="site.contactEmail" :href="`mailto:${site.contactEmail}`">EMAIL ↗</a></div>
          </div>
        </div>
      </section>
    </main>

    <footer class="site-footer">
      <div class="container footer-inner"><a href="#top" class="footer-brand">SYRACUSE<span>GAME</span>STUDIO<span
            class="brand-period">.</span></a><span>© {{ year }} SYRACUSEGAMESTUDIO. ALL RIGHTS RESERVED.</span><a
          href="#top" class="back-top">BACK TO TOP ↑</a></div>
    </footer>
  </div>
</template>
