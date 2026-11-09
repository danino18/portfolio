import { mulberry32 } from "@/lib/rng";

export type Dir = "U" | "D" | "L" | "R";
export type FsmState = "IDLE" | "DECODE" | "MOVE" | "BLOCKED" | "CHECK" | "WIN";

export const FSM_STATES: FsmState[] = ["IDLE", "DECODE", "MOVE", "CHECK", "WIN"];

const N = 1;
const E = 2;
const S = 4;
const W = 8;
const DX: Record<Dir, number> = { U: 0, D: 0, L: -1, R: 1 };
const DY: Record<Dir, number> = { U: -1, D: 1, L: 0, R: 0 };
const BIT: Record<Dir, number> = { U: N, D: S, L: W, R: E };
const OPP: Record<number, number> = { [N]: S, [S]: N, [E]: W, [W]: E };

/** PS/2 scan code set 2 make codes for the keys the demo accepts. */
export const PS2_CODES: Record<string, { dir: Dir; code: string }> = {
  ArrowUp: { dir: "U", code: "E0 75" },
  ArrowDown: { dir: "D", code: "E0 72" },
  ArrowLeft: { dir: "L", code: "E0 6B" },
  ArrowRight: { dir: "R", code: "E0 74" },
  w: { dir: "U", code: "1D" },
  s: { dir: "D", code: "1B" },
  a: { dir: "L", code: "1C" },
  d: { dir: "R", code: "23" },
};

/**
 * A small pixel-art maze with an explicit finite-state machine
 * (IDLE → DECODE → MOVE/BLOCKED → CHECK → IDLE/WIN). This is a web
 * approximation of the idea behind the FPGA project, not its implementation.
 */
export class MazeGame {
  readonly cols = 15;
  readonly rows = 11;
  readonly cell = 10;
  readonly canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private cells = new Uint8Array(this.cols * this.rows);
  private visited = new Set<number>();
  px = 0;
  py = 0;
  ex = this.cols - 1;
  ey = this.rows - 1;
  state: FsmState = "IDLE";
  code = "--";
  moves = 0;
  dirty = true;
  lastInput = 0;
  private seed: number;
  private timers: number[] = [];
  private listeners = new Set<() => void>();
  private blink = 0;

  constructor(seed = 7) {
    this.seed = seed;
    this.canvas = document.createElement("canvas");
    this.canvas.width = 160;
    this.canvas.height = 128;
    this.ctx = this.canvas.getContext("2d")!;
    this.generate();
    this.draw(0);
  }

  subscribe(cb: () => void) {
    this.listeners.add(cb);
    return () => {
      this.listeners.delete(cb);
    };
  }
  private emit() {
    this.listeners.forEach((l) => l());
  }

  generate() {
    const rng = mulberry32(this.seed);
    this.cells.fill(0);
    this.visited.clear();
    const seen = new Uint8Array(this.cols * this.rows);
    const stack: number[] = [0];
    seen[0] = 1;
    const dirs: Dir[] = ["U", "D", "L", "R"];
    while (stack.length) {
      const cur = stack[stack.length - 1];
      const cx = cur % this.cols;
      const cy = Math.floor(cur / this.cols);
      const opts = dirs
        .map((d) => ({ d, nx: cx + DX[d], ny: cy + DY[d] }))
        .filter((o) => o.nx >= 0 && o.ny >= 0 && o.nx < this.cols && o.ny < this.rows && !seen[o.ny * this.cols + o.nx]);
      if (!opts.length) {
        stack.pop();
        continue;
      }
      const o = opts[Math.floor(rng() * opts.length)];
      const ni = o.ny * this.cols + o.nx;
      this.cells[cur] |= BIT[o.d];
      this.cells[ni] |= OPP[BIT[o.d]];
      seen[ni] = 1;
      stack.push(ni);
    }
    this.px = 0;
    this.py = 0;
    this.visited.add(0);
    this.state = "IDLE";
    this.dirty = true;
  }

  newMaze() {
    this.seed += 1;
    this.timers.forEach((t) => window.clearTimeout(t));
    this.timers = [];
    this.moves = 0;
    this.code = "--";
    this.generate();
    this.emit();
  }

  /** Feed a decoded key into the state machine. */
  press(dir: Dir, code: string) {
    if (this.state !== "IDLE") return;
    this.lastInput = performance.now();
    this.code = code;
    this.set("DECODE");
    const later = (ms: number, fn: () => void) => this.timers.push(window.setTimeout(fn, ms));
    later(70, () => {
      const open = this.cells[this.py * this.cols + this.px] & BIT[dir];
      if (open) {
        this.px += DX[dir];
        this.py += DY[dir];
        this.visited.add(this.py * this.cols + this.px);
        this.moves += 1;
        this.set("MOVE");
      } else {
        this.set("BLOCKED");
      }
      later(70, () => {
        this.set("CHECK");
        later(70, () => {
          if (this.px === this.ex && this.py === this.ey) {
            this.set("WIN");
            later(1800, () => this.newMaze());
          } else this.set("IDLE");
        });
      });
    });
  }

  private set(s: FsmState) {
    this.state = s;
    this.dirty = true;
    this.emit();
  }

  /** Redraws the pixel buffer. Cheap enough to call every frame. */
  draw(t: number) {
    const c = this.ctx;
    const { cell, cols, rows } = this;
    const ox = (160 - cols * cell) / 2;
    const oy = (128 - rows * cell) / 2;
    c.fillStyle = "#031008";
    c.fillRect(0, 0, 160, 128);

    // visited trail
    c.fillStyle = "#0b2a17";
    this.visited.forEach((i) => c.fillRect(ox + (i % cols) * cell + 1, oy + Math.floor(i / cols) * cell + 1, cell - 1, cell - 1));

    // exit
    const blink = Math.floor(t * 2) % 2 === 0;
    c.fillStyle = this.state === "WIN" ? "#ffffff" : blink ? "#ffcf4a" : "#c58a12";
    c.fillRect(ox + this.ex * cell + 2, oy + this.ey * cell + 2, cell - 3, cell - 3);

    // walls
    c.fillStyle = "#7dff9a";
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const m = this.cells[y * cols + x];
        const px = ox + x * cell;
        const py = oy + y * cell;
        if (!(m & N)) c.fillRect(px, py, cell + 1, 1);
        if (!(m & W)) c.fillRect(px, py, 1, cell + 1);
        if (y === rows - 1 && !(m & S)) c.fillRect(px, py + cell, cell + 1, 1);
        if (x === cols - 1 && !(m & E)) c.fillRect(px + cell, py, 1, cell + 1);
      }
    }

    // player
    c.fillStyle = this.state === "BLOCKED" ? "#ff5d73" : "#38e8ff";
    c.fillRect(ox + this.px * cell + 2, oy + this.py * cell + 2, cell - 3, cell - 3);
    c.fillStyle = "#031008";
    c.fillRect(ox + this.px * cell + 4, oy + this.py * cell + 4, 1, 1);
    c.fillRect(ox + this.px * cell + 6, oy + this.py * cell + 4, 1, 1);

    // HUD line
    c.fillStyle = "#7dff9a";
    c.font = "6px monospace";
    c.fillText(`MOVES ${String(this.moves).padStart(3, "0")}`, 4, 8);
    c.fillText(this.state === "WIN" ? "EXIT REACHED" : this.state, 98, 8);
    this.blink = t;
    this.dirty = true;
  }

  destroy() {
    this.timers.forEach((t) => window.clearTimeout(t));
    this.listeners.clear();
  }
}
