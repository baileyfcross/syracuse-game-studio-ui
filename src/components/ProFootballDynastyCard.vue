<template>
  <a class="pfd-card" href="/ProFootballDynasty/" aria-label="Play Pro Football Dynasty in your browser">
    <div class="pfd-card__eyebrow">SYRACUSE GAME STUDIO · BROWSER GAME</div>
    <h2 class="pfd-card__heading">Pro Football Dynasty</h2>
    <p class="pfd-card__description">Build your roster, manage the salary cap, scout the draft, set your game plan, and lead a professional football franchise across multiple seasons.</p>
    <div class="pfd-card__features">32 fictional teams <span>·</span> Player contracts <span>·</span> Draft & free agency</div>
    <span class="pfd-card__play">Play the free prototype <span aria-hidden="true">→</span></span>
  </a>
</template>

<style scoped>
.pfd-card {
  --pfd-edge: #2b5067;
  display: block;
  position: relative;
  overflow: hidden;
  padding: clamp(1.5rem, 3vw, 2.5rem);
  border: 1px solid var(--pfd-edge);
  border-radius: 18px;
  color: #f2f7fc;
  text-decoration: none;
  background: radial-gradient(circle at 90% 8%, #274d65 0, transparent 42%), linear-gradient(135deg, #12232f, #0b151e);
  transition: border-color 140ms ease, transform 140ms ease;
}
.pfd-card:hover, .pfd-card:focus-visible { border-color: #88bcd7; transform: translateY(-2px); }
.pfd-card:focus-visible { outline: 2px solid #88bcd7; outline-offset: 3px; }
.pfd-card__eyebrow { font-size: .7rem; font-weight: 700; letter-spacing: .14em; color: #a1d5eb; }
.pfd-card__heading { margin: .85rem 0 .65rem; font-size: clamp(1.6rem, 4vw, 2.4rem); line-height: 1.12; color: #fff; }
.pfd-card__description { max-width: 55ch; line-height: 1.65; color: #d3dce6; }
.pfd-card__features { margin-top: 1.3rem; font-size: .85rem; color: #a5c4d6; }
.pfd-card__features span { color: #63879d; margin: 0 .3rem; }
.pfd-card__play { display: inline-flex; gap: .8rem; margin-top: 1.3rem; align-items: center; padding: .7rem 1rem; background: #1a728d; border-radius: 8px; color: #fff; font-weight: 700; }
@media (prefers-reduced-motion: reduce) { .pfd-card { transition: none; } }
</style>
