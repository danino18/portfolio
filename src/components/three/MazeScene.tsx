"use client";

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import type { CoralGame } from "@/lib/coralGame";
import { scrollState } from "@/lib/scrollState";
import { clamp, lerp, mulberry32 } from "@/lib/rng";
import { useQuality } from "@/lib/quality";

const PHOS = new THREE.Color("#7dff9a");
const CYAN = new THREE.Color("#38e8ff");

/** Rounds the corners of an orthogonal polyline with short diagonal chamfers. */
function chamfer(pts: [number, number][], r = 0.12): [number, number][] {
  const out: [number, number][] = [pts[0]];
  for (let i = 1; i < pts.length - 1; i++) {
    const [px, pz] = pts[i - 1];
    const [cx, cz] = pts[i];
    const [nx, nz] = pts[i + 1];
    const a = Math.hypot(cx - px, cz - pz);
    const b = Math.hypot(nx - cx, nz - cz);
    const ra = Math.min(r, a / 2);
    const rb = Math.min(r, b / 2);
    out.push([cx - ((cx - px) / a) * ra, cz - ((cz - pz) / a) * ra]);
    out.push([cx + ((nx - cx) / b) * rb, cz + ((nz - cz) / b) * rb]);
  }
  out.push(pts[pts.length - 1]);
  return out;
}

function buildTraces() {
  const rng = mulberry32(5);
  const paths: [number, number][][] = [];
  // FPGA → VGA connector (display bus)
  for (let i = 0; i < 10; i++) {
    const sx = -4.55 + i * 0.16;
    const zl = 0.62 + i * 0.06;
    const tx = -0.7 + i * 0.155;
    paths.push(chamfer([[sx, 1.95], [sx, zl], [tx, zl], [tx, 0.55]]));
  }
  // PS/2 connector → FPGA (keyboard bus)
  for (let i = 0; i < 5; i++) {
    const z = 2.55 + i * 0.22;
    const zj = z + (i % 2 ? 0.12 : -0.12);
    paths.push(chamfer([[4.35, z + 0.12], [3.0, z + 0.12], [2.6, zj], [-2.1, zj]]));
  }
  const P: number[] = [];
  const G: number[] = [];
  const S: number[] = [];
  const K: number[] = [];
  paths.forEach((pts, pi) => {
    const lens = [0];
    for (let i = 1; i < pts.length; i++) lens.push(lens[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    const total = lens[lens.length - 1];
    const seed = rng();
    const kind = pi < 10 ? 0 : 1;
    for (let i = 0; i < pts.length - 1; i++) {
      P.push(pts[i][0], 0.012, pts[i][1], pts[i + 1][0], 0.012, pts[i + 1][1]);
      G.push(lens[i] / total, lens[i + 1] / total);
      S.push(seed, seed);
      K.push(kind, kind);
    }
  });
  return { P: new Float32Array(P), G: new Float32Array(G), S: new Float32Array(S), K: new Float32Array(K) };
}

const traceVert = /* glsl */ `
  attribute float aProg; attribute float aSeed; attribute float aKind;
  varying float vProg; varying float vSeed; varying float vKind;
  void main(){ vProg=aProg; vSeed=aSeed; vKind=aKind; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }
`;
const traceFrag = /* glsl */ `
  uniform float uTime; uniform float uBoost; uniform vec3 uA; uniform vec3 uB;
  varying float vProg; varying float vSeed; varying float vKind;
  void main(){
    float dir = vKind > 0.5 ? -1.0 : 1.0;
    float speed = 0.35 + vSeed * 0.3 + uBoost * 0.9;
    float f = fract(vProg * 0.9 * dir - uTime * speed + vSeed * 5.0);
    float head = pow(f, 10.0);
    vec3 c = mix(uA, uB, vKind);
    float a = 0.22 + head * (0.9 + uBoost * 1.5);
    gl_FragColor = vec4(c * (0.8 + head * 1.8), a);
  }
`;

const screenVert = /* glsl */ `
  varying vec2 vUv;
  void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;
const screenFrag = /* glsl */ `
  uniform sampler2D uMap; uniform float uTime; uniform float uFlash;
  varying vec2 vUv;
  void main(){
    vec2 cc = vUv - 0.5;
    float r2 = dot(cc, cc);
    vec2 uv = 0.5 + cc * (1.0 + 0.09 * r2);
    if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) { gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0); return; }
    vec3 col = texture2D(uMap, uv).rgb;
    vec2 px = vec2(1.0 / 640.0, 1.0 / 480.0) * 3.0;
    vec3 g = texture2D(uMap, uv + vec2(px.x, 0.0)).rgb + texture2D(uMap, uv - vec2(px.x, 0.0)).rgb
           + texture2D(uMap, uv + vec2(0.0, px.y)).rgb + texture2D(uMap, uv - vec2(0.0, px.y)).rgb;
    col = col * 0.92 + g * 0.06;
    float sl = 0.86 + 0.14 * sin(uv.y * 240.0 * 6.28318);
    col *= sl;
    col *= 1.0 - r2 * 1.5;
    col *= 0.97 + 0.03 * sin(uTime * 55.0);
    col += uFlash * vec3(0.35, 0.6, 0.45);
    gl_FragColor = vec4(col, 1.0);
  }
`;

const dieFrag = /* glsl */ `
  uniform float uTime; uniform vec3 uA; uniform vec3 uB;
  varying vec2 vUv;
  float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  void main(){
    vec2 g = vUv * 10.0; vec2 id = floor(g); vec2 f = fract(g);
    float edge = min(min(f.x, 1.0 - f.x), min(f.y, 1.0 - f.y));
    float line = smoothstep(0.08, 0.0, edge);
    float act = step(0.75, hash(id + floor(uTime * 1.2 + hash(id) * 7.0)));
    vec3 col = vec3(0.02, 0.04, 0.035) + uA * (line * 0.35 + act * 0.22) + uB * step(0.92, hash(id + 9.0)) * 0.12;
    float rim = smoothstep(0.04, 0.0, min(min(vUv.x, 1.0 - vUv.x), min(vUv.y, 1.0 - vUv.y)));
    gl_FragColor = vec4(col + uA * rim * 0.6, 1.0);
  }
`;

function gateShape(kind: "and" | "or" | "not") {
  const s = new THREE.Shape();
  if (kind === "and") {
    s.moveTo(-0.3, -0.25);
    s.lineTo(0.0, -0.25);
    s.absarc(0.0, 0.0, 0.25, -Math.PI / 2, Math.PI / 2, false);
    s.lineTo(-0.3, 0.25);
    s.closePath();
  } else if (kind === "or") {
    s.moveTo(-0.3, -0.25);
    s.quadraticCurveTo(0.2, -0.25, 0.32, 0);
    s.quadraticCurveTo(0.2, 0.25, -0.3, 0.25);
    s.quadraticCurveTo(-0.14, 0, -0.3, -0.25);
  } else {
    s.moveTo(-0.25, -0.25);
    s.lineTo(0.25, 0);
    s.lineTo(-0.25, 0.25);
    s.closePath();
  }
  return s;
}

function Gate({ kind, position, rotation = 0 }: { kind: "and" | "or" | "not"; position: [number, number, number]; rotation?: number }) {
  const { geo, edges } = useMemo(() => {
    const g = new THREE.ExtrudeGeometry(gateShape(kind), { depth: 0.08, bevelEnabled: false });
    return { geo: g, edges: new THREE.EdgesGeometry(g) };
  }, [kind]);
  const mat = useRef<THREE.LineBasicMaterial>(null);
  useFrame(({ clock }) => {
    if (mat.current) mat.current.opacity = 0.55 + 0.45 * Math.sin(clock.elapsedTime * 2.2 + position[0] * 2);
  });
  return (
    <group position={position} rotation={[-Math.PI / 2, 0, rotation]}>
      <mesh geometry={geo}>
        <meshBasicMaterial color="#06120c" />
      </mesh>
      <lineSegments geometry={edges}>
        <lineBasicMaterial ref={mat} color={PHOS} transparent />
      </lineSegments>
    </group>
  );
}

export default function MazeScene({ game }: { game: CoralGame }) {
  const q = useQuality();
  const reduced = q?.reducedMotion ?? false;
  const root = useRef<THREE.Group>(null);
  const { size } = useThree();
  const traces = useMemo(buildTraces, []);

  const tex = useMemo(() => {
    const t = new THREE.CanvasTexture(game.canvas);
    t.magFilter = THREE.NearestFilter;
    t.minFilter = THREE.LinearFilter;
    t.generateMipmaps = false;
    return t;
  }, [game]);

  const u = useMemo(
    () => ({
      trace: { uTime: { value: 0 }, uBoost: { value: 0 }, uA: { value: PHOS }, uB: { value: CYAN } },
      screen: { uMap: { value: tex }, uTime: { value: 0 }, uFlash: { value: 0 } },
      die: { uTime: { value: 0 }, uA: { value: PHOS }, uB: { value: CYAN } },
    }),
    [tex],
  );
  const traceMat = useMemo(
    () => new THREE.ShaderMaterial({ uniforms: u.trace, vertexShader: traceVert, fragmentShader: traceFrag, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }),
    [u],
  );
  const screenMat = useMemo(() => new THREE.ShaderMaterial({ uniforms: u.screen, vertexShader: screenVert, fragmentShader: screenFrag }), [u]);
  const dieMat = useMemo(() => new THREE.ShaderMaterial({ uniforms: u.die, vertexShader: screenVert, fragmentShader: dieFrag }), [u]);

  useEffect(
    () => () => {
      tex.dispose();
      traceMat.dispose();
      screenMat.dispose();
      dieMat.dispose();
    },
    [tex, traceMat, screenMat, dieMat],
  );

  const aspect = size.width / size.height;
  useFrame((state, dtRaw) => {
    const dt = Math.min(dtRaw, 0.05);
    const t = (u.trace.uTime.value += dt * (reduced ? 0.35 : 1));
    u.screen.uTime.value = t;
    u.die.uTime.value = t;
    // The game advances on real time (it is gameplay, not decoration).
    game.update(Math.min(dtRaw, 0.1));
    game.draw();
    tex.needsUpdate = true;

    const since = (performance.now() - game.lastInput) / 1000;
    const steer = game.mazeVy !== 0 ? 0.6 : 0;
    u.trace.uBoost.value = Math.max(steer, Math.exp(-since * 2.2) * (game.lastInput ? 1 : 0));
    u.screen.uFlash.value = game.state === "HIT" ? 0.35 + 0.35 * Math.sin(t * 30) : 0;

    // Framing: wide stages show the whole board; narrow/portrait stages
    // move in on the monitor so the game stays readable on phones.
    const pt = scrollState.pointer;
    const m = reduced ? 0.3 : 1;
    const tanHalf = Math.tan(((38 / 2) * Math.PI) / 180);
    let tx: number, ty: number, tz: number, el: number, d: number;
    if (aspect >= 1.15) {
      const need = 14.5;
      d = Math.max(9.5, need / (0.69 * Math.max(aspect, 0.3)));
      tx = 0;
      ty = 1.7;
      tz = 1.3;
      el = 0.5;
    } else {
      // fit the 6.5 × 5.1 monitor with a margin
      const dW = (6.5 * 0.5 * 1.12) / (tanHalf * aspect);
      const dH = (5.1 * 0.5 * 1.3) / tanHalf;
      d = Math.max(dW, dH);
      tx = 0;
      ty = 2.5;
      tz = -0.1;
      el = 0.16;
    }
    state.camera.position.set(tx + pt.x * 1.4 * m, ty + Math.sin(el) * d + pt.y * 0.5 * m, tz + Math.cos(el) * d);
    state.camera.lookAt(tx, ty, tz);
    if (root.current) root.current.rotation.y = lerp(root.current.rotation.y, pt.x * 0.06 * m, 0.05);
    void clamp;
  });

  return (
    <group ref={root}>
      <ambientLight intensity={0.9} />
      <pointLight position={[0, 6, 6]} intensity={60} color="#9dffb4" />
      <pointLight position={[-6, 3, 3]} intensity={25} color="#38e8ff" />

      {/* Board */}
      <mesh position={[0, -0.1, 1.8]}>
        <boxGeometry args={[15, 0.2, 7.2]} />
        <meshStandardMaterial color="#0b110f" roughness={0.75} metalness={0.3} />
      </mesh>
      <gridHelper args={[15, 30, "#143324", "#0d2118"]} position={[0, 0.002, 1.8]} scale={[1, 1, 0.48]} />

      {/* Signal traces */}
      <lineSegments frustumCulled={false}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[traces.P, 3]} />
          <bufferAttribute attach="attributes-aProg" args={[traces.G, 1]} />
          <bufferAttribute attach="attributes-aSeed" args={[traces.S, 1]} />
          <bufferAttribute attach="attributes-aKind" args={[traces.K, 1]} />
        </bufferGeometry>
        <primitive object={traceMat} attach="material" />
      </lineSegments>

      {/* FPGA package + die */}
      <mesh position={[-3.7, 0.24, 3.0]}>
        <boxGeometry args={[2.6, 0.48, 2.2]} />
        <meshStandardMaterial color="#10161a" roughness={0.4} metalness={0.7} />
      </mesh>
      <mesh position={[-3.7, 0.495, 3.0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[1.8, 1.5]} />
        <primitive object={dieMat} attach="material" />
      </mesh>

      {/* PS/2 connector */}
      <mesh position={[4.55, 0.3, 3.1]}>
        <boxGeometry args={[1.0, 0.6, 1.3]} />
        <meshStandardMaterial color="#1a1f24" roughness={0.5} metalness={0.8} />
      </mesh>
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <mesh key={i} position={[4.3, 0.62, 2.7 + (i % 3) * 0.35]} rotation={[0, 0, 0]}>
          <cylinderGeometry args={[0.07, 0.07, 0.06, 12]} />
          <meshBasicMaterial color={i === 0 ? CYAN : PHOS} />
        </mesh>
      ))}

      {/* VGA connector */}
      <mesh position={[0, 0.2, 0.28]}>
        <boxGeometry args={[1.9, 0.4, 0.55]} />
        <meshStandardMaterial color="#1a1f24" roughness={0.5} metalness={0.8} />
      </mesh>

      {/* Logic gates on the keyboard bus */}
      <Gate kind="and" position={[1.5, 0.03, 2.6]} />
      <Gate kind="or" position={[0.2, 0.03, 3.2]} />
      <Gate kind="not" position={[-1.2, 0.03, 2.7]} />
      <Gate kind="and" position={[-4.9, 0.03, 0.6]} rotation={Math.PI / 2} />

      {/* Monitor */}
      <group position={[0, 2.7, -0.3]}>
        <mesh>
          <boxGeometry args={[6.5, 5.1, 0.4]} />
          <meshStandardMaterial color="#0b0f12" roughness={0.35} metalness={0.8} />
        </mesh>
        <mesh position={[0, 0, 0.21]}>
          <planeGeometry args={[5.9, 4.425]} />
          <primitive object={screenMat} attach="material" />
        </mesh>
      </group>
      <mesh position={[0, 0.15, -0.3]}>
        <boxGeometry args={[2.4, 0.3, 1.2]} />
        <meshStandardMaterial color="#0b0f12" roughness={0.4} metalness={0.8} />
      </mesh>
    </group>
  );
}
