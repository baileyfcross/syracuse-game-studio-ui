<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'

const menuOpen = ref(false)
const isStoryPage = typeof window !== 'undefined' && window.location.pathname.replace(/\/+$/, '') === '/AstralRuinShortStory'
function closeMenu() { menuOpen.value = false }
function toggleMenu() { menuOpen.value = !menuOpen.value }
function onKeydown(event) { if (event.key === 'Escape') closeMenu() }

onMounted(() => document.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => document.removeEventListener('keydown', onKeydown))
</script>

<template>
  <header class="site-header">
    <div class="header-inner container">
      <a class="brand" href="/" aria-label="SyracuseGameStudio home" @click="closeMenu">
        <svg class="brand-mark" viewBox="0 0 48 48" role="presentation" aria-hidden="true">
          <path d="M24 2 46 24 24 46 2 24Z" fill="none" stroke="currentColor" stroke-width="1.5"/>
          <path d="M24 9 39 24 24 39 9 24Z" fill="none" stroke="currentColor" stroke-width="1.5" opacity=".65"/>
          <path d="M24 16 32 24 24 32 16 24Z" fill="currentColor"/>
        </svg>
        <span class="brand-name">SYRACUSE<span>GAME</span>STUDIO<span class="brand-period">.</span></span>
      </a>

      <button class="menu-toggle" type="button" :aria-expanded="menuOpen" aria-controls="primary-navigation" :aria-label="menuOpen ? 'Close navigation' : 'Open navigation'" @click="toggleMenu">
        <span></span><span></span><span></span>
      </button>

      <nav id="primary-navigation" class="site-nav" :class="{ 'is-open': menuOpen }" aria-label="Main navigation">
        <a href="/#game" @click="closeMenu">THE GAME</a>
        <a href="/#experience" @click="closeMenu">THE EXPERIENCE</a>
        <a href="/#studio" @click="closeMenu">OUR STUDIO</a>
        <a href="/AstralRuinShortStory" class="nav-story" :aria-current="isStoryPage ? 'page' : undefined" @click="closeMenu">SHORT STORY <span aria-hidden="true">↗</span></a>
        <a href="/#updates" class="nav-special" @click="closeMenu">DEVELOPMENT <span aria-hidden="true">↗</span></a>
      </nav>
    </div>
  </header>
</template>

