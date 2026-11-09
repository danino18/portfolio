"use client";

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { mulberry32, clamp, lerp, smooth } from "@/lib/rng";
import { scrollState } from "@/lib/scrollState";
import { scaleByTier, useQuality, type Tier } from "@/lib/quality";

const CYAN = new THREE.Color("#38e8ff");
const VIOLET = new THREE.Color("#8b5cff");

const GRID = 8;
const TILE = 0.62;
const GAP = 0.1;
const PITCH = TILE + GAP;
const HALF = (GRID * PITCH - GAP) / 2;

interface ChipData {
  pos: Float32Array;
  start: Float32Array;
  delay: Float32Array;
  size: Float32Array;
  tone: Float32Array;
  seed: Float32Array;
  count: number;
  linePos: Float32Array;
  lineProg: Float32Array;
  lineSeed: Float32Array;
  lineTone: Float32Array;
  lineDelay: Float32Array;
  lineCount: number;
}

function buildChip(tier: Tier): ChipData {
  const rng = mulberry32(1337);
  const n = tier >= 3 ? 6 : tier === 2 ? 5 : 4;
  const tracesPerSide = scaleByTier(30, tier);

  const P: number[] = [];
  const S: number[] = [];
  const D: number[] = [];
  const Z: number[] = [];
  const T: number[] = [];
  const R: number[] = [];

  const scatter = (): [number, number, number] => {
    const r = 9 + rng() * 14;
    const th = rng() * Math.PI * 2;
    const ph = Math.acos(2 * rng() - 1);
    return [r * Math.sin(ph) * Math.cos(th), r * Math.sin(ph) * Math.sin(th), r * Math.cos(ph) - 2];
  };
  const add = (x: number, y: number, z: number, size: number, tone: number, delay: number) => {
    P.push(x, y, z);
    const s = scatter();
    S.push(s[0], s[1], s[2]);
    D.push(delay);
    Z.push(size);
    T.push(tone);
    R.push(rng());
  };

  // Die: grid of compute tiles, each a small lattice of nodes.
  for (let i = 0; i < GRID; i++) {
    for (let j = 0; j < GRID; j++) {
      const cx = (i - (GRID - 1) / 2) * PITCH;
      const cy = (j - (GRID - 1) / 2) * PITCH;
      const toneBase = rng() < 0.22 ? 0.85 : 0.1 + rng() * 0.3;
      const dist = Math.hypot(i - 3.5, j - 3.5) / 5;
      for (let a = 0; a < n; a++) {
        for (let b = 0; b < n; b++) {
          const x = cx + ((a / (n - 1)) - 0.5) * TILE * 0.82;
          const y = cy + ((b / (n - 1)) - 0.5) * TILE * 0.82;
          add(x, y, 0.02, 1.1 + rng() * 1.2, toneBase + (rng() - 0.5) * 0.15, clamp(dist * 0.7 + rng() * 0.3));
        }
      }
    }
  }

  // Traces fanning out from each die edge.
  const lineP: number[] = [];
  const lineG: number[] = [];
  const lineS: number[] = [];
  const lineT: number[] = [];
  const lineD: number[] = [];

  for (let side = 0; side < 4; side++) {
    const ang = (side * Math.PI) / 2;
    const out = new THREE.Vector2(Math.cos(ang), Math.sin(ang));
    const lat = new THREE.Vector2(-out.y, out.x);
    for (let k = 0; k < tracesPerSide; k++) {
      const u = ((k + 0.5) / tracesPerSide - 0.5) * (HALF * 2 - 0.4);
      const l1 = 0.5 + rng() * 1.1;
      const jog = (rng() < 0.5 ? -1 : 1) * (0.25 + rng() * 0.9);
      const l2 = 0.7 + rng() * 1.6;
      const base = out.clone().multiplyScalar(HALF + 0.02).add(lat.clone().multiplyScalar(u));
      const p0 = base.clone();
      const p1 = base.clone().add(out.clone().multiplyScalar(l1));
      const p2 = p1.clone().add(out.clone().multiplyScalar(Math.abs(jog))).add(lat.clone().multiplyScalar(jog));
      const p3 = p2.clone().add(out.clone().multiplyScalar(l2));
      const pts = [p0, p1, p2, p3];
      const lens = [0];
      for (let q = 1; q < pts.length; q++) lens.push(lens[q - 1] + pts[q].distanceTo(pts[q - 1]));
      const total = lens[lens.length - 1];
      const tone = rng() < 0.3 ? 0.9 : 0.05 + rng() * 0.25;
      const seed = rng();
      const delay = rng();

      for (let q = 0; q < pts.length - 1; q++) {
        lineP.push(pts[q].x, pts[q].y, 0.01, pts[q + 1].x, pts[q + 1].y, 0.01);
        lineG.push(lens[q] / total, lens[q + 1] / total);
        lineS.push(seed, seed);
        lineT.push(tone, tone);
        lineD.push(delay, delay);
      }

      // Nodes along the trace, plus a larger pad at the end.
      const spacing = tier >= 3 ? 0.14 : 0.22;
      for (let d = 0.12; d < total; d += spacing) {
        let q = 1;
        while (q < lens.length - 1 && lens[q] < d) q++;
        const t = (d - lens[q - 1]) / (lens[q] - lens[q - 1]);
        const x = lerp(pts[q - 1].x, pts[q].x, t);
        const y = lerp(pts[q - 1].y, pts[q].y, t);
        add(x, y, 0.01, 0.7 + rng() * 0.6, tone, clamp(0.25 + (d / total) * 0.5 + delay * 0.2));
      }
      add(p3.x, p3.y, 0.015, 3.2, tone, clamp(0.75 + rng() * 0.25));
    }
  }

  // Ambient dust floating above the package.
  const dust = scaleByTier(1800, tier);
  for (let i = 0; i < dust; i++) {
    const x = (rng() - 0.5) * 22;
    const y = (rng() - 0.5) * 16;
    add(x, y, 0.4 + rng() * 5, 0.8 + rng() * 1.6, rng() < 0.5 ? 0.05 : 0.9, rng());
  }

  return {
    pos: new Float32Array(P),
    start: new Float32Array(S),
    delay: new Float32Array(D),
    size: new Float32Array(Z),
    tone: new Float32Array(T),
    seed: new Float32Array(R),
    count: P.length / 3,
    linePos: new Float32Array(lineP),
    lineProg: new Float32Array(lineG),
    lineSeed: new Float32Array(lineS),
    lineTone: new Float32Array(lineT),
    lineDelay: new Float32Array(lineD),
    lineCount: lineP.length / 3,
  };
}

const pointsVert = /* glsl */ `
  attribute vec3 aStart;
  attribute float aDelay;
  attribute float aSize;
  attribute float aTone;
  attribute float aSeed;
  uniform float uTime;
  uniform float uIntro;
  uniform float uPx;
  uniform vec3 uPointer;
  uniform float uPointerStrength;
  uniform vec3 uCyan;
  uniform vec3 uViolet;
  uniform float uFade;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    float t = clamp((uIntro - aDelay * 0.62) / 0.38, 0.0, 1.0);
    float e = 1.0 - pow(1.0 - t, 3.0);
    vec3 p = mix(aStart, position, e);
    // spiral-in during assembly
    float swirl = (1.0 - e) * 2.2;
    float cs = cos(swirl), sn = sin(swirl);
    p.xy = mat2(cs, -sn, sn, cs) * p.xy;
    p.z += sin(uTime * 1.1 + aSeed * 6.2831 + position.x * 0.7) * 0.035 * e;
    float d = distance(p.xy, uPointer.xy);
    float w = exp(-d * d * 0.42) * uPointerStrength;
    p.z += w * 0.85;
    vec2 dir = p.xy - uPointer.xy;
    p.xy += dir / (length(dir) + 0.001) * w * 0.1;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    float tw = 0.65 + 0.35 * sin(uTime * 2.0 + aSeed * 40.0);
    gl_PointSize = aSize * uPx * (1.0 + w * 1.6) * (0.75 + 0.25 * tw) * (30.0 / -mv.z);
    vColor = mix(uCyan, uViolet, clamp(aTone, 0.0, 1.0)) + vec3(w * 0.7);
    vAlpha = (0.35 + 0.65 * e) * (0.55 + 0.45 * tw) * uFade;
  }
`;

const pointsFrag = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.0, d);
    a = pow(a, 1.7);
    gl_FragColor = vec4(vColor * (0.8 + a), a * vAlpha);
  }
`;

const linesVert = /* glsl */ `
  attribute float aProg;
  attribute float aSeed;
  attribute float aTone;
  attribute float aDelay;
  uniform float uIntro;
  uniform float uFade;
  varying float vProg;
  varying float vSeed;
  varying float vTone;
  varying float vReveal;
  varying float vFade;
  void main() {
    vProg = aProg; vSeed = aSeed; vTone = aTone; vFade = uFade;
    vReveal = clamp((uIntro * 1.7 - aDelay * 0.55 - aProg * 0.5) * 4.0, 0.0, 1.0);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const linesFrag = /* glsl */ `
  uniform float uTime;
  uniform vec3 uCyan;
  uniform vec3 uViolet;
  varying float vProg;
  varying float vSeed;
  varying float vTone;
  varying float vReveal;
  varying float vFade;
  void main() {
    float f = fract(vProg * 0.8 - uTime * (0.22 + vSeed * 0.3) + vSeed * 7.0);
    float head = pow(f, 9.0);
    vec3 c = mix(uCyan, uViolet, vTone);
    float a = (0.16 + head * 1.1) * vReveal * vFade;
    gl_FragColor = vec4(c * (0.7 + head * 1.6), a);
  }
`;

const dieVert = /* glsl */ `
  varying vec2 vPos;
  void main() {
    vPos = position.xy;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const dieFrag = /* glsl */ `
  uniform float uTime;
  uniform float uIntro;
  uniform float uFade;
  uniform vec3 uPointer;
  uniform vec3 uCyan;
  uniform vec3 uViolet;
  varying vec2 vPos;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  void main() {
    float hf = ${HALF.toFixed(4)};
    float pitch = ${PITCH.toFixed(4)};
    vec2 g = (vPos + hf) / pitch;
    vec2 id = floor(g);
    vec2 f = fract(g);
    float inDie = step(abs(vPos.x), hf) * step(abs(vPos.y), hf);

    // package substrate: fine pad array fading outward
    vec2 sp = vPos * 3.2;
    float pad = smoothstep(0.23, 0.17, length(fract(sp) - 0.5));
    float rad = length(vPos);
    float subMask = smoothstep(9.5, 3.5, rad);
    vec3 col = vec3(0.025, 0.03, 0.045) + vec3(0.02, 0.035, 0.05) * pad * subMask * (1.0 - inDie);

    // die body
    vec3 dieCol = vec3(0.04, 0.05, 0.075);
    float edge = min(min(f.x, 1.0 - f.x), min(f.y, 1.0 - f.y));
    float grid = smoothstep(0.1, 0.0, edge * pitch / ${GAP.toFixed(4)});
    float act = step(0.84, hash(id + floor(uTime * 0.7 + hash(id) * 9.0)));
    vec3 tone = mix(uCyan, uViolet, step(0.78, hash(id + 3.7)));
    dieCol += tone * (grid * 0.05 + act * 0.1 * (1.0 - grid));
    col = mix(col, dieCol, inDie);

    // die rim light
    float rim = smoothstep(0.1, 0.0, abs(max(abs(vPos.x), abs(vPos.y)) - hf));
    col += uCyan * rim * 0.55;

    // pointer glow
    float pd = distance(vPos, uPointer.xy);
    col += uCyan * exp(-pd * pd * 0.5) * 0.07 + uViolet * exp(-pd * pd * 0.12) * 0.03;

    float reveal = smoothstep(0.0, 0.5, uIntro);
    gl_FragColor = vec4(col * reveal, uFade * reveal);
  }
`;

const _plane = new THREE.Plane();
const _ray = new THREE.Raycaster();
const _hit = new THREE.Vector3();
const _n = new THREE.Vector3();
const _p = new THREE.Vector3();
const _v2 = new THREE.Vector2();

export default function HeroScene({ introSeconds = 3.6 }: { introSeconds?: number }) {
  const q = useQuality();
  const tier = q?.tier ?? 1;
  const reduced = q?.reducedMotion ?? false;
  const coarse = q?.coarse ?? false;
  const data = useMemo(() => buildChip(tier), [tier]);
  const group = useRef<THREE.Group>(null);
  const { size } = useThree();

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uIntro: { value: scrollState.intro },
      uPx: { value: 1 },
      uPointer: { value: new THREE.Vector3(99, 99, 0) },
      uPointerStrength: { value: 0 },
      uCyan: { value: CYAN },
      uViolet: { value: VIOLET },
      uFade: { value: 1 },
    }),
    [],
  );

  const pointsMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms,
        vertexShader: pointsVert,
        fragmentShader: pointsFrag,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    [uniforms],
  );
  const linesMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms,
        vertexShader: linesVert,
        fragmentShader: linesFrag,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    [uniforms],
  );
  const dieMat = useMemo(
    () => new THREE.ShaderMaterial({ uniforms, vertexShader: dieVert, fragmentShader: dieFrag, transparent: true, depthWrite: false }),
    [uniforms],
  );

  useEffect(() => () => {
    pointsMat.dispose();
    linesMat.dispose();
    dieMat.dispose();
  }, [pointsMat, linesMat, dieMat]);

  const aspect = size.width / size.height;
  const portrait = aspect < 0.9;
  // Composition per shape: tall phones get a smaller chip pushed up behind
  // the title; short landscape phones a lower, wider one; ultrawide stays
  // centred instead of growing without bound.
  const shortLandscape = aspect > 1.6 && size.height < 520;
  const fit = portrait ? clamp(aspect * 1.18, 0.5, 1) : shortLandscape ? 0.78 : clamp(aspect / 1.7, 0.7, 1.05);

  useFrame((state, dtRaw) => {
    const dt = Math.min(dtRaw, 0.05);
    const u = uniforms;
    u.uTime.value += dt * (reduced ? 0.35 : 1);

    // Intro assembly is driven by the Hero's wall clock (see Hero.tsx); ease
    // toward it so a late-mounting canvas doesn't pop.
    u.uIntro.value = u.uIntro.value < scrollState.intro ? Math.min(scrollState.intro, u.uIntro.value + Math.max(dt / Math.max(introSeconds, 0.5), (scrollState.intro - u.uIntro.value) * 0.2)) : scrollState.intro;

    const pt = scrollState.pointer;
    if (coarse || reduced) {
      const t = u.uTime.value;
      pt.tx = Math.sin(t * 0.35) * 0.55;
      pt.ty = Math.cos(t * 0.27) * 0.35;
    }
    pt.x = lerp(pt.x, pt.tx, 1 - Math.exp(-dt * 4));
    pt.y = lerp(pt.y, pt.ty, 1 - Math.exp(-dt * 4));

    const h = scrollState.hero;
    const g = group.current;
    if (!g) return;
    const tiltBase = lerp(-0.95, -0.08, smooth(0, 1, h));
    const m = reduced ? 0.4 : 1;
    g.rotation.x = tiltBase + pt.y * 0.07 * m;
    g.rotation.z = pt.x * -0.1 * m + h * 0.5;
    g.rotation.y = pt.x * 0.08 * m;
    g.position.y = lerp(portrait ? 1.2 : 0.2, 0, h);
    g.scale.setScalar(fit * lerp(1, 1.55, smooth(0, 1, h)));
    u.uFade.value = 1 - smooth(0.55, 1, h);
    u.uPx.value = state.gl.getPixelRatio();

    state.camera.position.z = lerp(portrait ? 15 : 12, portrait ? 11 : 8.5, smooth(0, 1, h));
    state.camera.position.x = pt.x * 0.35;
    state.camera.lookAt(0, 0, 0);

    // Pointer projected onto the chip plane (in the group's local space).
    g.updateMatrixWorld();
    _n.set(0, 0, 1).transformDirection(g.matrixWorld);
    g.getWorldPosition(_p);
    _plane.setFromNormalAndCoplanarPoint(_n, _p);
    _ray.setFromCamera(_v2.set(pt.x, pt.y), state.camera);
    if (_ray.ray.intersectPlane(_plane, _hit)) {
      g.worldToLocal(_hit);
      u.uPointer.value.copy(_hit);
      u.uPointerStrength.value = lerp(u.uPointerStrength.value, 1, 1 - Math.exp(-dt * 3));
    }
  });

  return (
    <group ref={group}>
      <mesh position={[0, 0, -0.04]} renderOrder={0}>
        <planeGeometry args={[26, 20]} />
        <primitive object={dieMat} attach="material" />
      </mesh>
      <lineSegments frustumCulled={false} renderOrder={1}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[data.linePos, 3]} />
          <bufferAttribute attach="attributes-aProg" args={[data.lineProg, 1]} />
          <bufferAttribute attach="attributes-aSeed" args={[data.lineSeed, 1]} />
          <bufferAttribute attach="attributes-aTone" args={[data.lineTone, 1]} />
          <bufferAttribute attach="attributes-aDelay" args={[data.lineDelay, 1]} />
        </bufferGeometry>
        <primitive object={linesMat} attach="material" />
      </lineSegments>
      <points frustumCulled={false} renderOrder={2}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[data.pos, 3]} />
          <bufferAttribute attach="attributes-aStart" args={[data.start, 3]} />
          <bufferAttribute attach="attributes-aDelay" args={[data.delay, 1]} />
          <bufferAttribute attach="attributes-aSize" args={[data.size, 1]} />
          <bufferAttribute attach="attributes-aTone" args={[data.tone, 1]} />
          <bufferAttribute attach="attributes-aSeed" args={[data.seed, 1]} />
        </bufferGeometry>
        <primitive object={pointsMat} attach="material" />
      </points>
    </group>
  );
}
