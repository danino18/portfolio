"use client";

import { useMemo, useRef, type MutableRefObject } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { mulberry32, lerp, clamp } from "@/lib/rng";
import { scrollState } from "@/lib/scrollState";
import { useQuality, type Tier } from "@/lib/quality";

export interface DartControl {
  target: number;
  invalidate?: () => void;
}

const THREADS_PER_BLOCK = 64;

function build(tier: Tier) {
  const blocks = tier >= 3 ? 96 : tier === 2 ? 60 : 36;
  const cols = tier >= 3 ? 12 : tier === 2 ? 10 : 6;
  const N = blocks * THREADS_PER_BLOCK;
  const rng = mulberry32(20240);
  const helix = new Float32Array(N * 3);
  const grid = new Float32Array(N * 3);
  const delay = new Float32Array(N);
  const tone = new Float32Array(N);
  const seed = new Float32Array(N);
  const warp = new Float32Array(N);
  const block = new Float32Array(N);
  const size = new Float32Array(N);

  const L = 15;
  const R = 1.55;
  const turns = 3.2;
  const strand = (t: number, which: number): [number, number, number] => {
    const a = t * turns * Math.PI * 2 + which * Math.PI;
    return [(t - 0.5) * L, Math.cos(a) * R, Math.sin(a) * R];
  };

  const rows = Math.ceil(blocks / cols);
  const pitch = 1.42;
  const tp = 0.135;
  const per = N / 3;

  for (let i = 0; i < N; i++) {
    const cat = i % 3;
    const k = (i - cat) / 3;
    const t = k / per;
    let p: [number, number, number];
    if (cat < 2) {
      p = strand(t, cat);
      const j = 0.05;
      p = [p[0] + (rng() - 0.5) * j, p[1] + (rng() - 0.5) * j, p[2] + (rng() - 0.5) * j];
      tone[i] = cat === 0 ? 0.0 : 0.33;
      size[i] = 1.5 + rng() * 0.7;
    } else {
      const tq = Math.floor(t * 90) / 90;
      const a = strand(tq, 0);
      const b = strand(tq, 1);
      const s = rng();
      p = [lerp(a[0], b[0], s), lerp(a[1], b[1], s), lerp(a[2], b[2], s)];
      const base = Math.floor(tq * 90) % 4;
      tone[i] = base < 2 ? 0.66 : 1.0;
      size[i] = 1.0 + rng() * 0.6;
    }
    helix[i * 3] = p[0];
    helix[i * 3 + 1] = p[1];
    helix[i * 3 + 2] = p[2];

    const bi = Math.floor(i / THREADS_PER_BLOCK);
    const th = i % THREADS_PER_BLOCK;
    const bx = bi % cols;
    const by = Math.floor(bi / cols);
    const tx = th % 8;
    const ty = Math.floor(th / 8);
    grid[i * 3] = (bx - (cols - 1) / 2) * pitch + (tx - 3.5) * tp;
    grid[i * 3 + 1] = -((by - (rows - 1) / 2) * pitch + (ty - 3.5) * tp);
    grid[i * 3 + 2] = 0;
    delay[i] = clamp(t * 0.8 + rng() * 0.2);
    seed[i] = rng();
    warp[i] = Math.floor(th / 32);
    block[i] = bi;
  }
  return { N, helix, grid, delay, tone, seed, warp, block, size };
}

const vert = /* glsl */ `
  attribute vec3 aGrid;
  attribute float aDelay;
  attribute float aTone;
  attribute float aSeed;
  attribute float aWarp;
  attribute float aBlock;
  attribute float aSize;
  uniform float uMorph;
  uniform float uTime;
  uniform float uPx;
  uniform vec3 uPointer;
  uniform vec3 uC0;
  uniform vec3 uC1;
  uniform vec3 uC2;
  uniform vec3 uC3;
  varying vec3 vColor;
  varying float vAlpha;
  float hash(float n) { return fract(sin(n * 12.9898) * 43758.5453); }
  void main() {
    float e = smoothstep(aDelay * 0.55, aDelay * 0.55 + 0.45, uMorph);
    vec3 h = position;
    float ang = uTime * 0.32;
    float c = cos(ang), s = sin(ang);
    h.yz = mat2(c, -s, s, c) * h.yz;
    float breathe = 1.0 + 0.05 * sin(uTime * 1.3 + h.x * 0.8);
    h.yz *= breathe;

    float arc = sin(e * 3.14159);
    vec3 off = vec3(0.0, sin(aSeed * 6.2831), cos(aSeed * 6.2831)) * arc * 3.4;
    vec3 p = mix(h, aGrid, e) + off;

    // pointer push
    float d = distance(p.xy, uPointer.xy);
    float w = exp(-d * d * 0.5);
    p.z += w * 0.8 * (1.0 - e * 0.5);

    // seed-lookup sweep across the thread grid
    float bandX = mix(-8.5, 8.5, fract(uTime * 0.11));
    float band = exp(-pow((aGrid.x - bandX) * 0.55, 2.0)) * e;
    float act = step(0.9, hash(aBlock * 7.13 + aWarp * 3.7 + floor(uTime * 1.6 + aSeed * 3.0))) * e;

    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = aSize * uPx * (1.0 + act * 1.6 + band * 0.9 + w * 1.2) * (34.0 / -mv.z) * mix(1.0, 0.85, e);

    vec3 base = aTone < 0.2 ? uC0 : aTone < 0.5 ? uC1 : aTone < 0.8 ? uC2 : uC3;
    vec3 gridCol = mix(uC0 * 0.5, uC1, 0.35);
    vec3 col = mix(base, gridCol, e);
    col += vec3(1.0) * (act * 0.8 + band * 0.45 + w * 0.5);
    vColor = col;
    vAlpha = mix(0.8, 0.55 + act * 0.45 + band * 0.4, e);
  }
`;

const frag = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = pow(smoothstep(0.5, 0.0, d), 1.6);
    gl_FragColor = vec4(vColor * (0.9 + a), a * vAlpha);
  }
`;

const _plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
const _ray = new THREE.Raycaster();
const _hit = new THREE.Vector3();

export default function DartScene({ ctl, colors }: { ctl: MutableRefObject<DartControl>; colors: [string, string] }) {
  const q = useQuality();
  const tier = q?.tier ?? 1;
  const reduced = q?.reducedMotion ?? false;
  const data = useMemo(() => build(tier), [tier]);
  const { invalidate, size } = useThree();
  const grp = useRef<THREE.Group>(null);

  const uniforms = useMemo(
    () => ({
      uMorph: { value: 0 },
      uTime: { value: 0 },
      uPx: { value: 1 },
      uPointer: { value: new THREE.Vector3(99, 99, 0) },
      uC0: { value: new THREE.Color(colors[0]) },
      uC1: { value: new THREE.Color(colors[1]) },
      uC2: { value: new THREE.Color("#8b5cff") },
      uC3: { value: new THREE.Color("#e9edf6") },
    }),
    [colors],
  );
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms,
        vertexShader: vert,
        fragmentShader: frag,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    [uniforms],
  );

  ctl.current.invalidate = invalidate;
  const aspect = size.width / size.height;
  const fit = clamp(aspect / 1.6, 0.42, 1.1);

  useFrame((state, dtRaw) => {
    const dt = Math.min(dtRaw, 0.05);
    const u = uniforms;
    if (!reduced) u.uTime.value += dt;
    const target = ctl.current.target;
    u.uMorph.value = reduced ? target : lerp(u.uMorph.value, target, 1 - Math.exp(-dt * 2.2));
    if (reduced && Math.abs(u.uMorph.value - target) > 0.001) u.uMorph.value = target;
    u.uPx.value = state.gl.getPixelRatio();

    const pt = scrollState.pointer;
    const g = grp.current;
    if (!g) return;
    const m = u.uMorph.value;
    g.rotation.x = lerp(0.2, -0.38, m) + pt.y * 0.12;
    g.rotation.y = lerp(0, 0.18, m) + pt.x * 0.2;
    g.scale.setScalar(fit * lerp(1, 0.96, m));

    g.updateMatrixWorld();
    _ray.setFromCamera(new THREE.Vector2(pt.x, pt.y), state.camera);
    if (_ray.ray.intersectPlane(_plane, _hit)) u.uPointer.value.copy(_hit);
  });

  return (
    <group ref={grp}>
      <points frustumCulled={false}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[data.helix, 3]} />
          <bufferAttribute attach="attributes-aGrid" args={[data.grid, 3]} />
          <bufferAttribute attach="attributes-aDelay" args={[data.delay, 1]} />
          <bufferAttribute attach="attributes-aTone" args={[data.tone, 1]} />
          <bufferAttribute attach="attributes-aSeed" args={[data.seed, 1]} />
          <bufferAttribute attach="attributes-aWarp" args={[data.warp, 1]} />
          <bufferAttribute attach="attributes-aBlock" args={[data.block, 1]} />
          <bufferAttribute attach="attributes-aSize" args={[data.size, 1]} />
        </bufferGeometry>
        <primitive object={mat} attach="material" />
      </points>
    </group>
  );
}

export const dartThreadCount = (tier: Tier) => (tier >= 3 ? 96 : tier === 2 ? 60 : 36) * THREADS_PER_BLOCK;
