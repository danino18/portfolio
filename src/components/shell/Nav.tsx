"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { sfx } from "@/lib/sfx";
import { site } from "@/content/site";
import { TransitionLink } from "./PageTransition";

function SoundToggle() {
  const on = useSyncExternalStore(
    (cb) => sfx.subscribe(cb),
    () => sfx.enabled,
    () => false,
  );
  return (
    <button
      type="button"
      onClick={() => sfx.set(!on)}
      aria-pressed={on}
      aria-label={on ? "Turn interface sound off" : "Turn interface sound on"}
      className="label inline-flex items-center gap-2 rounded-full border border-line px-3 py-2 transition-colors hover:border-white/30 hover:text-ink"
    >
      <span aria-hidden className="flex h-3 items-end gap-[2px]">
        {[0.5, 1, 0.7, 0.9].map((h, i) => (
          <span key={i} className={`w-[2px] rounded-full ${on ? "bg-cyan" : "bg-faint"}`} style={{ height: on ? `${h * 100}%` : "30%", transition: "height .3s" }} />
        ))}
      </span>
      Sound {on ? "on" : "off"}
    </button>
  );
}

export default function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 40);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);

  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", esc);
    document.documentElement.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", esc);
      document.documentElement.style.overflow = "";
    };
  }, [open]);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-[70] transition-[background,border-color,backdrop-filter] duration-500 ${
        scrolled ? "border-b border-line bg-bg/60 backdrop-blur-xl" : "border-b border-transparent"
      }`}
    >
      <div className="mx-auto flex h-[var(--nav-h)] max-w-[1800px] items-center justify-between px-[var(--gutter)]">
        <TransitionLink href="/" label="home" className="group flex items-center gap-3" aria-label="Eyal Danino — home">
          <span className="relative grid h-9 w-9 place-items-center rounded-[10px] border border-white/20 bg-white/[0.03] font-display text-sm font-extrabold tracking-tight transition-colors group-hover:border-cyan">
            ED
            <span aria-hidden className="absolute -right-[3px] top-2 h-[5px] w-[5px] rounded-full bg-cyan shadow-[0_0_8px_#38e8ff]" />
          </span>
          <span className="label hidden !text-ink sm:block">{site.name}</span>
        </TransitionLink>

        <nav aria-label="Primary" className="hidden items-center gap-1 md:flex">
          {site.nav.map((n) => (
            <TransitionLink key={n.id} href={`/#${n.id}`} className="label rounded-full px-4 py-2 transition-colors hover:text-ink">
              {n.label}
            </TransitionLink>
          ))}
          <span className="mx-2 h-4 w-px bg-line" />
          <SoundToggle />
        </nav>

        <button
          type="button"
          className="label flex items-center gap-2 rounded-full border border-line px-4 py-2 md:hidden"
          aria-expanded={open}
          aria-controls="mobile-menu"
          onClick={() => setOpen((o) => !o)}
        >
          {open ? "Close" : "Menu"}
          <span aria-hidden className="relative h-2 w-3">
            <span className={`absolute left-0 top-0 h-px w-full bg-current transition-transform ${open ? "translate-y-[4px] rotate-45" : ""}`} />
            <span className={`absolute bottom-0 left-0 h-px w-full bg-current transition-transform ${open ? "-translate-y-[3px] -rotate-45" : ""}`} />
          </span>
        </button>
      </div>

      <div
        id="mobile-menu"
        hidden={!open}
        className="fixed inset-0 top-[var(--nav-h)] z-[65] flex flex-col justify-between bg-bg/95 px-[var(--gutter)] pb-10 pt-8 backdrop-blur-2xl md:hidden"
      >
        <ul className="flex flex-col gap-2">
          {site.nav.map((n, i) => (
            <li key={n.id}>
              <TransitionLink href={`/#${n.id}`} onClick={() => setOpen(false)} className="font-display flex items-baseline gap-4 py-2 text-5xl font-extrabold uppercase tracking-tight">
                <span className="label">0{i + 1}</span>
                {n.label}
              </TransitionLink>
            </li>
          ))}
        </ul>
        <div className="flex flex-col gap-4">
          <SoundToggle />
          <div className="label flex gap-6">
            <a href={site.links.github} target="_blank" rel="noopener noreferrer" className="!text-ink">GitHub ↗</a>
            <a href={site.links.linkedin} target="_blank" rel="noopener noreferrer" className="!text-ink">LinkedIn ↗</a>
          </div>
        </div>
      </div>
    </header>
  );
}
