"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { gsap, ScrollTrigger, setupGsap } from "@/lib/gsap";
import { scrollState } from "@/lib/scrollState";
import { scrollToId } from "@/lib/scroll";
import { site } from "@/content/site";
import SplitText from "@/components/ui/SplitText";
import Magnetic from "@/components/ui/Magnetic";
import HeroFallback from "@/components/three/HeroFallback";
import { ArrowIcon, ExternalIcon, GitHubIcon, LinkedInIcon } from "@/components/ui/Icons";

const SceneCanvas = dynamic(() => import("@/components/three/SceneCanvas"), { ssr: false, loading: () => <HeroFallback /> });
const HeroScene = dynamic(() => import("@/components/three/HeroScene"), { ssr: false });

const SEEN_KEY = "ed-intro-seen";

export default function Hero() {
  const root = useRef<HTMLElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const boot = useRef<HTMLSpanElement>(null);
  const [introSeconds, setIntroSeconds] = useState(3.6);
  const [introDone, setIntroDone] = useState(false);

  useEffect(() => {
    setupGsap();
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let seen = false;
    try {
      seen = sessionStorage.getItem(SEEN_KEY) === "1";
      sessionStorage.setItem(SEEN_KEY, "1");
    } catch {
      /* storage unavailable */
    }
    const dur = reduced ? 0.01 : seen ? 1.6 : 3.6;
    setIntroSeconds(dur);
    scrollState.introSkip = false;

    const veil = document.getElementById("boot-veil");
    const el = root.current!;

    const ctx = gsap.context(() => {
      const chars = el.querySelectorAll("[data-hero-title] .split-char");
      const tag = el.querySelectorAll("[data-hero-tag] .split-char");
      const fades = el.querySelectorAll("[data-hero-fade]");

      let tl: gsap.core.Timeline | null = null;
      if (reduced) {
        veil?.remove();
        setIntroDone(true);
      } else {
        gsap.set(chars, { yPercent: 115, rotate: 5 });
        gsap.set(tag, { yPercent: 115, opacity: 0 });
        gsap.set(fades, { y: 24, opacity: 0 });
        tl = gsap.timeline({ delay: 0.15 });
        if (veil) tl.to(veil, { opacity: 0, duration: 0.45, ease: "power2.out", onComplete: () => veil.remove() }, 0);
        tl.to(chars, { yPercent: 0, rotate: 0, duration: 1.3, ease: "expo.out", stagger: 0.05 }, dur * 0.42)
          .to(tag, { yPercent: 0, opacity: 1, duration: 0.9, ease: "expo.out", stagger: 0.018 }, dur * 0.42 + 0.55)
          .to(fades, { y: 0, opacity: 1, duration: 1, ease: "expo.out", stagger: 0.12 }, dur * 0.42 + 0.9);

        const skip = () => {
          scrollState.introSkip = true;
          tl?.timeScale(4);
        };
        const onKey = (e: KeyboardEvent) => {
          if (e.key === "Tab") return;
          skip();
        };
        window.addEventListener("pointerdown", skip, { once: true });
        window.addEventListener("keydown", onKey, { once: true });
        window.addEventListener("wheel", skip, { once: true, passive: true });
        el.dataset.skip = "1";
        (el as HTMLElement & { _skip?: () => void })._skip = skip;
      }

      // Pin and dive: scrubbed exit that hands off to the About section.
      if (!reduced) {
        const exit = gsap.timeline({
          scrollTrigger: {
            trigger: el,
            start: "top top",
            end: "+=110%",
            scrub: 0.6,
            pin: true,
            anticipatePin: 1,
          },
        });
        exit
          .to(content.current, { yPercent: -18, opacity: 0, scale: 1.06, ease: "none" }, 0.05)
          .to("[data-hero-hint]", { opacity: 0, ease: "none", duration: 0.2 }, 0);
      }

      const progress = () => {
        const p = scrollState.intro;
        if (boot.current) boot.current.textContent = String(Math.round(p * 100)).padStart(3, "0");
        if (p >= 1) {
          setIntroDone(true);
          gsap.ticker.remove(progress);
        }
      };
      gsap.ticker.add(progress);
    }, el);

    return () => {
      ctx.revert();
      ScrollTrigger.refresh();
    };
  }, []);

  const skipIntro = () => {
    scrollState.introSkip = true;
    (root.current as (HTMLElement & { _skip?: () => void }) | null)?._skip?.();
  };

  return (
    <section id="top" ref={root} aria-label="Introduction" className="relative h-[100svh] min-h-[620px] overflow-hidden">
      <div className="absolute inset-0" aria-hidden>
        <SceneCanvas fallback={<HeroFallback />} camera={{ position: [0, 0, 12], fov: 38, near: 0.1, far: 80 }} alwaysOn>
          <HeroScene introSeconds={introSeconds} />
        </SceneCanvas>
      </div>
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_top,#05060a_6%,rgba(5,6,10,0.55)_36%,transparent_62%)]" />
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-bg/80 to-transparent" />

      <div ref={content} className="relative z-10 mx-auto flex h-full max-w-[1800px] flex-col justify-end px-[var(--gutter)] pb-[clamp(2.5rem,7vh,5rem)] pt-28">
        <div data-hero-fade className="label mb-5 flex flex-wrap items-center gap-x-6 gap-y-2">
          <span className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-phosphor shadow-[0_0_10px_#7dff9a]" style={{ animation: "pulse-dot 2s infinite" }} />
            System online
          </span>
          <span className="hidden sm:inline">Technion · Computer Engineering</span>
          <span className="hidden md:inline">
            Boot <span ref={boot} className="text-cyan">000</span>%
          </span>
        </div>

        <h1 aria-label="Eyal Danino" data-hero-title className="display-xl metal-text text-[clamp(3rem,13.2vw,15rem)]">
          <SplitText text="EYAL" trigger="manual" className="block" />
          <SplitText text="DANINO" trigger="manual" className="block" />
        </h1>

        <div className="mt-6 grid gap-8 md:mt-8 md:grid-cols-[1.3fr_1fr] md:items-end">
          <div>
            <p data-hero-tag className="font-display text-[clamp(1.05rem,2.6vw,2.25rem)] font-bold uppercase leading-tight tracking-[0.01em]">
              <SplitText text={site.tagline} trigger="manual" className="glow-text" />
            </p>
            <p data-hero-fade className="mt-4 max-w-2xl text-[0.95rem] text-mute md:text-base">
              {site.subheadline.map((s, i) => (
                <span key={s}>
                  {i > 0 && (
                    <span aria-hidden className="mx-2 text-faint">
                      |
                    </span>
                  )}
                  <span className={i === 0 ? "text-ink" : ""}>{s}</span>
                </span>
              ))}
            </p>
          </div>

          <div data-hero-fade className="flex flex-wrap items-center gap-3 md:justify-end">
            <Magnetic>
              <button
                type="button"
                onClick={() => scrollToId("work")}
                data-cursor="Go"
                className="group relative inline-flex items-center gap-3 overflow-hidden rounded-full bg-ink px-6 py-3.5 font-mono text-[0.72rem] font-semibold uppercase tracking-[0.12em] text-bg transition-transform"
              >
                <span aria-hidden className="absolute inset-0 -translate-x-full bg-gradient-to-r from-cyan to-violet transition-transform duration-500 ease-out group-hover:translate-x-0" />
                <span className="relative">Explore my work</span>
                <ArrowIcon className="relative h-4 w-4 transition-transform group-hover:translate-x-1" />
              </button>
            </Magnetic>
            <Magnetic>
              <a
                href={site.links.github}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2.5 rounded-full border border-white/20 bg-white/[0.03] px-5 py-3.5 font-mono text-[0.72rem] uppercase tracking-[0.12em] backdrop-blur transition-colors hover:border-cyan hover:text-cyan"
              >
                <GitHubIcon /> GitHub <ExternalIcon />
              </a>
            </Magnetic>
            <Magnetic>
              <a
                href={site.links.linkedin}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2.5 rounded-full border border-white/20 bg-white/[0.03] px-5 py-3.5 font-mono text-[0.72rem] uppercase tracking-[0.12em] backdrop-blur transition-colors hover:border-violet hover:text-[#b9a1ff]"
              >
                <LinkedInIcon /> LinkedIn <ExternalIcon />
              </a>
            </Magnetic>
          </div>
        </div>
      </div>

      <div data-hero-hint className="pointer-events-none absolute inset-x-0 bottom-3 z-10 hidden justify-center md:flex">
        <span className="label flex items-center gap-3 !text-[0.6rem]">
          <span aria-hidden className="relative block h-7 w-px overflow-hidden bg-white/15">
            <span className="absolute inset-x-0 top-0 h-3 bg-cyan" style={{ animation: "scan 1.8s ease-in-out infinite" }} />
          </span>
          Scroll
        </span>
      </div>

      {!introDone && (
        <button
          type="button"
          onClick={skipIntro}
          className="label absolute right-[var(--gutter)] top-[calc(var(--nav-h)+0.75rem)] z-20 rounded-full border border-line bg-bg/60 px-3.5 py-2 backdrop-blur transition-colors hover:border-cyan hover:text-cyan"
        >
          Skip intro ↦
        </button>
      )}
    </section>
  );
}
