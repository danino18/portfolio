import { mulberry32 } from "@/lib/rng";

/**
 * Conceptual simulation behind the Wi-Fi sensing visual. NOT a model of a
 * real measurement: it produces plausible-looking channel-state information
 * (CSI) from simple geometry so the idea can be shown — a person changes the
 * multipath between an ESP32 transmitter and receivers, the CSI changes,
 * features are extracted, and a "model" estimates where the person is.
 *
 * Room coordinates are metres, x ∈ [-4, 4], z ∈ [-3, 3], floor at y = 0.
 */

export const ROOM = { w: 8, d: 6, h: 2.6 };
export const SUBCARRIERS = 52;
export const HISTORY = 120;

export interface V2 {
  x: number;
  z: number;
}

export const TX: V2 & { y: number } = { x: -3.7, z: -2.2, y: 1.1 };
export const RX: (V2 & { y: number; name: string })[] = [
  { x: 3.7, z: -2.0, y: 1.1, name: "RX A" },
  { x: 3.2, z: 2.7, y: 1.1, name: "RX B" },
  { x: -3.4, z: 2.6, y: 1.1, name: "RX C" },
];

const C = 299_792_458;
const F0 = 2.437e9; // channel 6
const DF = 312.5e3; // OFDM subcarrier spacing

function distToSegment(p: V2, a: V2, b: V2) {
  const lx = b.x - a.x;
  const lz = b.z - a.z;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * lx + (p.z - a.z) * lz) / (lx * lx + lz * lz)));
  return Math.hypot(a.x + lx * t - p.x, a.z + lz * t - p.z);
}

export class WifiSim {
  t = 0;
  person: V2 = { x: 0, z: 0.4 };
  vel: V2 = { x: 0, z: 0 };
  heading = 0;
  walkPhase = 0;
  speed = 0;
  /** Optional target set by the visitor's pointer (room coords). */
  target: V2 | null = null;
  targetAge = 99;
  /** CSI amplitude history per link: [link][time][subcarrier]. */
  csi: Float32Array[][] = RX.map(() => []);
  /** Per-link disturbance 0..1 (how strongly the person perturbs that path). */
  influence = RX.map(() => 0);
  /** Extracted features. */
  motion = 0;
  presence = 0;
  /** Simulated model output. */
  est: V2 = { x: 0, z: 0.4 };
  estSigma = 0.8;
  /** Activations of the toy network, for drawing. */
  layers: Float32Array[] = [new Float32Array(9), new Float32Array(8), new Float32Array(6), new Float32Array(3)];
  private rng = mulberry32(17);
  private base: Float32Array[];
  private prevRow: Float32Array[] = [];

  constructor() {
    // Static multipath "fingerprint" of the empty room, per link.
    this.base = RX.map((_, li) => {
      const r = new Float32Array(SUBCARRIERS);
      for (let k = 0; k < SUBCARRIERS; k++) r[k] = 0.5 + 0.2 * Math.sin(k * 0.31 + li * 1.7) + 0.1 * Math.sin(k * 0.83 + li) + 0.05 * Math.cos(k * 1.9 + li * 3);
      return r;
    });
  }

  setTarget(p: V2 | null) {
    this.target = p;
    this.targetAge = 0;
  }

  step(dt: number) {
    if (dt <= 0) return;
    this.t += dt;
    this.targetAge += dt;
    const t = this.t;

    // --- person: wander a Lissajous path, or walk to the visitor's target
    let goal: V2;
    if (this.target && this.targetAge < 4) goal = this.target;
    else goal = { x: Math.sin(t * 0.21) * 2.6 + Math.sin(t * 0.07) * 0.5, z: Math.sin(t * 0.33 + 1.1) * 1.8 };
    const gx = goal.x - this.person.x;
    const gz = goal.z - this.person.z;
    const gd = Math.hypot(gx, gz);
    const want = Math.min(1.25, gd * 1.6);
    const ax = (gd > 0.01 ? (gx / gd) * want : 0) - this.vel.x;
    const az = (gd > 0.01 ? (gz / gd) * want : 0) - this.vel.z;
    this.vel.x += ax * Math.min(1, dt * 3);
    this.vel.z += az * Math.min(1, dt * 3);
    this.person.x = Math.max(-3.4, Math.min(3.4, this.person.x + this.vel.x * dt));
    this.person.z = Math.max(-2.5, Math.min(2.5, this.person.z + this.vel.z * dt));
    this.speed = Math.hypot(this.vel.x, this.vel.z);
    if (this.speed > 0.05) {
      const h = Math.atan2(this.vel.x, this.vel.z);
      let d = h - this.heading;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      this.heading += d * Math.min(1, dt * 6);
    }
    this.walkPhase += dt * (2 + this.speed * 5) * Math.min(1, this.speed * 2 + 0.05);

    // --- CSI per link: empty-room fingerprint + the person's reflected path
    let motion = 0;
    RX.forEach((rx, li) => {
      const los = distToSegment(this.person, TX, rx);
      const inf = Math.exp(-(los * los) / (2 * 0.9 * 0.9));
      this.influence[li] = inf;
      const dTx = Math.hypot(this.person.x - TX.x, this.person.z - TX.z, 1.1 - TX.y);
      const dRx = Math.hypot(this.person.x - rx.x, this.person.z - rx.z, 1.1 - rx.y);
      const excess = dTx + dRx - Math.hypot(rx.x - TX.x, rx.z - TX.z);
      const row = new Float32Array(SUBCARRIERS);
      const breath = 0.012 * Math.sin(t * 1.6 + li);
      for (let k = 0; k < SUBCARRIERS; k++) {
        const f = F0 + (k - SUBCARRIERS / 2) * DF;
        const phase = (2 * Math.PI * excess * f) / C;
        const refl = (0.18 + 0.32 * inf) / (1 + 0.15 * excess);
        const v = this.base[li][k] + refl * Math.cos(phase + this.walkPhase * 0.6) + breath + (this.rng() - 0.5) * 0.035;
        row[k] = Math.max(0, Math.min(1, v));
      }
      const prev = this.prevRow[li];
      if (prev) {
        let d = 0;
        for (let k = 0; k < SUBCARRIERS; k++) d += Math.abs(row[k] - prev[k]);
        motion += d / SUBCARRIERS;
      }
      this.prevRow[li] = row;
      const hist = this.csi[li];
      hist.push(row);
      if (hist.length > HISTORY) hist.shift();
    });
    const m = Math.min(1, (motion / RX.length) * 9);
    this.motion += (m - this.motion) * Math.min(1, dt * 4);
    this.presence += ((this.motion > 0.12 || Math.max(...this.influence) > 0.2 ? 1 : 0.15) - this.presence) * Math.min(1, dt * 2);

    // --- toy "model": lagging, noisy estimate whose uncertainty shrinks with signal
    const conf = Math.min(1, 0.25 + this.motion * 0.9 + Math.max(...this.influence) * 0.5);
    const lag = Math.min(1, dt * (1.2 + conf * 2));
    this.est.x += (this.person.x + (this.rng() - 0.5) * 0.5 * (1 - conf) - this.est.x) * lag;
    this.est.z += (this.person.z + (this.rng() - 0.5) * 0.5 * (1 - conf) - this.est.z) * lag;
    this.estSigma += (0.25 + (1 - conf) * 0.9 - this.estSigma) * Math.min(1, dt * 2);

    // activations for the drawing (input → hidden → hidden → output)
    const L = this.layers;
    for (let i = 0; i < L[0].length; i++) L[0][i] = 0.3 + 0.7 * Math.abs(Math.sin(t * 3 + i * 1.3)) * (0.3 + this.motion);
    for (let l = 1; l < L.length; l++)
      for (let i = 0; i < L[l].length; i++) {
        let s = 0;
        for (let j = 0; j < L[l - 1].length; j++) s += L[l - 1][j] * Math.sin((i + 1) * (j + 2) * 0.7 + l);
        L[l][i] = 1 / (1 + Math.exp(-s * 0.9));
      }
    L[3][0] = this.presence;
    L[3][1] = Math.min(1, this.motion * 1.4);
    L[3][2] = conf;
  }
}
