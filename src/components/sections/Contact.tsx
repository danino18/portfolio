"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { gsap, ScrollTrigger, setupGsap } from "@/lib/gsap";
import { scrollState } from "@/lib/scrollState";
import { site } from "@/content/site";
import Magnetic from "@/components/ui/Magnetic";
import { ArrowIcon, ExternalIcon, GitHubIcon, LinkedInIcon } from "@/components/ui/Icons";

const SceneCanvas = dynamic(() => import("@/components/three/SceneCanvas"), { ssr: false, loading: () => <ContactFallback /> });
const ContactScene = dynamic(() => import("@/components/three/ContactScene"), { ssr: false });

const DESKTOP_LINES = ["LET'S BUILD", "SOMETHING", "THAT MATTERS."];
const MOBILE_LINES = ["LET'S", "BUILD", "SOMETHING", "THAT", "MATTERS."];

function ContactFallback() {
  return (
    <div aria-hidden className="absolute inset-0 grid place-items-center px-[var(--gutter)]">
      <p className="display-xl metal-text text-center text-[clamp(2.2rem,8vw,7rem)]">{site.contact.headline}</p>
    </div>
  );
}

export default function Contact() {
  const root = useRef<HTMLElement>(null);
  const reveal = useRef<HTMLDivElement>(null);
  const [lines, setLines] = useState(DESKTOP_LINES);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const on = () => setLines(mq.matches ? MOBILE_LINES : DESKTOP_LINES);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);

  useEffect(() => {
    setupGsap();
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const items = reveal.current!.querySelectorAll("[data-reveal]");
    if (reduced) {
      scrollState.contact = 1;
      gsap.set(items, { autoAlpha: 1 });
      return;
    }
    const ctx = gsap.context(() => {
      gsap.set(items, { autoAlpha: 0, y: 30 });
      ScrollTrigger.create({
        trigger: root.current,
        start: "top top",
        end: "bottom bottom",
        scrub: true,
        onUpdate: (self) => {
          scrollState.contact = self.progress;
        },
        onLeaveBack: () => (scrollState.contact = 0),
      });
      gsap.timeline({ scrollTrigger: { trigger: root.current, start: "top top", end: "bottom bottom", scrub: 0.5 } }).to(items, { autoAlpha: 1, y: 0, stagger: 0.08, duration: 0.25, ease: "none" }, 0.62);
    }, root.current ?? undefined);
    return () => {
      ctx.revert();
      scrollState.contact = 0;
    };
  }, []);

  return (
    <section id="contact" ref={root} aria-labelledby="contact-title" className="relative h-[260svh] motion-reduce:h-[100svh]">
      <div className="sticky top-0 h-[100svh] min-h-[560px] overflow-hidden">
        <h2 id="contact-title" className="sr-only">
          {site.contact.headline}
        </h2>
        <div className="absolute inset-0" aria-hidden>
          <SceneCanvas fallback={<ContactFallback />} camera={{ position: [0, 0, 10], fov: 40 }} mountMargin="120% 0px">
            <ContactScene lines={lines} />
          </SceneCanvas>
        </div>
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_50%_50%,transparent,rgba(5,6,10,0.65))]" />

        <div ref={reveal} className="pointer-events-none absolute inset-x-0 bottom-0 z-10 mx-auto flex max-w-[1800px] flex-col items-center gap-6 px-[var(--gutter)] pb-[clamp(3rem,9vh,6rem)] text-center">
          <p data-reveal className="label max-w-md !text-ink/80">
            {site.contact.blurb}
          </p>
          <div data-reveal className="pointer-events-auto flex flex-wrap items-center justify-center gap-3">
            <Magnetic>
              <a
                href={site.links.github}
                target="_blank"
                rel="noopener noreferrer"
                className="group inline-flex items-center gap-3 rounded-full bg-ink px-7 py-4 font-mono text-xs font-semibold uppercase tracking-[0.12em] text-bg transition-colors hover:bg-cyan"
              >
                <GitHubIcon className="h-4 w-4" /> GitHub <ExternalIcon />
              </a>
            </Magnetic>
            <Magnetic>
              <a
                href={site.links.linkedin}
                target="_blank"
                rel="noopener noreferrer"
                className="group inline-flex items-center gap-3 rounded-full border border-white/30 bg-bg/50 px-7 py-4 font-mono text-xs uppercase tracking-[0.12em] backdrop-blur transition-colors hover:border-violet hover:text-[#b9a1ff]"
              >
                <LinkedInIcon className="h-4 w-4" /> LinkedIn <ExternalIcon />
              </a>
            </Magnetic>
          </div>
          <p data-reveal className="label !text-[0.6rem] !text-faint">
            <ArrowIcon className="mr-2 inline h-3 w-3 -rotate-90" />
            Move your cursor through the letters
          </p>
        </div>
      </div>
    </section>
  );
}
