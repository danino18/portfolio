# Eyal Danino portfolio

Next.js 16 App Router + TypeScript + Tailwind 4 + React Three Fiber + GSAP/ScrollTrigger + Lenis. See README.md for architecture and commands.

## Constraints
- This is a REAL professional portfolio. Never invent employers, awards, papers, metrics, repo URLs or user counts. Content lives in `src/content/*`; a project gets `links` only if the URL exists.
- Every interactive visual must stay labeled as illustrative / web demo / toy simulation (`demoNote`).
- The `physical-ai-robot-arm` repo (danino18/physAI-arm-ex) is workshop code (UR5e + RG6 + RealSense, ROS 2, SAM 3, MoveIt, Gazebo); don't attribute components to Eyal individually without his say-so.
- Keep dependencies minimal (no drei/postprocessing). Animations read `scrollState` in `useFrame`; never set React state in animation loops.
- Custom CSS in `globals.css` must stay inside `@layer base` / `@layer components` or it overrides Tailwind utilities.
- Avoid oversized fixed layers (the grain overlay once broke screenshot capture); verify with `npm run typecheck` and `npm run build`.
