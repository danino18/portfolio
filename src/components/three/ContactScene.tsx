"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { mulberry32, clamp, smooth } from "@/lib/rng";
import { scrollState } from "@/lib/scrollState";
import { scaleByTier, useQuality } from "@/lib/quality";

const FOV = 40;
const CAM_Z = 10;

/** Samples filled-glyph positions from a 2D canvas render of the headline. */
function sampleText(lines: string[], family: string, textW: number, want: number, seed: number, yOffset: number) {
  const W = 1500;
  const c = document.createElement("canvas");
  const probe = c.getContext("2d")!;
  probe.font = `800 100px ${family}`;
  const widest = Math.max(...lines.map((l) => probe.measureText(l).width));
  const fs = Math.min(260, (W * 0.94) / widest * 100);
  const lh = fs * 1.04;
  const H = Math.ceil(lh * lines.length + fs * 0.2);
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#fff";
  ctx.font = `800 ${fs}px ${family}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  lines.forEach((l, i) => ctx.fillText(l, W / 2, fs * 0.1 + lh * (i + 0.5)));
  const data = ctx.getImageData(0, 0, W, H).data;
  const step = 3;
  const pts: number[] = [];
  for (let y = 0; y < H; y += step)
    for (let x = 0; x < W; x += step) if (data[(y * W + x) * 4 + 3] > 140) pts.push(x, y);
  const total = pts.length / 2;
  const rng = mulberry32(seed);
  const out = new Float32Array(want * 3);
  const idx = Array.from({ length: total }, (_, i) => i);
  for (let i = 0; i < Math.min(want, total); i++) {
    const j = i + Math.floor(rng() * (total - i));
    [idx[i], idx[j]] = [idx[j], idx[i]];
  }
  for (let i = 0; i < want; i++) {
    const k = idx[i % total];
    const jitter = i >= total ? (rng() - 0.5) * 2 : 0;
    out[i * 3] = ((pts[k * 2] + jitter) / W - 0.5) * textW;
    out[i * 3 + 1] = -((pts[k * 2 + 1] + jitter) / H - 0.5) * textW * (H / W) + yOffset;
    out[i * 3 + 2] = 0;
  }
  return out;
}

/** Start positions: four motifs (chip lattice, helix, constellation, arm) that later converge into the headline. */
function motifStarts(n: number, halfW: number, halfH: number, seed: number) {
  const rng = mulberry32(seed);
  const out = new Float32Array(n * 3);
  const ox = Math.min(halfW * 0.62, 6.5);
  const oy = Math.min(halfH * 0.55, 3.2);
  for (let i = 0; i < n; i++) {
    const m = i % 4;
    const t = rng();
    let x = 0;
    let y = 0;
    let z = (rng() - 0.5) * 1.2;
    if (m === 0) {
      // chip lattice, top-left
      const gx = Math.floor(rng() * 14) / 13;
      const gy = Math.floor(rng() * 14) / 13;
      x = -ox + (gx - 0.5) * 2.6;
      y = oy + (gy - 0.5) * 2.6;
    } else if (m === 1) {
      // helix, top-right
      const a = t * Math.PI * 6;
      x = ox + (t - 0.5) * 4;
      y = oy + Math.cos(a + (i % 8 < 4 ? 0 : Math.PI)) * 0.9;
      z = Math.sin(a + (i % 8 < 4 ? 0 : Math.PI)) * 0.9;
    } else if (m === 2) {
      // constellation ring, bottom-left
      const a = t * Math.PI * 2;
      const r = 1.2 + (i % 5) * 0.28;
      x = -ox + Math.cos(a) * r;
      y = -oy + Math.sin(a) * r * 0.8;
    } else {
      // robot arm polyline, bottom-right
      const seg = t * 3;
      const k = Math.floor(seg);
      const u = seg - k;
      const P = [
        [0, -1.2],
        [0.1, 0.3],
        [1.4, 1.1],
        [2.2, -0.2],
      ];
      const a = P[Math.min(k, 2)];
      const b = P[Math.min(k, 2) + 1];
      x = ox - 1 + a[0] + (b[0] - a[0]) * u;
      y = -oy + a[1] + (b[1] - a[1]) * u + (rng() - 0.5) * 0.06;
    }
    out[i * 3] = x;
    out[i * 3 + 1] = y;
    out[i * 3 + 2] = z;
  }
  return out;
}

const vert = /* glsl */ `
  attribute vec3 aStart;
  attribute float aDelay;
  attribute float aSeed;
  attribute float aSize;
  uniform float uConverge;
  uniform float uTime;
  uniform float uPx;
  uniform vec2 uPointer;
  uniform vec3 uCyan;
  uniform vec3 uViolet;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    float e = smoothstep(aDelay * 0.5, aDelay * 0.5 + 0.5, uConverge);
    float arc = sin(e * 3.14159);
    vec3 p = mix(aStart, position, e);
    p.xy += (vec2(aSeed, fract(aSeed * 7.31)) - 0.5) * arc * 5.0;
    p.z += (aSeed - 0.5) * arc * 6.0;
    p += vec3(sin(uTime * 0.5 + aSeed * 20.0), cos(uTime * 0.4 + aSeed * 13.0), sin(uTime * 0.3 + aSeed * 7.0)) * 0.07 * (1.0 - e * 0.75);
    p.z += sin(uTime * 1.6 + aSeed * 30.0) * 0.02 * e;
    vec2 d = p.xy - uPointer;
    float dist = length(d);
    float push = exp(-dist * dist * 1.1) * 0.8 * e;
    p.xy += d / (dist + 0.001) * push;
    p.z += push * 1.2;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = aSize * uPx * (1.0 + push * 2.0) * (26.0 / -mv.z);
    float tcol = smoothstep(-6.0, 6.0, position.x + sin(aSeed * 10.0) * 0.6);
    vec3 col = mix(uCyan, uViolet, tcol);
    float spark = step(0.97, fract(aSeed * 91.7));
    vColor = col + vec3(spark * 0.7 + push * 0.6);
    vAlpha = mix(0.5, 1.0, e) * (0.7 + 0.3 * sin(uTime * 2.0 + aSeed * 40.0));
  }
`;
const frag = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = pow(smoothstep(0.5, 0.0, d), 1.6);
    gl_FragColor = vec4(vColor * (1.1 + a * 1.2), a * vAlpha);
  }
`;

export default function ContactScene({ lines, onReady }: { lines: string[]; onReady?: () => void }) {
  const q = useQuality();
  const tier = q?.tier ?? 1;
  const reduced = q?.reducedMotion ?? false;
  const { size, invalidate } = useThree();
  const aspect = size.width / size.height;
  const halfH = Math.tan((FOV * Math.PI) / 360) * CAM_Z;
  const halfW = halfH * aspect;
  const N = scaleByTier(26000, tier);
  const geo = useRef<THREE.BufferGeometry>(null);
  const [fontKey, setFontKey] = useState(0);

  // Re-sample once the display font is available.
  useEffect(() => {
    let alive = true;
    const fam = getComputedStyle(document.documentElement).getPropertyValue("--font-syne").trim() || "sans-serif";
    document.fonts.load(`800 100px ${fam}`).finally(() => alive && setFontKey((k) => k + 1));
    return () => {
      alive = false;
    };
  }, []);

  const family = useMemo(() => {
    if (typeof document === "undefined") return "sans-serif";
    return getComputedStyle(document.documentElement).getPropertyValue("--font-syne").trim() || "sans-serif";
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fontKey]);

  const textW = Math.min(halfW * 2 * 0.9, 15);
  const attrs = useMemo(() => {
    const target = sampleText(lines, family, textW, N, 3, halfH * 0.2);
    const start = motifStarts(N, halfW, halfH, 11);
    const rng = mulberry32(5);
    const delay = new Float32Array(N);
    const seed = new Float32Array(N);
    const sz = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      delay[i] = rng();
      seed[i] = rng();
      sz[i] = (1.1 + rng() * 1.5) * (tier <= 1 ? 1.25 : 1);
    }
    return { target, start, delay, seed, sz };
  }, [lines, family, textW, N, halfW, halfH, tier]);

  useEffect(() => {
    onReady?.();
    invalidate();
  }, [attrs, onReady, invalidate]);

  const uniforms = useMemo(
    () => ({
      uConverge: { value: reduced ? 1 : 0 },
      uTime: { value: 0 },
      uPx: { value: 1 },
      uPointer: { value: new THREE.Vector2(99, 99) },
      uCyan: { value: new THREE.Color("#38e8ff") },
      uViolet: { value: new THREE.Color("#8b5cff") },
    }),
    [reduced],
  );
  const mat = useMemo(
    () => new THREE.ShaderMaterial({ uniforms, vertexShader: vert, fragmentShader: frag, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }),
    [uniforms],
  );

  useFrame((state, dt) => {
    if (!reduced) uniforms.uTime.value += Math.min(dt, 0.05);
    const p = scrollState.contact;
    uniforms.uConverge.value = reduced ? 1 : smooth(0.04, 0.66, p);
    uniforms.uPx.value = state.gl.getPixelRatio();
    const pt = scrollState.pointer;
    uniforms.uPointer.value.set(pt.x * halfW, pt.y * halfH);
    state.camera.position.x = pt.x * 0.25;
    state.camera.position.y = pt.y * 0.15;
    state.camera.lookAt(0, 0, 0);
    void clamp;
  });

  return (
    <points frustumCulled={false}>
      <bufferGeometry ref={geo} key={`${N}-${fontKey}-${lines.join("|")}-${Math.round(textW * 10)}`}>
        <bufferAttribute attach="attributes-position" args={[attrs.target, 3]} />
        <bufferAttribute attach="attributes-aStart" args={[attrs.start, 3]} />
        <bufferAttribute attach="attributes-aDelay" args={[attrs.delay, 1]} />
        <bufferAttribute attach="attributes-aSeed" args={[attrs.seed, 1]} />
        <bufferAttribute attach="attributes-aSize" args={[attrs.sz, 1]} />
      </bufferGeometry>
      <primitive object={mat} attach="material" />
    </points>
  );
}

export const CONTACT_CAMERA = { position: [0, 0, CAM_Z] as [number, number, number], fov: FOV };
