"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { CoralGame, FSM_LABEL, FSM_STATES, type Difficulty, type GameState } from "@/lib/coralGame";
import { sfx } from "@/lib/sfx";

const SceneCanvas = dynamic(() => import("@/components/three/SceneCanvas"), { ssr: false });
const MazeScene = dynamic(() => import("@/components/three/MazeScene"), { ssr: false });

/**
 * Flat VGA view: the 640×480 game buffer straight on screen, pixel-perfect.
 * Used when WebGL is unavailable and as the "Screen" view on any device.
 * Drives the game loop itself (the 3D scene does that when it is mounted).
 */
function FlatScreen({ game, drive }: { game: CoralGame; drive: boolean }) {
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const c = game.canvas;
    c.style.cssText = "width:100%;height:100%;image-rendering:pixelated;display:block;border-radius:10px";
    host.current?.appendChild(c);
    let raf = 0;
    let last = performance.now();
    let visible = true;
    const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting));
    if (host.current) io.observe(host.current);
    const loop = (t: number) => {
      const dt = Math.max(0, Math.min(0.1, (t - last) / 1000));
      last = t;
      if (drive && visible && !document.hidden) {
        game.update(dt);
        game.draw();
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      c.remove();
    };
  }, [game, drive]);
  return (
    <div className="absolute inset-0 p-3 pb-[13.5rem] pt-14 sm:p-6 sm:pb-36 sm:pt-16">
      <div className="grid h-full w-full place-items-center [container-type:size]">
      <div className="relative aspect-[4/3]" style={{ width: "min(100cqw, 133.33cqh)" }}>
        <div ref={host} className="absolute inset-0 overflow-hidden rounded-[12px] border border-phosphor/30 shadow-[0_0_60px_rgba(125,255,154,0.15)]" />
        <div aria-hidden className="pointer-events-none absolute inset-0 rounded-[12px] bg-[repeating-linear-gradient(to_bottom,rgba(0,0,0,0.18)_0px,rgba(0,0,0,0.18)_1px,transparent_1px,transparent_3px)] mix-blend-multiply" />
      </div>
      </div>
    </div>
  );
}

function useGame() {
  const ref = useRef<CoralGame | null>(null);
  const [, force] = useState(0);
  useEffect(() => {
    ref.current = new CoralGame(7);
    force((n) => n + 1);
    return () => ref.current?.destroy();
  }, []);
  return ref.current;
}

function useGameValue<T>(game: CoralGame, get: (g: CoralGame) => T, server: T) {
  return useSyncExternalStore(
    (cb) => game.subscribe(cb),
    () => get(game),
    () => server,
  );
}

/** The real game_fsm states, with live signals written to the DOM at ~10 Hz. */
function FsmPanel({ game }: { game: CoralGame }) {
  const state = useGameValue<GameState>(game, (g) => g.state, "READY");
  const sig = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const id = window.setInterval(() => {
      const s = game.snapshot();
      if (sig.current)
        sig.current.textContent = `bird_y ${String(s.birdY).padStart(3, "0")} · gap_y ${String(s.gapY).padStart(3, "0")} · maze_off ${s.mazeOffset >= 0 ? "+" : "−"}${String(Math.abs(s.mazeOffset)).padStart(3, "0")}`;
    }, 100);
    return () => window.clearInterval(id);
  }, [game]);
  return (
    <div className="rounded-xl border border-white/10 bg-bg/80 p-3 backdrop-blur-md">
      <div className="label mb-2 flex items-center justify-between gap-3 !text-[0.58rem]">
        <span className="!text-phosphor">game_fsm · browser approximation</span>
      </div>
      <div className="no-scrollbar flex items-center gap-1 overflow-x-auto" aria-live="off">
        {FSM_STATES.map((s, i) => (
          <div key={s} className="flex shrink-0 items-center gap-1">
            <span
              className={`rounded-md border px-2 py-1.5 font-mono text-[0.58rem] tracking-wider transition-colors duration-150 ${
                state === s
                  ? s === "HIT" || s === "GAME_OVER"
                    ? "border-[#ff5d73] bg-[#ff5d73]/20 text-[#ff9aa8]"
                    : "border-phosphor bg-phosphor/20 text-phosphor shadow-[0_0_14px_rgba(125,255,154,0.45)]"
                  : "border-white/10 text-faint"
              }`}
            >
              {FSM_LABEL[s]}
            </span>
            {i < FSM_STATES.length - 1 && <span className="text-faint">›</span>}
          </div>
        ))}
      </div>
      <p className="mt-2 truncate font-mono text-[0.6rem] text-mute">
        <span ref={sig}>bird_y 224 · gap_y 000 · maze_off +000</span>
      </p>
    </div>
  );
}

const DIFFS: Difficulty[] = ["EASY", "MEDIUM", "HARD"];

export default function MazeExperience() {
  const game = useGame();
  const stage = useRef<HTMLDivElement>(null);
  const [focused, setFocused] = useState(false);
  const [view, setView] = useState<"board" | "screen">("board");

  // Phones in portrait start on the flat screen: the game is the point there.
  useEffect(() => {
    if (window.matchMedia("(max-width: 640px) and (orientation: portrait)").matches) setView("screen");
  }, []);

  // Held keys → maze_control up/down. Only while the stage has focus, so the page still scrolls normally.
  useEffect(() => {
    if (!game) return;
    const el = stage.current!;
    const held = { up: false, down: false };
    const map = (k: string) => (k === "ArrowUp" || k === "w" || k === "W" ? "up" : k === "ArrowDown" || k === "s" || k === "S" ? "down" : null);
    const down = (e: KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        if (game.state === "GAME_OVER") game.restart();
        return;
      }
      const k = map(e.key);
      if (!k) return;
      e.preventDefault();
      held[k] = true;
      game.setInput(held.up, held.down);
    };
    const up = (e: KeyboardEvent) => {
      const k = map(e.key);
      if (!k) return;
      held[k] = false;
      game.setInput(held.up, held.down);
    };
    const blur = () => {
      held.up = held.down = false;
      game.setInput(false, false);
    };
    el.addEventListener("keydown", down);
    el.addEventListener("keyup", up);
    el.addEventListener("blur", blur);
    return () => {
      el.removeEventListener("keydown", down);
      el.removeEventListener("keyup", up);
      el.removeEventListener("blur", blur);
    };
  }, [game]);

  const pilot = useGameValueSafe(game, (g) => g.pilot, "AUTO");
  const diff = useGameValueSafe(game, (g) => g.difficulty, "MEDIUM");

  // Mouse: press and hold on the upper/lower half of the screen. (Touch uses the hold buttons, so the page can still be scrolled.)
  const onPointerDown = (e: React.PointerEvent) => {
    stage.current?.focus({ preventScroll: true });
    if (!game || e.pointerType !== "mouse") return;
    if ((e.target as HTMLElement).closest("button,a,[role=group]")) return;
    const r = stage.current!.getBoundingClientRect();
    const upper = e.clientY - r.top < r.height * 0.45;
    game.setInput(upper, !upper);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerUp = () => game?.setInput(false, false);

  const hold = (dir: "up" | "down") => ({
    onPointerDown: (e: React.PointerEvent) => {
      e.preventDefault();
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      game?.setInput(dir === "up", dir === "down");
    },
    onPointerUp: () => game?.setInput(false, false),
    onPointerCancel: () => game?.setInput(false, false),
    onLostPointerCapture: () => game?.setInput(false, false),
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
  });

  // The fallback and the 3D scene are never mounted together, so whichever is mounted drives the game.
  const flat = game ? <FlatScreen game={game} drive /> : null;

  return (
    <div
      ref={stage}
      tabIndex={0}
      role="application"
      aria-label="Controlled Maze browser demo. The bird flies by itself. Hold the up or down arrow, or W and S, to move every coral opening together so the bird can pass. Enter restarts after a game over."
      aria-roledescription="game"
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      className="relative h-[clamp(34rem,calc(var(--svh)*86),52rem)] w-full touch-pan-y select-none outline-none focus-visible:ring-2 focus-visible:ring-phosphor/60"
      data-cursor="Steer"
    >
      <div className="absolute inset-0" aria-hidden>
        {game &&
          (view === "board" ? (
            <SceneCanvas fallback={flat} camera={{ position: [0, 8, 12], fov: 38 }}>
              <MazeScene game={game} />
            </SceneCanvas>
          ) : (
            flat
          ))}
      </div>

      {/* top bar */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex flex-wrap items-start justify-between gap-2 p-3 sm:p-5">
        <div className="label flex items-center gap-2 rounded-full border border-phosphor/40 bg-bg/80 px-3 py-1.5 !text-[0.6rem] !text-phosphor backdrop-blur">
          <span className="h-1.5 w-1.5 rounded-full bg-phosphor" style={{ animation: "pulse-dot 1.6s infinite" }} />
          Browser approximation · not the FPGA design
        </div>
        <div className="pointer-events-auto flex items-center gap-1 rounded-full border border-white/15 bg-bg/80 p-1 backdrop-blur" role="group" aria-label="View">
          {(["board", "screen"] as const).map((v) => (
            <button
              key={v}
              type="button"
              aria-pressed={view === v}
              onClick={() => setView(v)}
              className={`label rounded-full px-3 py-1.5 !text-[0.58rem] transition-colors ${view === v ? "bg-phosphor/20 !text-phosphor" : "hover:!text-ink"}`}
            >
              {v === "board" ? "3D board" : "VGA screen"}
            </button>
          ))}
        </div>
      </div>

      {!focused && pilot === "AUTO" && (
        <div className="pointer-events-none absolute inset-x-0 top-16 z-10 hidden justify-center [@media(pointer:fine)]:flex">
          <span className="label rounded-full border border-white/20 bg-bg/85 px-4 py-2 !text-ink backdrop-blur">Click, then hold ↑ / ↓ to steer the coral</span>
        </div>
      )}

      {/* bottom controls */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex flex-col gap-3 bg-gradient-to-t from-bg/95 via-bg/70 to-transparent p-3 pt-16 sm:flex-row sm:items-end sm:justify-between sm:p-5 sm:pt-20">
        <div className="pointer-events-auto w-full min-w-0 sm:max-w-sm">{game && <FsmPanel game={game} />}</div>
        <div className="pointer-events-auto flex items-end justify-between gap-3 sm:justify-end">
          <div className="flex flex-col gap-2">
            <div className="flex gap-1" role="group" aria-label="Difficulty (changes only the bird's trajectory)">
              {DIFFS.map((d) => (
                <button
                  key={d}
                  type="button"
                  aria-pressed={diff === d}
                  onClick={() => {
                    game?.setDifficulty(d);
                    sfx.click();
                  }}
                  className={`label rounded-full border px-2.5 py-1.5 !text-[0.56rem] backdrop-blur transition-colors ${diff === d ? "border-phosphor !text-phosphor" : "border-white/15 bg-bg/70 hover:!text-ink"}`}
                >
                  {d}
                </button>
              ))}
            </div>
            <button
              type="button"
              aria-pressed={pilot === "AUTO"}
              onClick={() => {
                game?.setPilot(pilot === "AUTO" ? "HUMAN" : "AUTO");
                sfx.click();
              }}
              className={`label rounded-full border px-3 py-1.5 !text-[0.58rem] backdrop-blur transition-colors ${pilot === "AUTO" ? "border-[#ffcf4a]/60 !text-[#ffcf4a]" : "border-white/20 bg-bg/70 hover:!text-ink"}`}
            >
              Autopilot {pilot === "AUTO" ? "on" : "off"}
            </button>
          </div>
          <div className="flex flex-col gap-1.5" role="group" aria-label="Hold to move the coral openings">
            <button type="button" aria-label="Hold to move the openings up" {...hold("up")} className="grid h-12 w-14 touch-none place-items-center rounded-xl border border-white/20 bg-bg/80 text-lg backdrop-blur transition-colors active:border-phosphor active:bg-phosphor/25 hover:border-phosphor/60 sm:h-11 sm:w-12">
              ▲
            </button>
            <button type="button" aria-label="Hold to move the openings down" {...hold("down")} className="grid h-12 w-14 touch-none place-items-center rounded-xl border border-white/20 bg-bg/80 text-lg backdrop-blur transition-colors active:border-phosphor active:bg-phosphor/25 hover:border-phosphor/60 sm:h-11 sm:w-12">
              ▼
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Like useGameValue, but tolerates the game not existing yet (first client render). */
function useGameValueSafe<T>(game: CoralGame | null, get: (g: CoralGame) => T, fallback: T) {
  return useSyncExternalStore(
    (cb) => (game ? game.subscribe(cb) : () => {}),
    () => (game ? get(game) : fallback),
    () => fallback,
  );
}
