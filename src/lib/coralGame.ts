import { mulberry32 } from "@/lib/rng";
import { BIRD_TXT, CORAL_TXT, FONT_TXT } from "@/content/mazeAssets";

/**
 * Browser approximation of the Controlled Maze FPGA game
 * (github.com/danino18/basic_controled_mazed).
 *
 * The rules follow the project's own documentation and RTL parameters:
 *  - the bird is autonomous: fixed x (144), vertical-only motion from a
 *    difficulty-dependent trajectory generator (EASY sine / MEDIUM random
 *    turns / HARD rate-limited pursuit);
 *  - the player never moves the bird — holding ↑/↓ moves ONE shared offset
 *    that shifts the openings of every coral column together, ramping from
 *    1 to 4 px/frame like `maze_control.sv`;
 *  - 3 columns, 64 px wide, 128 px openings, wrap width 720, world speed
 *    2 px/frame, geometric AABB collision with the documented hitbox insets,
 *    +1 per column passed;
 *  - frames are stepped at the board's ~72.6 Hz VGA rate on a 640×480 buffer,
 *    using the project's sprite and font assets and its dithered water ramp.
 *
 * It is NOT the SystemVerilog design, and its autopilot is a simple
 * controller — the real AI is a neural network trained on the FPGA.
 */

export type GameState = "READY" | "PLAY" | "HIT" | "GAME_OVER";
export type Difficulty = "EASY" | "MEDIUM" | "HARD";
export type Pilot = "AUTO" | "HUMAN";

export const FSM_STATES: GameState[] = ["READY", "PLAY", "HIT", "GAME_OVER"];
export const FSM_LABEL: Record<GameState, string> = { READY: "READY", PLAY: "PLAY", HIT: "HIT", GAME_OVER: "GAME OVER" };

// ---- game_params_pkg.sv ----------------------------------------------------
const W = 640;
const H = 480;
const FRAME = 1 / 72.6;
const BIRD_SIZE = 32;
const BIRD_X = 144;
const BIRD_Y_MIN = 64;
const BIRD_Y_MAX = 384;
const BIRD_Y_CENTER = 224;
const HB = { x0: 9, x1: 25, y0: 10, y1: 24 };
const NUM_COLUMNS = 3;
const CORAL_W = 64;
const GAP_H = 128;
const GAP_CENTER_MIN = 80;
const GAP_CENTER_MAX = 400;
const GAP_BASE_MIN = 176;
const GAP_BASE_SPAN = 128; // 176..303
const CORAL_FIRST_X = 480;
const CORAL_WRAP_W = 720;
const CORE_INSET = 4;
const TIP_FORGIVE = 8;
const MAZE_STEP_MAX = 4;
const MAZE_OFFSET_MAX = GAP_CENTER_MAX - GAP_BASE_MIN;
const WORLD_STEP = 2; // level 2 = 2.0 px/frame
const SEABED_TOP = 440;
const READY_FRAMES = 88;
const HIT_FRAMES = 51; // ~0.7 s

// ---- palette (RRRGGGBB) ----------------------------------------------------
const rgb = (c: number) => {
  const r = (c >> 5) & 7;
  const g = (c >> 2) & 7;
  const b = c & 3;
  return [Math.round((r * 255) / 7), Math.round((g * 255) / 7), b * 85] as const;
};
const css = (c: number) => {
  const [r, g, b] = rgb(c);
  return `rgb(${r},${g},${b})`;
};
const C = (r: number, g: number, b: number) => (r << 5) | (g << 2) | b;
const WATER = [C(1, 6, 3), C(0, 5, 3), C(0, 4, 3), C(0, 3, 3), C(0, 2, 3), C(0, 1, 2), C(0, 0, 2), C(0, 0, 2), C(0, 0, 1)];
const SAND_LIGHT = C(6, 5, 1);
const SAND = C(5, 4, 1);
const SAND_DARK = C(4, 3, 1);
const PEBBLE = C(2, 2, 1);
export const TEXT_WHITE = C(6, 7, 3);
export const TEXT_GOLD = C(7, 6, 0);
export const TEXT_CYAN = C(5, 7, 3);
export const TEXT_RED = C(7, 1, 1);
export const TEXT_GREEN = C(2, 7, 1);
const PANEL = C(0, 0, 1);
const FLASH = C(7, 1, 1);
const BAYER = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];

// ---- asset parsing --------------------------------------------------------
interface Sprite {
  w: number;
  h: number;
  frames: HTMLCanvasElement[];
}

function parseSprite(txt: string): Sprite {
  const lines = txt.split("\n");
  let w = 0;
  let h = 0;
  const pal: Record<string, number> = {};
  let base: string[] | null = null;
  const frames: string[][] = [];
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i].trim();
    if (!l) continue;
    if (l.startsWith("size")) {
      const [, a, b] = l.split(/\s+/);
      w = Number(a);
      h = Number(b);
    } else if (l.startsWith("palette")) {
      const [, ch, hex] = l.split(/\s+/);
      pal[ch] = parseInt(hex, 16);
    } else if (l === "base" || l === "frame") {
      const rows = lines.slice(i + 1, i + 1 + h).map((r) => r.trim());
      i += h;
      if (l === "base") base = rows;
      else frames.push(rows);
    }
  }
  const canvases = frames.map((rows) => {
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const ctx = c.getContext("2d")!;
    const img = ctx.createImageData(w, h);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        let ch = rows[y]?.[x] ?? ".";
        if (base && ch === ".") ch = base[y]?.[x] ?? ".";
        if (ch === "_") continue;
        const code = pal[ch];
        if (code === undefined || code === 0xff) continue;
        const [r, g, b] = rgb(code);
        const k = (y * w + x) * 4;
        img.data[k] = r;
        img.data[k + 1] = g;
        img.data[k + 2] = b;
        img.data[k + 3] = 255;
      }
    ctx.putImageData(img, 0, 0);
    return c;
  });
  return { w, h, frames: canvases };
}

function parseFont(txt: string): Map<string, string[]> {
  const out = new Map<string, string[]>();
  const lines = txt.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i].trim();
    if (!l.startsWith("glyph ")) continue;
    const name = l.slice(6).trim();
    const ch = name === "space" ? " " : name;
    out.set(ch, lines.slice(i + 1, i + 8).map((r) => r.trim()));
    i += 7;
  }
  return out;
}

function flipV(src: HTMLCanvasElement) {
  const c = document.createElement("canvas");
  c.width = src.width;
  c.height = src.height;
  const ctx = c.getContext("2d")!;
  ctx.translate(0, src.height);
  ctx.scale(1, -1);
  ctx.drawImage(src, 0, 0);
  return c;
}

/** The procedural water ramp + sand of water_background.sv, rendered once. */
function renderBackground() {
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d")!;
  const img = ctx.createImageData(W, H);
  const pal = WATER.map(rgb);
  const sand = [SAND_LIGHT, SAND, SAND_DARK, PEBBLE].map(rgb);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const band = y >> 6;
      const blend = (y >> 2) & 15;
      const useNext = blend > BAYER[y & 3][x & 3];
      let col = pal[Math.min(8, band + (useNext ? 1 : 0))];
      const sx = x + 37;
      const wave64 = x & 32 ? ~x & 31 : x & 31;
      const wave128 = sx & 64 ? ~sx & 63 : sx & 63;
      const sandTop = SEABED_TOP + (wave64 >> 2) + (wave128 >> 3);
      if (y >= sandTop) {
        const grain = (x & 15) ^ (((y & 3) << 2) | ((y >> 2) & 3)) ^ ((x >> 4) & 15) ^ ((y >> 3) & 15);
        col = y < sandTop + 2 ? sand[0] : grain === 15 && x & 2 ? sand[3] : (grain & 1) ^ ((grain >> 2) & 1) ? sand[1] : sand[2];
      }
      const k = (y * W + x) * 4;
      img.data[k] = col[0];
      img.data[k + 1] = col[1];
      img.data[k + 2] = col[2];
      img.data[k + 3] = 255;
    }
  ctx.putImageData(img, 0, 0);
  return c;
}

// ---- the game --------------------------------------------------------------
interface Column {
  x: number;
  base: number;
  passed: boolean;
}

export class CoralGame {
  readonly width = W;
  readonly height = H;
  readonly canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private bg: HTMLCanvasElement;
  private bird: Sprite;
  private coral: { body: HTMLCanvasElement; tip: HTMLCanvasElement; bodyDown: HTMLCanvasElement; tipDown: HTMLCanvasElement };
  private font: Map<string, string[]>;
  private textCache = new Map<string, HTMLCanvasElement>();
  private rng: () => number;
  private seed: number;

  state: GameState = "READY";
  difficulty: Difficulty = "MEDIUM";
  pilot: Pilot = "AUTO";
  score = 0;
  best = 0;
  frame = 0;
  stateFrames = 0;
  birdY = BIRD_Y_CENTER;
  birdVy = 0;
  mazeOffset = 0;
  mazeVy = 0;
  holdFrames = 0;
  columns: Column[] = [];
  /** performance.now() of the last human input (drives 3D trace glow). */
  lastInput = 0;
  /** Current effective control after pilot logic: -1 up, 0 none, 1 down. */
  control = 0;

  private up = false;
  private down = false;
  private acc = 0;
  private phase = 0;
  private decisionIn = 0;
  private target = BIRD_Y_CENTER;
  private bubbles: { x: number; y: number; r: number; v: number }[] = [];
  private listeners = new Set<() => void>();

  constructor(seed = 7) {
    this.seed = seed;
    this.rng = mulberry32(seed);
    this.canvas = document.createElement("canvas");
    this.canvas.width = W;
    this.canvas.height = H;
    this.ctx = this.canvas.getContext("2d")!;
    this.ctx.imageSmoothingEnabled = false;
    this.bg = renderBackground();
    this.bird = parseSprite(BIRD_TXT);
    const cs = parseSprite(CORAL_TXT);
    this.coral = { body: cs.frames[0], tip: cs.frames[1], bodyDown: flipV(cs.frames[0]), tipDown: flipV(cs.frames[1]) };
    this.font = parseFont(FONT_TXT);
    const r = mulberry32(99);
    for (let i = 0; i < 12; i++) this.bubbles.push({ x: r() * W, y: r() * SEABED_TOP, r: 1 + Math.floor(r() * 3), v: 0.3 + r() * 0.6 });
    this.reset();
    this.draw();
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

  /** Human input (held keys / buttons). Taking control switches the pilot to HUMAN. */
  setInput(up: boolean, down: boolean) {
    this.up = up;
    this.down = down;
    if (up || down) {
      this.lastInput = performance.now();
      if (this.pilot !== "HUMAN") {
        this.pilot = "HUMAN";
        this.emit();
      }
      if (this.state === "GAME_OVER" && this.stateFrames > 36) this.restart();
    }
  }

  setPilot(p: Pilot) {
    this.pilot = p;
    if (p === "AUTO") {
      this.up = false;
      this.down = false;
      if (this.state === "GAME_OVER") this.restart();
    }
    this.emit();
  }

  setDifficulty(d: Difficulty) {
    this.difficulty = d;
    this.restart();
  }

  restart() {
    this.seed += 1;
    this.rng = mulberry32(this.seed);
    this.reset();
    this.emit();
  }

  private reset() {
    this.state = "READY";
    this.stateFrames = 0;
    this.score = 0;
    this.birdY = BIRD_Y_CENTER;
    this.birdVy = 0;
    this.mazeOffset = 0;
    this.mazeVy = 0;
    this.holdFrames = 0;
    this.phase = 0;
    this.decisionIn = 0;
    this.target = BIRD_Y_CENTER;
    this.columns = Array.from({ length: NUM_COLUMNS }, (_, i) => ({
      x: CORAL_FIRST_X + (i * CORAL_WRAP_W) / NUM_COLUMNS,
      base: GAP_BASE_MIN + Math.floor(this.rng() * GAP_BASE_SPAN),
      passed: false,
    }));
  }

  private set(s: GameState) {
    this.state = s;
    this.stateFrames = 0;
    this.emit();
  }

  /** Advances the simulation by real time, in fixed ~72.6 Hz frames. */
  update(dt: number) {
    this.acc = Math.min(this.acc + dt, FRAME * 6);
    let n = 0;
    while (this.acc >= FRAME && n < 6) {
      this.acc -= FRAME;
      this.tick();
      n++;
    }
  }

  private gapCenter(c: Column) {
    return Math.max(GAP_CENTER_MIN, Math.min(GAP_CENTER_MAX, c.base + this.mazeOffset));
  }

  /** Next column the bird still has to pass. */
  private nextColumn() {
    const hbLeft = BIRD_X + HB.x0;
    return this.columns.filter((c) => c.x + CORAL_W >= hbLeft).sort((a, b) => a.x - b.x)[0];
  }

  /** Simple autopilot: line the next opening up with where the bird will be. */
  private autopilot(): number {
    const c = this.nextColumn();
    if (!c) return 0;
    const birdC = this.birdY + BIRD_SIZE / 2 + this.birdVy * 10;
    const err = this.gapCenter(c) - birdC;
    if (Math.abs(err) < 4) return 0;
    return err > 0 ? -1 : 1;
  }

  private tick() {
    this.frame++;
    this.stateFrames++;
    // bubbles drift up (background layer)
    for (const b of this.bubbles) {
      b.y -= b.v;
      b.x += Math.sin((this.frame + b.r * 40) * 0.05) * 0.2;
      if (b.y < -4) {
        b.y = SEABED_TOP - 4;
        b.x = (b.x + 211) % W;
      }
    }

    if (this.state === "READY") {
      this.trajectory(0.4);
      if (this.stateFrames >= READY_FRAMES) this.set("PLAY");
      return;
    }
    if (this.state === "HIT") {
      if (this.stateFrames >= HIT_FRAMES) {
        this.best = Math.max(this.best, this.score);
        this.set("GAME_OVER");
      }
      return;
    }
    if (this.state === "GAME_OVER") {
      if (this.pilot === "AUTO" && this.stateFrames > 180) this.restart();
      return;
    }

    // ---- PLAY: tickMove -> tickCheck -> tickState
    this.trajectory(1);

    const ctl = this.pilot === "AUTO" ? this.autopilot() : this.up && !this.down ? -1 : this.down && !this.up ? 1 : 0;
    this.control = ctl;
    const step = this.holdFrames >= 12 ? MAZE_STEP_MAX : 1 + (this.holdFrames >> 2);
    const prev = this.mazeOffset;
    if (ctl !== 0) {
      this.mazeOffset = Math.max(-MAZE_OFFSET_MAX, Math.min(MAZE_OFFSET_MAX, this.mazeOffset + ctl * step));
      this.holdFrames = Math.min(15, this.holdFrames + 1);
    } else this.holdFrames = 0;
    this.mazeVy = this.mazeOffset - prev;

    for (const c of this.columns) {
      c.x -= WORLD_STEP;
      if (c.x + CORAL_W < 0) {
        c.x += CORAL_WRAP_W;
        c.base = GAP_BASE_MIN + Math.floor(this.rng() * GAP_BASE_SPAN);
        c.passed = false;
      }
    }

    // collision (geometric, like collision_detect.sv)
    const l = BIRD_X + HB.x0;
    const r = BIRD_X + HB.x1;
    const t = this.birdY + HB.y0;
    const b = this.birdY + HB.y1;
    let hit = false;
    for (const c of this.columns) {
      const xOverlap = r > c.x + CORE_INSET && l < c.x + CORAL_W - CORE_INSET;
      const gc = this.gapCenter(c);
      const top = gc - GAP_H / 2 - TIP_FORGIVE;
      const bottom = gc + GAP_H / 2 + TIP_FORGIVE;
      if (xOverlap && (t < top || b > bottom)) hit = true;
      if (!c.passed && c.x + CORAL_W < l) {
        c.passed = true;
        this.score = Math.min(999, this.score + 1);
        this.best = Math.max(this.best, this.score);
        this.emit();
      }
    }
    if (hit) this.set("HIT");
  }

  /** bird_trajectory.sv, per difficulty (speeds in px/frame). */
  private trajectory(scale: number) {
    const d = this.difficulty;
    if (d === "EASY" || scale < 1) {
      this.phase += ((Math.PI * 2) / 256) * scale;
      const y = BIRD_Y_CENTER + (d === "EASY" || scale < 1 ? 127 * scale : 127) * Math.sin(this.phase);
      this.birdVy = y - this.birdY;
      this.birdY = y;
      return;
    }
    if (d === "MEDIUM") {
      if (--this.decisionIn <= 0) {
        this.decisionIn = 24;
        let dir = this.rng() < 0.5 ? -1 : 1;
        if (this.birdY < BIRD_Y_MIN + 48) dir = 1;
        if (this.birdY > BIRD_Y_MAX - 48) dir = -1;
        this.target = dir * 2.5;
      }
      this.birdVy += Math.max(-0.25, Math.min(0.25, this.target - this.birdVy));
    } else {
      if (--this.decisionIn <= 0) {
        this.decisionIn = 6 + Math.floor(this.rng() * 32);
        this.target = BIRD_Y_MIN + this.rng() * (BIRD_Y_MAX - BIRD_Y_MIN);
      }
      const want = Math.max(-3.75, Math.min(3.75, (this.target - this.birdY) / 8));
      this.birdVy += Math.max(-0.5, Math.min(0.5, want - this.birdVy)) + (this.rng() - 0.5) * (8 / 64);
      this.birdVy = Math.max(-3.75, Math.min(3.75, this.birdVy));
    }
    this.birdY += this.birdVy;
    if (this.birdY < BIRD_Y_MIN) {
      this.birdY = BIRD_Y_MIN;
      this.birdVy = Math.abs(this.birdVy) * 0.5;
    }
    if (this.birdY > BIRD_Y_MAX) {
      this.birdY = BIRD_Y_MAX;
      this.birdVy = -Math.abs(this.birdVy) * 0.5;
    }
  }

  // ---- rendering -----------------------------------------------------------
  private text(str: string, color: number, scale: number) {
    const key = `${str}|${color}|${scale}`;
    let c = this.textCache.get(key);
    if (c) return c;
    c = document.createElement("canvas");
    c.width = Math.max(1, str.length * 8 * scale);
    c.height = 8 * scale;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = css(color);
    [...str].forEach((ch, i) => {
      const g = this.font.get(ch) ?? this.font.get(ch.toUpperCase());
      if (!g) return;
      for (let y = 0; y < 7; y++) for (let x = 0; x < 7; x++) if (g[y]?.[x] === "#") ctx.fillRect((i * 8 + x) * scale, y * scale, scale, scale);
    });
    if (this.textCache.size > 64) this.textCache.clear();
    this.textCache.set(key, c);
    return c;
  }

  private panel(x: number, y: number, w: number, h: number) {
    // translucent checkerboard backdrop like ui_panels.sv
    const ctx = this.ctx;
    ctx.fillStyle = css(PANEL);
    for (let yy = y; yy < y + h; yy += 2) for (let xx = x + ((yy - y) & 2 ? 1 : 0); xx < x + w; xx += 2) ctx.fillRect(xx, yy, 1, 1);
    ctx.globalAlpha = 0.45;
    ctx.fillRect(x, y, w, h);
    ctx.globalAlpha = 1;
  }

  draw() {
    const ctx = this.ctx;
    ctx.drawImage(this.bg, 0, 0);

    // bubbles
    ctx.fillStyle = css(TEXT_CYAN);
    for (const b of this.bubbles) {
      ctx.globalAlpha = 0.55;
      ctx.fillRect(Math.round(b.x), Math.round(b.y), b.r * 2, b.r * 2);
    }
    ctx.globalAlpha = 1;

    // coral columns: tiles indexed from the gap edges, so the texture moves with the maze
    const { body, tip, bodyDown, tipDown } = this.coral;
    for (const c of this.columns) {
      const x = Math.round(c.x);
      if (x > W || x + CORAL_W < 0) continue;
      const gc = Math.round(this.gapCenter(c));
      const top = gc - GAP_H / 2;
      const bottom = gc + GAP_H / 2;
      ctx.drawImage(tip, x, top - 32);
      for (let y = top - 64; y > -32; y -= 32) ctx.drawImage(body, x, y);
      ctx.drawImage(tipDown, x, bottom);
      for (let y = bottom + 32; y < H; y += 32) ctx.drawImage(bodyDown, x, y);
    }

    // bird: 3 fin frames played 0-1-2-1, one step every 8 frames
    const seq = [0, 1, 2, 1];
    const f = this.state === "HIT" || this.state === "GAME_OVER" ? 1 : seq[(this.frame >> 3) & 3];
    ctx.drawImage(this.bird.frames[f] ?? this.bird.frames[0], BIRD_X, Math.round(this.birdY));

    // HUD (top right), like the board's text layer
    this.panel(W - 156, 4, 152, 44);
    const pad = (n: number) => String(n).padStart(3, "0");
    ctx.drawImage(this.text(`SCORE ${pad(this.score)}`, TEXT_WHITE, 2), W - 152, 8);
    ctx.drawImage(this.text(`BEST  ${pad(this.best)}`, TEXT_GOLD, 2), W - 152, 28);

    const tag = this.pilot === "AUTO" ? "AUTOPILOT" : "YOU STEER";
    this.panel(4, 4, tag.length * 16 + 8, 24);
    ctx.drawImage(this.text(tag, this.pilot === "AUTO" ? TEXT_GOLD : TEXT_GREEN, 2), 8, 8);
    if (this.state === "PLAY") {
      const arrow = this.control < 0 ? "UP" : this.control > 0 ? "DOWN" : "HOLD";
      ctx.drawImage(this.text(`MAZE ${arrow}`, TEXT_CYAN, 2), 8, 32);
    }

    const center = (str: string, color: number, scale: number, y: number) => {
      const t = this.text(str, color, scale);
      ctx.drawImage(t, Math.round((W - t.width) / 2), y);
    };
    if (this.state === "READY") {
      this.panel(150, 176, 340, 104);
      center("GET READY", TEXT_GOLD, 4, 192);
      center(this.difficulty, TEXT_CYAN, 2, 236);
      center("HOLD ^ / DOWN TO STEER", TEXT_WHITE, 1, 262);
    } else if (this.state === "HIT") {
      if ((this.stateFrames >> 2) & 1) {
        ctx.globalAlpha = 0.35;
        ctx.fillStyle = css(FLASH);
        ctx.fillRect(0, 0, W, H);
        ctx.globalAlpha = 1;
      }
    } else if (this.state === "GAME_OVER") {
      this.panel(130, 150, 380, 164);
      center("GAME OVER", TEXT_RED, 4, 166);
      center(`SCORE ${pad(this.score)}   BEST ${pad(this.best)}`, TEXT_WHITE, 2, 220);
      center(this.pilot === "AUTO" ? "RESTARTING..." : "PRESS ^ OR TAP TO PLAY", TEXT_CYAN, 2, 260);
    }
  }

  /** Readouts for the HUD next to the screen. */
  snapshot() {
    const c = this.nextColumn();
    return {
      state: this.state,
      birdY: Math.round(this.birdY),
      mazeOffset: this.mazeOffset,
      gapY: c ? Math.round(this.gapCenter(c)) : 0,
      score: this.score,
      best: this.best,
      control: this.control,
      pilot: this.pilot,
    };
  }

  destroy() {
    this.listeners.clear();
    this.textCache.clear();
  }
}
