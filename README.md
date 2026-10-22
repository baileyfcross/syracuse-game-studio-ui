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

Upload the contents of `dist/` to any static host (e.g., Cloudflare Pages, Netlify, GitHub Pages with an appropriate base URL). Connect your custom domain through that host.

## Customize

- **Content and layout:** `src/App.vue`
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
