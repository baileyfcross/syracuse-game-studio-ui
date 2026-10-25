# SyracuseGameStudio Website

A responsive Vue 3 + Vite starter site featuring **Astral Ruin**.

## Start the website

Requirements: Node.js 22.18+ (or another version supported by your installed Vue/Vite toolchain).

```bash
npm install
npm run dev
```

Visit the local address shown in your terminal (typically `http://localhost:5173`).

For a production-ready build:

```bash
npm run build
```

Deploy the `dist/` output to **Azure Static Web Apps**. The existing GitHub Actions workflow for your repository can keep its `app_location: "/"` and `output_location: "dist"` configuration. The file `public/staticwebapp.config.json` is copied into `dist/` by Vite and enables direct loading and refreshing of `/AstralRuinShortStory`.

## Customize

- **Homepage content and layout:** `src/App.vue`
- **Short story page:** `src/ShortStoryPage.vue`
- **Short story text:** `src/storyContent.js` (replace the empty `sections` array with the completed story)
- **Shared navigation/footer:** `src/components/SiteHeader.vue` and `SiteFooter.vue`
- **Route selection:** `src/main.js` (maps `/AstralRuinShortStory` to the short story page)
- **Azure SPA fallback:** `public/staticwebapp.config.json`
- **Theme and responsive styling:** `src/styles.css`
- **Studio links/contact/status:** `src/site.js`
- **Title and SEO:** `index.html`
- **Logo favicon:** `public/favicon.svg`
- **Decorative concept artwork:** `public/astral-art.svg`
- **Sharing thumbnail:** `public/social-preview.png`

Real screenshots, store URLs, community links, and contact email are intentionally not invented. When ready, add your verified links to `src/site.js`. Empty links are hidden.

The decorative hero illustration is **not an in-game screenshot**. Replace it with actual screenshots or approved game artwork when available. Do not publicly imply planned, unimplemented mechanics are playable.

## Notes

- No backend, forms, user tracking or analytics are included.
- Navigation and mobile menu are functional.
- The site uses public Google Fonts, with system fallbacks.
- If you already have a Vue website, you can adapt the `App.vue`, `styles.css`, and `public/` files into your existing structure instead of replacing your current app.

## Short story URL

The homepage includes a **SHORT STORY** navigation link and a second link in the homepage hero.
The story URL is exactly `https://www.syracusegamestudio.org/AstralRuinShortStory`.
The page is currently marked **COMING SOON** because no finished manuscript was provided.

To publish the story, open `src/storyContent.js` and populate `sections` with your text.
Each section has optional `heading` and a `paragraphs` array of strings. The page automatically replaces the placeholder with readable story sections once at least one paragraph is present.

This website uses minimal pathname-based selection (no Vue Router dependency), appropriate for these two pages. Full navigations between the homepage and the story page are intentional. Azure's `navigationFallback` ensures that requesting the story path directly still serves the Vue application.

Do not delete your existing `.github/workflows/` configuration when copying these updates into an existing repository.
