"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import gsap from "gsap";
import { ScrollTrigger, setupGsap } from "@/lib/gsap";
import { scrollState } from "@/lib/scrollState";
import { scrollToId } from "@/lib/scroll";
import { site } from "@/content/site";

/**
 * Scroll progress as a CPU pipeline: five stages (fetch → writeback) with a
 * data packet riding the bus. Vertical on desktop, a thin bar on mobile.
 */
export default function Pipeline() {
  const pathname = usePathname();
  const [active, setActive] = useState(0);
  const fill = useRef<HTMLDivElement>(null);
  const packet = useRef<HTMLDivElement>(null);
  const mFill = useRef<HTMLDivElement>(null);
  const chip = useRef<HTMLDivElement>(null);
  const home = pathname === "/";

  useEffect(() => {
    if (!home) return;
    setupGsap();
    const triggers = site.stages.map((s, i) =>
      ScrollTrigger.create({
        trigger: s.id === "top" ? "#top" : `#${s.id}`,
        start: "top 55%",
        end: "bottom 55%",
        onToggle: (self) => self.isActive && setActive(i),
      }),
    );
    // Also derive the active stage from section positions every few frames:
    // robust against fast jumps (anchor links, Home/End) that skip toggles.
    let frame = 0;
    let last = -1;
    const els = site.stages.map((st) => document.getElementById(st.id));
    const update = () => {
      if (++frame % 8 === 0) {
        const line = window.innerHeight * 0.55;
        let idx = 0;
        els.forEach((el, i) => {
          if (el && el.getBoundingClientRect().top <= line) idx = i;
        });
        if (idx !== last) {
          last = idx;
          setActive(idx);
        }
      }
      const p = scrollState.page;
      if (fill.current) fill.current.style.transform = `scaleY(${p})`;
      if (packet.current) packet.current.style.transform = `translate(-50%, ${p * 100}%)`;
      if (mFill.current) mFill.current.style.transform = `scaleX(${p})`;
    };
    gsap.ticker.add(update);
    // Mobile stage chip: visible while scrolling only, so it never sits on top of content.
    let hideT = 0;
    const onScroll = () => {
      chip.current?.setAttribute("data-on", "1");
      window.clearTimeout(hideT);
      hideT = window.setTimeout(() => chip.current?.removeAttribute("data-on"), 1400);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.clearTimeout(hideT);
      gsap.ticker.remove(update);
      triggers.forEach((t) => t.kill());
    };
  }, [home]);

  if (!home) return null;

  return (
    <>
      {/* Desktop: vertical pipeline */}
      <nav aria-label="Page sections" className="pointer-events-none fixed right-[max(1.25rem,var(--safe-r))] top-1/2 z-[60] hidden -translate-y-1/2 lg:block">
        <div className="relative flex h-[44vh] max-h-[420px] flex-col items-end justify-between">
          <div className="absolute right-[5px] top-0 h-full w-px bg-white/10" />
          <div ref={fill} className="absolute right-[5px] top-0 h-full w-px origin-top bg-gradient-to-b from-cyan to-violet" style={{ transform: "scaleY(0)" }} />
          <div className="absolute right-[5px] top-0 h-full w-0">
            <div ref={packet} className="absolute left-0 top-0 h-3 w-3 -translate-x-1/2 rounded-sm bg-white shadow-[0_0_14px_#38e8ff,0_0_28px_#8b5cff]" style={{ marginTop: "-6px" }} />
          </div>
          {site.stages.map((s, i) => (
            <button
              key={s.id}
              type="button"
              onClick={() => scrollToId(s.id)}
              aria-label={`Go to ${s.caption}`}
              aria-current={active === i ? "true" : undefined}
              className="group pointer-events-auto relative flex items-center gap-3 py-1"
            >
              <span className={`label !text-[0.6rem] transition-all duration-500 ${active === i ? "translate-x-2 !text-cyan opacity-0 group-hover:translate-x-0 group-hover:opacity-100 min-[1500px]:translate-x-0 min-[1500px]:opacity-100" : "translate-x-2 opacity-0 group-hover:translate-x-0 group-hover:opacity-100"}`}>
                {s.label}
              </span>
              <span className={`block h-[11px] w-[11px] rounded-[3px] border transition-all duration-500 ${active === i ? "scale-110 border-cyan bg-cyan shadow-[0_0_14px_#38e8ff]" : "border-white/30 bg-bg group-hover:border-white"}`} />
            </button>
          ))}
        </div>
      </nav>

      {/* Mobile / tablet: top progress bus */}
      <div aria-hidden className="pointer-events-none fixed inset-x-0 top-0 z-[75] h-[2px] bg-white/5 lg:hidden">
        <div ref={mFill} className="h-full origin-left bg-gradient-to-r from-cyan to-violet" style={{ transform: "scaleX(0)" }} />
      </div>
      <div
        ref={chip}
        aria-hidden
        className="label pointer-events-none fixed bottom-[calc(var(--safe-b)+1rem)] left-[max(1rem,var(--safe-l))] z-[60] translate-y-2 rounded-full border border-line bg-bg/80 px-3 py-1.5 !text-[0.6rem] opacity-0 backdrop-blur transition-[opacity,transform] duration-300 data-[on]:translate-y-0 data-[on]:opacity-100 lg:hidden"
      >
        <span className="text-cyan">{site.stages[active].label}</span> · {site.stages[active].caption}
      </div>
    </>
  );
}
