"use client";

import { isReducedMotion } from "@/lib/motion";
import { useEffect, useRef, useState } from "react";
import { gsap, ScrollTrigger, setupGsap } from "@/lib/gsap";
import { site } from "@/content/site";
import SplitText from "@/components/ui/SplitText";
import Reveal from "@/components/ui/Reveal";
import { plates } from "./AboutPlates";
import { fitVars } from "@/lib/type";

const GAP = 64;

export default function About() {
  const root = useRef<HTMLElement>(null);
  const seq = useRef<HTMLDivElement>(null);
  const stack = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const layers = site.about.layers;

  useEffect(() => {
    setupGsap();
    const reduced = isReducedMotion();
    const plateEls = Array.from(stack.current!.querySelectorAll<HTMLElement>("[data-plate]"));

    if (reduced) {
      plateEls.forEach((p, i) => gsap.set(p, { z: i * GAP, opacity: 1 }));
      return;
    }

    const mm = gsap.matchMedia();

    mm.add("(min-width: 1024px)", () => {
      gsap.set(plateEls, { z: (i: number) => -420 + i * 20, opacity: 0 });
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: seq.current,
          start: "top top",
          end: `+=${layers.length * 90}%`,
          scrub: 0.8,
          pin: true,
          anticipatePin: 1,
          onUpdate: (self) => setActive(Math.min(layers.length - 1, Math.floor(self.progress * layers.length * 0.999))),
        },
      });
      plateEls.forEach((p, i) => {
        tl.to(p, { z: i * GAP, opacity: 1, duration: 1, ease: "power3.out" }, i);
      });
      tl.to(stack.current, { rotateZ: -26, duration: layers.length, ease: "none" }, 0);
      return () => {
        tl.scrollTrigger?.kill();
        tl.kill();
      };
    });

    mm.add("(max-width: 1023px)", () => {
      gsap.set(plateEls, { z: (i: number) => i * 16, opacity: 1 });
      const tl = gsap.timeline({
        scrollTrigger: { trigger: seq.current, start: "top 85%", end: "bottom 35%", scrub: 0.6 },
      });
      plateEls.forEach((p, i) => tl.to(p, { z: i * GAP * 0.85, ease: "none", duration: 1 }, 0));
    });

    return () => mm.revert();
  }, [layers.length]);

  useEffect(() => {
    const t = setTimeout(() => ScrollTrigger.refresh(), 400);
    return () => clearTimeout(t);
  }, []);

  return (
    <section id="about" ref={root} aria-labelledby="about-title" className="relative">
      {/* Intro copy */}
      <div className="mx-auto max-w-[1800px] px-[var(--gutter)] pb-20 pt-24 sm:pb-24 md:pt-40 xl:pt-48">
        <Reveal className="label mb-8 flex items-center gap-4">
          <span className="text-cyan">02</span>
          <span className="h-px w-12 bg-line" />
          Decode · About
        </Reveal>

        <h2 id="about-title" className="section-title metal-text">
          <SplitText text="From silicon to software." />
        </h2>

        <div className="mt-12 grid gap-10 md:mt-16 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] lg:gap-20 xl:gap-24">
          <Reveal as="p" className="max-w-[24ch] font-display text-[clamp(1.45rem,0.9rem+2.2vw,3rem)] font-bold leading-[1.14] tracking-tight [text-wrap:balance]">
            {site.about.lead}
          </Reveal>
          <div className="space-y-6 text-[1.02rem] leading-relaxed text-mute lg:pt-3">
            {site.about.paragraphs.map((p, i) => (
              <Reveal as="p" key={i} delay={i * 0.1}>
                {p}
              </Reveal>
            ))}
          </div>
        </div>

        <Reveal as="ul" className="mt-16 flex flex-wrap gap-2.5" aria-label="Interests">
          {site.about.interests.map((t) => (
            <li key={t} className="chip transition-colors hover:border-cyan/60 hover:text-cyan">
              {t}
            </li>
          ))}
        </Reveal>
      </div>

      {/* Hardware → software sequence */}
      <div ref={seq} className="relative min-h-[100svh] overflow-hidden border-y border-line bg-[radial-gradient(80%_60%_at_70%_50%,rgba(56,232,255,0.06),transparent_70%)]">
        <div className="mx-auto grid h-full min-h-[calc(var(--svh)*100)] max-w-[1800px] items-center gap-6 px-[var(--gutter)] py-20 sm:py-24 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:py-0">
          {/* Text column */}
          <div className="cq relative z-10 min-w-0">
            <p className="label mb-6 flex items-center gap-3">
              <span className="h-1.5 w-1.5 rounded-full bg-cyan" />
              The stack, bottom to top
            </p>

            {/* Desktop: one layer at a time */}
            <div className="relative hidden min-h-[19rem] lg:block" aria-live="polite">
              {layers.map((l, i) => (
                <div
                  key={l.id}
                  aria-hidden={active !== i}
                  className={`absolute inset-0 transition-all duration-700 ease-[var(--ease-out)] ${active === i ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-6 opacity-0"}`}
                >
                  <div className="font-display text-[clamp(5rem,10vw,10rem)] font-extrabold leading-none tracking-tighter text-white/[0.07]">0{i + 1}</div>
                  <h3 className="fit-title font-display -mt-8 font-extrabold uppercase leading-[0.95] tracking-tight" style={fitVars(l.name, "clamp(2.25rem, 1rem + 2.6vw, 3.75rem)")}>
                    {l.name}
                  </h3>
                  <p className="mt-5 max-w-md text-lg text-mute">{l.note}</p>
                  <p className="label mt-6 !text-cyan">{l.tag}</p>
                </div>
              ))}
            </div>

            {/* Mobile / tablet: all layers listed */}
            <ol className="space-y-8 lg:hidden">
              {[...layers].reverse().map((l) => (
                <li key={l.id} className="border-l border-line pl-5">
                  <h3 className="font-display text-[clamp(1.25rem,1rem+1.2vw,1.6rem)] font-extrabold uppercase leading-tight tracking-tight">{l.name}</h3>
                  <p className="mt-2 text-mute">{l.note}</p>
                  <p className="label mt-3 !text-cyan">{l.tag}</p>
                </li>
              ))}
            </ol>

            <div className="mt-10 hidden items-center gap-2 lg:flex" aria-hidden>
              {layers.map((l, i) => (
                <span key={l.id} className={`h-[3px] flex-1 rounded-full transition-colors duration-500 ${i <= active ? "bg-gradient-to-r from-cyan to-violet" : "bg-white/10"}`} />
              ))}
            </div>
          </div>

          {/* 3D stack */}
          <div aria-hidden className="relative order-first mx-auto h-[min(calc(var(--svh)*52),24rem)] w-full max-w-[34rem] sm:h-[min(calc(var(--svh)*60),28rem)] lg:order-none lg:h-[min(calc(var(--svh)*78),40rem)]" style={{ perspective: "1600px" }}>
            <div
              ref={stack}
              className="absolute left-1/2 top-1/2 h-[min(46vw,15rem)] w-[min(46vw,15rem)] lg:h-[min(30vw,22rem)] lg:w-[min(30vw,22rem)]"
              style={{ transformStyle: "preserve-3d", transform: "translate(-50%,-50%) rotateX(62deg) rotateZ(-38deg)" }}
            >
              {layers.map((l, i) => {
                const Plate = plates[i];
                const on = active === i;
                return (
                  <div
                    key={l.id}
                    data-plate
                    className={`absolute inset-0 rounded-2xl border p-[10%] backdrop-blur-[2px] transition-[border-color,box-shadow,color,background-color] duration-500 ${
                      on
                        ? "border-cyan/80 bg-cyan/[0.12] text-cyan shadow-[0_0_48px_rgba(56,232,255,0.35)]"
                        : i < active
                          ? "border-white/20 bg-white/[0.05] text-white/45"
                          : "border-white/10 bg-white/[0.025] text-white/30"
                    }`}
                  >
                    <Plate />
                    <span className="label absolute bottom-2 left-3 !text-[0.55rem] !text-current">L{i}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
