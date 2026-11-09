# Eyal Danino — Portfolio

An immersive personal portfolio: a WebGL chip hero, a scroll-driven hardware-to-software sequence, five projects that each have their own interactive scene, a technical-universe graph and a particle finale.

**Stack:** Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · Three.js + React Three Fiber · GSAP + ScrollTrigger · Lenis. Custom GLSL shaders for the hero, project A, the maze screen and the contact finale. No other runtime dependencies (no drei, no postprocessing, no component library).

## Run locally

```bash
npm install
npm run dev        # http://localhost:3000
```

Other scripts:

```bash
npm run typecheck  # tsc --noEmit
npm run build      # production build
npm run start      # serve the production build
npm run test:e2e   # Playwright end-to-end checks (needs a build; starts `next start` itself)
npm run qa         # typecheck + build + e2e
```

The e2e suite (`tests/e2e`) checks horizontal overflow and heading fit at 320–2560 px, live resizing and landscape phones, that every project section exists, that project links are exactly the verified ones (and external links are safe), navigation (including the full-screen mobile menu), the Controlled Maze controls, the Wi-Fi tab order, the video embed, the no-WebGL fallbacks, reduced motion and WebGL context-loss recovery. Projects exist for Chromium (desktop + Pixel 7), Firefox and WebKit (desktop + iPhone 14); install missing engines with `npx playwright install firefox webkit`.

Quality can be forced for testing with a query string: `/?quality=0` (no WebGL fallback), `1` (low), `2` (medium), `3` (high). The chosen tier is exposed as `html[data-quality]`.

## Deploy to Vercel

1. Push this folder to a Git repository (GitHub, GitLab or Bitbucket).
2. In Vercel choose **Add New → Project**, import the repository. The framework preset (Next.js) is detected from `vercel.json`; no environment variables are required.
3. Optional: set `NEXT_PUBLIC_SITE_URL` (for example `https://your-domain.com`) so canonical URLs, the sitemap and Open Graph tags use your custom domain. Without it, Vercel's `VERCEL_PROJECT_PRODUCTION_URL` is used automatically.

Or from the CLI:

```bash
npm i -g vercel
vercel          # preview deployment
vercel --prod   # production
```

## Editing content

Everything the site says lives in `src/content/`:

| File | What it controls |
| --- | --- |
| `site.ts` | Name, taglines, About copy, hardware→software layers, contact text, links |
| `projects.ts` | The six projects (incl. the Navy innovation accelerator case study, sourced from navyreef.netlify.app): copy, status labels, typed links (`live` / `github` / `video`, each with a note on how it was verified), real media, credits, accent colors and the *documented / in-progress / illustrative* fact list shown on each case-study page |
| `mazeAssets.ts` | Sprite and font grids copied from the Controlled Maze repository (used by the browser version of the game) |
| `skills.ts` | Technical-universe nodes, edges and which projects each topic appears in |
| `locale.ts` | Language and text direction (`dir`) — add a Hebrew bundle and set `dir: "rtl"` |

Rules baked into the content model: a project only gets a `links` entry if the URL really exists and was checked; otherwise its case-study page is the detail view. Every interactive visual carries a `demoNote` saying what it is (illustrative, web demo, toy simulation, conceptual visualization).

**Project media.** `media` is real footage only. The robotic arm uses a YouTube embed (`kind: "youtube"`). To self-host a clip instead, put the files in `public/media/<slug>/` (for example `arm.mp4`, `arm.webm`, `arm-poster.jpg`) and use `kind: "file"` with those paths; `ProjectVideo` then renders a native `<video>` with `preload="none"`, poster, muted/inline autoplay while visible, controls and a fallback link.

## Architecture

```
src/
  app/                    layout, home page, /projects/[slug], SEO (sitemap, robots, manifest, OG image, icon)
  content/                data-driven copy (see above)
  lib/                    quality tiers, scroll state, Lenis helpers, sound, maze game FSM, rng
  components/
    shell/                SmoothScroll (Lenis↔GSAP), Cursor, Nav, Pipeline (scroll progress), PageTransition, Footer
    sections/             Hero, About, Projects, Universe, Contact
    projects/             ProjectShell + one *Experience per project, detail-page stage + sigils
    three/                R3F scenes (Hero, Dart, Maze, Arm, Contact), SceneCanvas host, fallbacks
    ui/                   SplitText, Reveal, Magnetic, icons
```

Notable engineering decisions:

- **One animation clock.** Lenis runs from `gsap.ticker` (`autoRaf: false`) and forwards scroll to ScrollTrigger, so pinned sections, scrubbed timelines and WebGL all read the same scroll position.
- **No React renders in animation loops.** Scroll, pointer and intro progress live in a plain mutable object (`lib/scrollState.ts`) read inside `useFrame`; HUDs write to the DOM directly.
- **Adaptive rendering.** `lib/quality.ts` requires WebGL2 (three.js r163+ has no WebGL1 path), reads the actual GPU (renderer string, texture limits, software rasterizers) to pick a starting tier, caps DPR and scales particle counts. Every canvas reports frame-time windows; quality is corrected in both directions relative to the display's own refresh interval (so 30 Hz battery throttling is not mistaken for a slow GPU), resolution drops before geometry, and the learned level is cached per GPU for the session.
- **Context loss.** `SceneCanvas` handles `webglcontextlost` by remounting a fresh canvas (twice at most, at a more conservative tier), then falls back to the 2D visual.
- **Motion preference.** `lib/motion.ts` + an inline head script set `html[data-motion]` from `prefers-reduced-motion` or the visitor's choice in the nav ("Motion: full / reduced"). Reduced motion removes smooth-scroll inertia, pinning, zooms, parallax, flying letters and the route wipe, but scenes keep a slow ambient animation instead of freezing.
- **Lazy, bounded WebGL.** `SceneCanvas` mounts a canvas only near the viewport, pauses it off-screen and unmounts it when far away, keeping within browser WebGL-context limits. Scenes are code-split with `next/dynamic`.
- **Fallbacks.** No WebGL, a scene error, or a shader that fails to compile on a given GPU (caught via `renderer.debug.onShaderError`) switch that scene to a Canvas-2D renderer: the hero chip and the DART helix → thread-grid morph have full 2D versions (`three/Canvas2DScenes.tsx`) with the same intro, scroll response and pointer glow; the maze game and the Wi-Fi visualization stay fully interactive in 2D. Scene errors right after a context loss are retried with backoff.
- **React-owned DOM.** Never remove or re-parent nodes React rendered: the hero is pinned inside a wrapper (GSAP's pin-spacer would otherwise break page navigation) and the boot veil is hidden, not removed.
- **Responsive type.** Display headings use `.fit-title` / `.section-title`: a fluid `clamp()` size that is also capped by the container width divided by the longest word (`--chars`, via container query units), so no word can overflow at any width.
- **Honest 3D.** The robot arm solves inverse kinematics live in the browser. The Controlled Maze demo (`lib/coralGame.ts`) follows the real game's rules and parameters — an autonomous bird, the player moving every coral opening together — with the project's own sprites, labeled as a browser approximation. The Wi-Fi sensing view (`lib/wifiSim.ts`) is a conceptual visualization with simulated signals.
- **Accessibility.** Semantic landmarks, a skip link, keyboard-operable demos (arrow keys move planner courses and the maze), `aria-live` status for the planner, split text exposed through `aria-label`, and visible focus rings.

## Notes

- Interface sound is synthesised with the Web Audio API, is off by default and starts only after the visitor turns it on.
- The Open Graph image and favicon are generated by `next/og` (`opengraph-image.tsx`, `icon.tsx`).
