import { createApp } from 'vue'
import HomePage from './App.vue'
import ShortStoryPage from './ShortStoryPage.vue'
import './styles.css'

// Two-page routing without requiring an additional router dependency.
// Azure Static Web Apps rewrites requests for Vue pages to index.html;
// this entry point selects the correct page from the browser pathname.
const path = window.location.pathname.replace(/\/+$/, '') || '/'
const page = path === '/AstralRuinShortStory' ? ShortStoryPage : HomePage
createApp(page).mount('#app')
