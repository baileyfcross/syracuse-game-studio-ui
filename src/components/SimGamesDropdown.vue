
<script setup>
import { ref, nextTick, onMounted, onBeforeUnmount } from 'vue'

const emit = defineEmits(['navigate'])

const isOpen = ref(false)
const dropdown = ref(null)
const trigger = ref(null)
const firstLink = ref(null)

function toggleDropdown() {
  isOpen.value = !isOpen.value
}

function closeDropdown(restoreFocus = false) {
  if (!isOpen.value) return

  isOpen.value = false

  if (restoreFocus) {
    nextTick(() => trigger.value?.focus())
  }
}

function onClickOutside(event) {
  if (!dropdown.value?.contains(event.target)) {
    closeDropdown()
  }
}

function onKeydown(event) {
  if (event.key === 'Escape' && isOpen.value) {
    event.preventDefault()
    event.stopPropagation()
    closeDropdown(true)
  }
}

function onTriggerKeydown(event) {
  if (event.key === 'ArrowDown') {
    event.preventDefault()
    isOpen.value = true
    nextTick(() => firstLink.value?.focus())
  }
}

function onFocusOut(event) {
  if (!dropdown.value?.contains(event.relatedTarget)) {
    closeDropdown()
  }
}

function onNavigate() {
  closeDropdown()
  emit('navigate')
}

onMounted(() => {
  document.addEventListener('pointerdown', onClickOutside)
})

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onClickOutside)
})
</script>

<template>
  <div
    ref="dropdown"
    class="sim-games"
    @keydown="onKeydown"
    @focusout="onFocusOut"
  >
    <button
      ref="trigger"
      type="button"
      class="nav-special sim-games-trigger"
      :aria-expanded="isOpen"
      aria-controls="sim-games-list"
      @click="toggleDropdown"
      @keydown="onTriggerKeydown"
    >
      SIM GAMES
      <span class="sim-games-chevron" aria-hidden="true">▾</span>
    </button>

    <div
      v-if="isOpen"
      id="sim-games-list"
      class="sim-games-panel"
      role="group"
      aria-label="Simulation games"
    >
      <a
        ref="firstLink"
        href="/ProFootballDynasty/index.html"
        @click="onNavigate"
      >
        PRO FOOTBALL DYNASTY
        <span aria-hidden="true">↗</span>
      </a>

      <a
        href="/ProBasketballDynasty/index.html"
        @click="onNavigate"
      >
        PRO BASKETBALL DYNASTY
        <span aria-hidden="true">↗</span>
      </a>
    </div>
  </div>
</template>

<style scoped>
.sim-games {
  position: relative;
  flex-shrink: 0;
  max-width: 100%;
}

.sim-games-trigger {
  display: inline-flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 14px 19px;
  background: rgba(30, 27, 55, 0.38);
  border: 1px solid rgba(191, 178, 255, 0.38);
  color: #eef0fa;
  font: inherit;
  letter-spacing: inherit;
  white-space: nowrap;
  cursor: pointer;
  transition: color 0.2s ease, border-color 0.2s ease;
}

.sim-games-trigger:hover,
.sim-games-trigger[aria-expanded="true"] {
  color: var(--aqua);
  border-color: var(--lavender);
}

.sim-games-chevron {
  color: var(--aqua);
  padding-left: 0;
  transition: transform 0.2s ease;
}

.sim-games-trigger[aria-expanded="true"] .sim-games-chevron {
  transform: rotate(180deg);
}

.sim-games-panel {
  position: absolute;
  top: calc(100% + 10px);
  right: 0;
  z-index: 50;
  min-width: 295px;
  padding: 8px;
  background: #0c1020;
  border: 1px solid rgba(191, 178, 255, 0.38);
  box-shadow: 0 18px 35px rgba(0, 0, 0, 0.45);
}

.sim-games-panel a {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 13px 14px;
  color: #eef0fa;
  font-size: 14px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-decoration: none;
  white-space: nowrap;
  transition: background 0.2s ease, color 0.2s ease;
}

.sim-games-panel a:hover,
.sim-games-panel a:focus-visible {
  color: var(--aqua);
  background: rgba(180, 164, 255, 0.12);
}

.sim-games-panel a span {
  color: var(--aqua);
  padding-left: 0;
}

/* Existing mobile header breakpoint */
@media (max-width: 1040px) {
  .sim-games-panel {
    position: static;
    width: min(100%, 320px);
    min-width: 0;
    margin-top: 10px;
    box-shadow: none;
  }
}

@media (max-width: 760px) {
  .sim-games-trigger {
    font-size: 20px;
  }

  .sim-games-panel a {
    font-size: 17px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .sim-games-trigger,
  .sim-games-chevron,
  .sim-games-panel a {
    transition: none;
  }
}
</style>
