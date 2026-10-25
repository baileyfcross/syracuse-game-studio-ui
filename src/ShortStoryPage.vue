<script setup>
import { onMounted, onBeforeUnmount } from 'vue'
import { shortStory } from './storyContent'
import SiteHeader from './components/SiteHeader.vue'
import SiteFooter from './components/SiteFooter.vue'

const hasStoryText = shortStory.sections.some(section => section.paragraphs?.length)
const pageTitle = 'Astral Ruin Short Story | SyracuseGameStudio'
let oldTitle
let descriptionElement
let oldDescription

onMounted(() => {
  oldTitle = document.title
  document.title = pageTitle
  descriptionElement = document.querySelector('meta[name="description"]')
  if (descriptionElement) {
    oldDescription = descriptionElement.getAttribute('content')
    descriptionElement.setAttribute('content', 'Read the Astral Ruin short story from SyracuseGameStudio.')
  }
})
onBeforeUnmount(() => {
  if (oldTitle) document.title = oldTitle
  if (descriptionElement && oldDescription !== undefined) descriptionElement.setAttribute('content', oldDescription)
})
</script>

<template>
  <div class="site-shell story-shell">
    <a class="skip-link" href="#main">Skip to content</a>
    <SiteHeader />

    <main id="main">
      <section class="story-hero" aria-labelledby="story-title">
        <div class="story-hero-art" aria-hidden="true"><img src="/astral-art.svg" alt="" /></div>
        <div class="story-hero-shade" aria-hidden="true"></div>
        <div class="container story-hero-inner">
          <a class="story-back" href="/">← BACK TO THE STUDIO</a>
          <p class="story-kicker">SYRACUSEGAMESTUDIO <span>/</span> ASTRAL RUIN FICTION</p>
          <h1 id="story-title">ASTRAL <em>RUIN.</em></h1>
          <p class="story-label">{{ shortStory.label }}</p>
          <p class="story-lede">{{ shortStory.introduction }}</p>
          <div class="story-hero-meta"><span>ORIGINAL FICTION</span><span class="story-meta-line"></span><span>{{ hasStoryText ? 'READ BELOW' : 'COMING SOON' }}</span></div>
        </div>
      </section>

      <section class="story-reading-section" aria-label="Short story text">
        <div class="container story-reading-frame">
          <aside class="story-margin-note" aria-hidden="true">
            <span>ASTRAL RUIN</span><span class="story-margin-line"></span><span>STORY ARCHIVE / 001</span>
          </aside>
          <div class="story-paper">
            <template v-if="hasStoryText">
              <div class="story-reader-heading"><span class="story-reading-label">A SHORT STORY</span><h2>{{ shortStory.title }}</h2></div>
              <section v-for="(section, index) in shortStory.sections" :key="index" class="story-chapter">
                <h3 v-if="section.heading">{{ section.heading }}</h3>
                <p v-for="(paragraph, paragraphIndex) in section.paragraphs" :key="paragraphIndex">{{ paragraph }}</p>
              </section>
              <div class="story-endmark" aria-hidden="true">✦</div>
            </template>
            <div v-else class="story-coming-soon">
              <span class="story-reading-label">STORY ARCHIVE / 001</span>
              <div class="story-orbit" aria-hidden="true"><span>✦</span></div>
              <h2>THE STORY<br /><em>IS COMING.</em></h2>
              <p>The Astral Ruin short story will be published here when it is ready. Return to this page for the finished story.</p>
              <a class="button button-primary" href="/">EXPLORE ASTRAL RUIN <span aria-hidden="true">↗</span></a>
            </div>
          </div>
          <aside class="story-right-note" aria-hidden="true">SGS / NARRATIVE ARCHIVE</aside>
        </div>
      </section>
    </main>

    <SiteFooter />
  </div>
</template>
