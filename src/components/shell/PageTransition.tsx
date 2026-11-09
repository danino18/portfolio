"use client";

import { isReducedMotion } from "@/lib/motion";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import gsap from "gsap";
import { scrollToId, scrollToTopInstant } from "@/lib/scroll";
import { ScrollTrigger } from "@/lib/gsap";

const BARS = 7;

interface Ctx {
  navigate: (href: string, label?: string) => void;
}
const TransitionCtx = createContext<Ctx>({ navigate: () => {} });
export const useTransition = () => useContext(TransitionCtx);

/**
 * Route transitions: a bank of "bus lanes" wipes the screen, the router
 * swaps pages underneath, then the lanes release. Same-page hash links just
 * scroll. Reduced motion skips the wipe entirely.
 */
export function PageTransitionProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const overlay = useRef<HTMLDivElement>(null);
  const label = useRef<HTMLDivElement>(null);
  const pending = useRef<{ hash: string | null } | null>(null);
  const failsafe = useRef<number | null>(null);
  const prevPath = useRef(pathname);

  const reveal = useCallback(() => {
    const o = overlay.current;
    if (!o) return;
    const bars = o.querySelectorAll(".lane");
    gsap.killTweensOf([bars, label.current]);
    gsap.to(label.current, { opacity: 0, duration: 0.2 });
    gsap.set(bars, { transformOrigin: "50% 0%" });
    gsap.to(bars, {
      scaleY: 0,
      duration: 0.7,
      ease: "expo.inOut",
      stagger: { each: 0.045, from: "edges" },
      onComplete: () => {
        o.style.pointerEvents = "none";
        ScrollTrigger.refresh();
      },
    });
  }, []);

  const navigate = useCallback(
    (href: string, text?: string) => {
      const [path, hash] = href.split("#");
      const targetPath = path || pathname;
      const reduced = isReducedMotion();

      if (targetPath === pathname) {
        if (hash) scrollToId(hash);
        else scrollToId("top");
        return;
      }
      if (reduced) {
        pending.current = { hash: hash ?? null };
        router.push(path + (hash ? `#${hash}` : ""));
        return;
      }
      const o = overlay.current;
      if (!o || pending.current) return;
      pending.current = { hash: hash ?? null };
      o.style.pointerEvents = "auto";
      if (label.current) label.current.textContent = text ?? targetPath.replace(/^\//, "") ?? "";
      const bars = o.querySelectorAll(".lane");
      gsap.set(bars, { transformOrigin: "50% 100%" });
      gsap.to(bars, {
        scaleY: 1,
        duration: 0.6,
        ease: "expo.inOut",
        stagger: { each: 0.045, from: "center" },
        onComplete: () => router.push(path + (hash ? `#${hash}` : "")),
      });
      gsap.to(label.current, { opacity: 1, duration: 0.3, delay: 0.25 });
      failsafe.current = window.setTimeout(() => {
        pending.current = null;
        reveal();
      }, 4000);
    },
    [pathname, router, reveal],
  );

  useEffect(() => {
    if (prevPath.current === pathname) return;
    prevPath.current = pathname;
    const p = pending.current;
    pending.current = null;
    if (failsafe.current) window.clearTimeout(failsafe.current);
    scrollToTopInstant();
    requestAnimationFrame(() => {
      if (p?.hash) scrollToId(p.hash, { immediate: true });
      ScrollTrigger.refresh();
      reveal();
    });
  }, [pathname, reveal]);

  const value = useMemo(() => ({ navigate }), [navigate]);

  return (
    <TransitionCtx.Provider value={value}>
      {children}
      <div ref={overlay} aria-hidden className="pointer-events-none fixed inset-0 z-[140] flex">
        {Array.from({ length: BARS }, (_, i) => (
          <div key={i} className="lane relative h-full flex-1 bg-[#07090f]" style={{ transform: "scaleY(0)" }}>
            <span className="absolute inset-x-0 top-0 h-px bg-cyan/60" />
            <span className="absolute inset-y-0 right-0 w-px bg-white/5" />
          </div>
        ))}
        <div ref={label} className="label absolute inset-0 grid place-items-center !text-cyan opacity-0" />
      </div>
    </TransitionCtx.Provider>
  );
}

/** Next.js link that plays the route transition. Keeps modified clicks native. */
export function TransitionLink({
  href,
  label,
  children,
  onClick,
  ...rest
}: Omit<React.ComponentProps<typeof Link>, "href"> & { href: string; label?: string }) {
  const { navigate } = useTransition();
  return (
    <Link
      href={href}
      {...rest}
      onClick={(e) => {
        onClick?.(e);
        if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
        e.preventDefault();
        navigate(href, label);
      }}
    >
      {children}
    </Link>
  );
}
