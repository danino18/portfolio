"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { FSM_STATES, MazeGame, PS2_CODES, type Dir, type FsmState } from "@/lib/mazeGame";

const SceneCanvas = dynamic(() => import("@/components/three/SceneCanvas"), { ssr: false });
const MazeScene = dynamic(() => import("@/components/three/MazeScene"), { ssr: false });

/** 2D fallback: shows the pixel buffer directly. */
function CanvasMount({ game }: { game: MazeGame }) {
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const c = game.canvas;
    c.style.cssText = "width:100%;height:100%;image-rendering:pixelated;display:block;border-radius:12px";
    host.current?.appendChild(c);
    let raf = 0;
    const loop = (t: number) => {
      game.draw(t / 1000);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      c.remove();
    };
  }, [game]);
  return (
    <div className="absolute inset-0 grid place-items-center p-6 pb-40 md:pb-6">
      <div ref={host} className="aspect-[5/4] h-full max-h-[420px] rounded-xl border border-phosphor/30 shadow-[0_0_60px_rgba(125,255,154,0.15)]" />
    </div>
  );
}

function useGame() {
  const ref = useRef<MazeGame | null>(null);
  const [, force] = useState(0);
  useEffect(() => {
    ref.current = new MazeGame(7);
    force((n) => n + 1);
    return () => ref.current?.destroy();
  }, []);
  return ref.current;
}

function FsmDiagram({ game }: { game: MazeGame }) {
  const state = useSyncExternalStore(
    (cb) => game.subscribe(cb),
    () => game.state,
    () => "IDLE" as FsmState,
  );
  const code = useSyncExternalStore(
    (cb) => game.subscribe(cb),
    () => game.code,
    () => "--",
  );
  const active = state === "BLOCKED" ? "MOVE" : state;
  return (
    <div className="rounded-xl border border-white/10 bg-bg/75 p-3 backdrop-blur-md">
      <div className="label mb-2 flex items-center justify-between !text-[0.58rem]">
        <span className="!text-phosphor">Game FSM · web approximation</span>
        <span>
          PS/2 <span className="text-ink">{code}</span>
        </span>
      </div>
      <div className="flex items-center gap-1" aria-live="off">
        {FSM_STATES.map((s, i) => (
          <div key={s} className="flex items-center gap-1">
            <span
              className={`rounded-md border px-2 py-1.5 font-mono text-[0.58rem] tracking-wider transition-all duration-150 ${
                active === s
                  ? state === "BLOCKED"
                    ? "border-[#ff5d73] bg-[#ff5d73]/20 text-[#ff9aa8]"
                    : "border-phosphor bg-phosphor/20 text-phosphor shadow-[0_0_14px_rgba(125,255,154,0.45)]"
                  : "border-white/10 text-faint"
              }`}
            >
              {state === "BLOCKED" && s === "MOVE" ? "BLOCK" : s}
            </span>
            {i < FSM_STATES.length - 1 && <span className="text-faint">›</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function MazeExperience() {
  const game = useGame();
  const stage = useRef<HTMLDivElement>(null);
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!game) return;
    const el = stage.current!;
    const onKey = (e: KeyboardEvent) => {
      const k = PS2_CODES[e.key] ?? PS2_CODES[e.key.toLowerCase()];
      if (!k) return;
      e.preventDefault();
      game.press(k.dir, k.code);
    };
    el.addEventListener("keydown", onKey);
    return () => el.removeEventListener("keydown", onKey);
  }, [game]);

  const pad = (dir: Dir, code: string) => () => {
    game?.press(dir, code);
    stage.current?.focus({ preventScroll: true });
  };

  const arrows: { dir: Dir; label: string; code: string; cls: string }[] = [
    { dir: "U", label: "↑", code: "E0 75", cls: "col-start-2 row-start-1" },
    { dir: "L", label: "←", code: "E0 6B", cls: "col-start-1 row-start-2" },
    { dir: "D", label: "↓", code: "E0 72", cls: "col-start-2 row-start-2" },
    { dir: "R", label: "→", code: "E0 74", cls: "col-start-3 row-start-2" },
  ];

  return (
    <div
      ref={stage}
      tabIndex={0}
      role="application"
      aria-label="Maze web demo. Use arrow keys or W A S D to move the cyan block to the amber exit."
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onPointerDown={() => stage.current?.focus({ preventScroll: true })}
      className="relative h-[clamp(560px,86vh,820px)] w-full outline-none focus-visible:ring-2 focus-visible:ring-phosphor/60"
      data-cursor="Play"
    >
      <div className="absolute inset-0" aria-hidden>
        {game && (
          <SceneCanvas fallback={<CanvasMount game={game} />} camera={{ position: [0, 8, 12], fov: 38 }}>
            <MazeScene game={game} />
          </SceneCanvas>
        )}
      </div>

      <div className="label pointer-events-none absolute left-5 top-5 z-10 flex items-center gap-2 rounded-full border border-phosphor/40 bg-bg/75 px-3 py-1.5 !text-[0.6rem] !text-phosphor backdrop-blur">
        <span className="h-1.5 w-1.5 rounded-full bg-phosphor" style={{ animation: "pulse-dot 1.6s infinite" }} />
        Web demo · not the FPGA implementation
      </div>

      {!focused && (
        <div className="pointer-events-none absolute inset-x-0 top-[38%] z-10 flex justify-center">
          <span className="label rounded-full border border-white/20 bg-bg/80 px-4 py-2 !text-ink backdrop-blur">Click to play · arrow keys / WASD</span>
        </div>
      )}

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex items-end justify-between gap-4 bg-gradient-to-t from-bg/90 to-transparent p-4 pt-20 md:p-6">
        <div className="pointer-events-auto w-full max-w-sm">{game && <FsmDiagram game={game} />}</div>
        <div className="pointer-events-auto flex shrink-0 items-end gap-3">
          <button
            type="button"
            onClick={() => game?.newMaze()}
            className="label rounded-full border border-white/20 bg-bg/75 px-3 py-2 backdrop-blur transition-colors hover:border-phosphor hover:text-phosphor"
          >
            New maze
          </button>
          <div className="grid grid-cols-3 grid-rows-2 gap-1.5" role="group" aria-label="On-screen directional pad">
            {arrows.map((a) => (
              <button
                key={a.dir}
                type="button"
                aria-label={`Move ${{ U: "up", D: "down", L: "left", R: "right" }[a.dir]}`}
                onClick={pad(a.dir, a.code)}
                className={`${a.cls} grid h-10 w-10 place-items-center rounded-lg border border-white/20 bg-bg/75 text-lg backdrop-blur transition-colors active:border-phosphor active:bg-phosphor/20 hover:border-phosphor/60`}
              >
                {a.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
