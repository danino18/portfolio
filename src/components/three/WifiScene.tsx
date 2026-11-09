"use client";

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { mulberry32, clamp, lerp } from "@/lib/rng";
import { scrollState } from "@/lib/scrollState";
import { scaleByTier, useQuality } from "@/lib/quality";
import { ROOM, RX, TX, type WifiSim } from "@/lib/wifiSim";

const MAG = new THREE.Color("#ff6bd6");
const ICE = new THREE.Color("#7fe8ff");
const SHELLS = 3;
const WAVE_SPEED = 1.7; // scene units per second (slowed-down "light")
const WAVE_RANGE = 9;

/* ------------------------------------------------------------------ body */
interface Part {
  pivot: [number, number, number];
  a: [number, number, number];
  b: [number, number, number];
  r: number;
  swing: number; // -1 / +1 limb phase, 0 = rigid
}
const PARTS: Part[] = [
  { pivot: [0, 0, 0], a: [0, 1.6, 0], b: [0, 1.7, 0], r: 0.11, swing: 0 }, // head
  { pivot: [0, 0, 0], a: [0, 0.98, 0], b: [0, 1.42, 0], r: 0.16, swing: 0 }, // torso
  { pivot: [0.1, 0.92, 0], a: [0, 0, 0], b: [0, -0.88, 0], r: 0.065, swing: 1 }, // legs
  { pivot: [-0.1, 0.92, 0], a: [0, 0, 0], b: [0, -0.88, 0], r: 0.065, swing: -1 },
  { pivot: [0.23, 1.4, 0], a: [0, 0, 0], b: [0, -0.62, 0], r: 0.048, swing: -0.8 }, // arms
  { pivot: [-0.23, 1.4, 0], a: [0, 0, 0], b: [0, -0.62, 0], r: 0.048, swing: 0.8 },
];

function sampleBody(n: number) {
  const rng = mulberry32(4);
  const weights = PARTS.map((p) => Math.hypot(p.b[0] - p.a[0], p.b[1] - p.a[1], p.b[2] - p.a[2]) * p.r + (p.swing === 0 && p.r > 0.1 ? 0.03 : 0));
  const sum = weights.reduce((a, b) => a + b, 0);
  const part = new Uint8Array(n);
  const local = new Float32Array(n * 3);
  let i = 0;
  PARTS.forEach((p, pi) => {
    const m = pi === PARTS.length - 1 ? n - i : Math.round((weights[pi] / sum) * n);
    for (let k = 0; k < m && i < n; k++, i++) {
      const t = rng();
      const th = rng() * Math.PI * 2;
      const rr = p.r * (0.85 + rng() * 0.15);
      // head is a sphere, the rest capsules around a vertical axis
      let x: number, y: number, z: number;
      if (pi === 0) {
        const ph = Math.acos(2 * rng() - 1);
        x = Math.sin(ph) * Math.cos(th) * 0.1;
        y = 1.66 + Math.cos(ph) * 0.12;
        z = Math.sin(ph) * Math.sin(th) * 0.11;
      } else {
        x = lerp(p.a[0], p.b[0], t) + Math.cos(th) * rr * (pi === 1 ? 1.25 : 1);
        y = lerp(p.a[1], p.b[1], t);
        z = lerp(p.a[2], p.b[2], t) + Math.sin(th) * rr * (pi === 1 ? 0.7 : 1);
      }
      part[i] = pi;
      local[i * 3] = x;
      local[i * 3 + 1] = y;
      local[i * 3 + 2] = z;
    }
  });
  // Shuffle so any prefix is an even sample of the whole body (used by the sparser ghost).
  for (let j = n - 1; j > 0; j--) {
    const k = Math.floor(rng() * (j + 1));
    const tp = part[j];
    part[j] = part[k];
    part[k] = tp;
    for (let c = 0; c < 3; c++) {
      const tv = local[j * 3 + c];
      local[j * 3 + c] = local[k * 3 + c];
      local[k * 3 + c] = tv;
    }
  }
  return { part, local, count: n };
}

/* --------------------------------------------------------------- shaders */
const floorVert = /* glsl */ `
  varying vec2 vP;
  void main(){ vec4 w = modelMatrix * vec4(position,1.0); vP = w.xz; gl_Position = projectionMatrix * viewMatrix * w; }
`;
const floorFrag = /* glsl */ `
  uniform vec2 uTx; uniform vec2 uPerson; uniform float uR[${SHELLS}]; uniform float uTime; uniform vec3 uA; uniform vec3 uB; uniform float uRange;
  varying vec2 vP;
  void main(){
    vec2 g = abs(fract(vP * 2.0) - 0.5);
    float grid = smoothstep(0.47, 0.5, max(g.x, g.y)) * 0.12;
    float dT = distance(vP, uTx);
    float dPT = distance(uPerson, uTx);
    float dP = distance(vP, uPerson);
    // shadow cast behind the person, as seen from the transmitter
    vec2 dir = normalize(uPerson - uTx);
    float along = dot(vP - uTx, dir);
    float across = abs(dot(vP - uTx, vec2(-dir.y, dir.x)));
    float shadow = step(dPT + 0.25, along) * smoothstep(0.55, 0.15, across * dPT / max(along, 0.001));
    float rings = 0.0; float scatter = 0.0;
    for (int i = 0; i < ${SHELLS}; i++) {
      float R = uR[i]; float fade = 1.0 - R / uRange;
      rings += exp(-pow(dT - R, 2.0) * 26.0) * fade;
      float r2 = R - dPT;
      if (r2 > 0.0) scatter += exp(-pow(dP - r2, 2.0) * 30.0) * fade * exp(-r2 * 0.35);
    }
    rings *= (1.0 - 0.8 * shadow);
    float ripple = (0.5 + 0.5 * sin(dT * 9.0 - uTime * 4.0)) * exp(-dT * 0.35) * 0.05;
    vec3 col = uB * (rings * 0.55 + ripple) + uA * scatter * 0.9 + vec3(0.6, 0.7, 0.9) * grid;
    col += uA * exp(-dP * dP * 3.0) * 0.12;
    float edge = smoothstep(0.0, 0.25, min(min(vP.x + ${(ROOM.w / 2).toFixed(2)}, ${(ROOM.w / 2).toFixed(2)} - vP.x), min(vP.y + ${(ROOM.d / 2).toFixed(2)}, ${(ROOM.d / 2).toFixed(2)} - vP.y)));
    gl_FragColor = vec4(col, (0.35 + rings * 0.5 + scatter) * edge);
  }
`;

const shellVert = /* glsl */ `
  varying vec3 vN; varying vec3 vW; varying vec3 vV;
  void main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; vN = normalize(mat3(modelMatrix) * normal); vV = normalize(cameraPosition - w.xyz); gl_Position = projectionMatrix * viewMatrix * w; }
`;
const shellFrag = /* glsl */ `
  uniform vec3 uColor; uniform float uOpacity; uniform vec3 uHalf;
  varying vec3 vN; varying vec3 vW; varying vec3 vV;
  void main(){
    if (abs(vW.x) > uHalf.x || abs(vW.z) > uHalf.z || vW.y < 0.0 || vW.y > uHalf.y) discard;
    float rim = pow(1.0 - abs(dot(vN, vV)), 2.2);
    float bands = 0.75 + 0.25 * sin(vW.y * 18.0);
    gl_FragColor = vec4(uColor * (0.4 + rim * 1.4) * bands, (0.05 + rim * 0.55) * uOpacity);
  }
`;

const bodyVert = /* glsl */ `
  uniform vec3 uTx; uniform float uR[${SHELLS}]; uniform float uPx; uniform float uRange; uniform float uSize;
  varying float vGlow;
  void main(){
    vec4 w = modelMatrix * vec4(position, 1.0);
    float d = distance(w.xyz, uTx);
    float g = 0.0;
    for (int i = 0; i < ${SHELLS}; i++) g += exp(-pow(d - uR[i], 2.0) * 40.0) * (1.0 - uR[i] / uRange);
    vGlow = g;
    vec4 mv = viewMatrix * w;
    gl_Position = projectionMatrix * mv;
    gl_PointSize = uSize * uPx * (1.0 + g * 1.4) * (9.0 / -mv.z);
  }
`;
const bodyFrag = /* glsl */ `
  uniform vec3 uColor; uniform float uAlpha;
  varying float vGlow;
  void main(){
    float d = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.0, d);
    gl_FragColor = vec4(uColor * (0.75 + vGlow * 1.6) + vec3(vGlow * 0.6), a * uAlpha * (0.55 + vGlow));
  }
`;

const rayVert = /* glsl */ `
  attribute float aProg; attribute float aLink; varying float vProg; varying float vLink;
  void main(){ vProg = aProg; vLink = aLink; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }
`;
const rayFrag = /* glsl */ `
  uniform float uTime; uniform float uInf[3]; uniform vec3 uA; uniform vec3 uB;
  varying float vProg; varying float vLink;
  void main(){
    int li = int(vLink + 0.5);
    float inf = li == 0 ? uInf[0] : li == 1 ? uInf[1] : uInf[2];
    float head = pow(fract(vProg - uTime * 0.7), 12.0);
    vec3 c = mix(uB, uA, step(0.5, vProg));
    gl_FragColor = vec4(c * (0.7 + head * 2.0), (0.12 + inf * 0.5) + head * (0.5 + inf));
  }
`;

/* ----------------------------------------------------------------- scene */
export default function WifiScene({ sim, insetRight = 0 }: { sim: WifiSim; insetRight?: number }) {
  const q = useQuality();
  const tier = q?.tier ?? 2;
  const reduced = q?.reducedMotion ?? false;
  const { size } = useThree();
  const n = scaleByTier(2600, tier);
  const body = useMemo(() => sampleBody(n), [n]);
  const bodyPos = useMemo(() => new Float32Array(n * 3), [n]);
  const ghostN = Math.max(200, Math.floor(n * 0.35));
  const bodyGeo = useRef<THREE.BufferGeometry>(null);
  const ghostGeo = useRef<THREE.BufferGeometry>(null);
  const personG = useRef<THREE.Group>(null);
  const ghostG = useRef<THREE.Group>(null);
  const estRing = useRef<THREE.Group>(null);
  const raysGeo = useRef<THREE.BufferGeometry>(null);
  const shells = useRef<(THREE.Mesh | null)[]>([]);
  const time = useRef(0);

  const R = useMemo(() => Array.from({ length: SHELLS }, (_, i) => (i * WAVE_RANGE) / SHELLS), []);
  const uniforms = useMemo(
    () => ({
      floor: { uTx: { value: new THREE.Vector2(TX.x, TX.z) }, uPerson: { value: new THREE.Vector2() }, uR: { value: R }, uTime: { value: 0 }, uA: { value: MAG }, uB: { value: ICE }, uRange: { value: WAVE_RANGE } },
      body: { uTx: { value: new THREE.Vector3(TX.x, TX.y, TX.z) }, uR: { value: R }, uPx: { value: 1 }, uRange: { value: WAVE_RANGE }, uSize: { value: tier >= 3 ? 2 : 2.4 }, uColor: { value: MAG }, uAlpha: { value: 1 } },
      ghost: { uTx: { value: new THREE.Vector3(TX.x, TX.y, TX.z) }, uR: { value: R }, uPx: { value: 1 }, uRange: { value: WAVE_RANGE }, uSize: { value: 2.2 }, uColor: { value: ICE }, uAlpha: { value: 0.4 } },
      rays: { uTime: { value: 0 }, uInf: { value: [0, 0, 0] }, uA: { value: MAG }, uB: { value: ICE } },
    }),
    [R, tier],
  );

  const mats = useMemo(() => {
    const add = { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending } as const;
    return {
      floor: new THREE.ShaderMaterial({ uniforms: uniforms.floor, vertexShader: floorVert, fragmentShader: floorFrag, ...add }),
      shells: Array.from(
        { length: SHELLS },
        () =>
          new THREE.ShaderMaterial({
            uniforms: { uColor: { value: ICE }, uOpacity: { value: 1 }, uHalf: { value: new THREE.Vector3(ROOM.w / 2, ROOM.h, ROOM.d / 2) } },
            vertexShader: shellVert,
            fragmentShader: shellFrag,
            side: THREE.DoubleSide,
            ...add,
          }),
      ),
      body: new THREE.ShaderMaterial({ uniforms: uniforms.body, vertexShader: bodyVert, fragmentShader: bodyFrag, ...add }),
      ghost: new THREE.ShaderMaterial({ uniforms: uniforms.ghost, vertexShader: bodyVert, fragmentShader: bodyFrag, ...add }),
      rays: new THREE.ShaderMaterial({ uniforms: uniforms.rays, vertexShader: rayVert, fragmentShader: rayFrag, ...add }),
    };
  }, [uniforms]);

  useEffect(
    () => () => {
      mats.floor.dispose();
      mats.shells.forEach((m) => m.dispose());
      mats.body.dispose();
      mats.ghost.dispose();
      mats.rays.dispose();
    },
    [mats],
  );

  // Rays: TX → person → RX_i (two segments per link) with progress 0..1 along the path.
  const rays = useMemo(() => {
    const P = new Float32Array(RX.length * 4 * 3);
    const G = new Float32Array(RX.length * 4);
    const L = new Float32Array(RX.length * 4);
    for (let i = 0; i < RX.length; i++) {
      G.set([0, 0.5, 0.5, 1], i * 4);
      L.set([i, i, i, i], i * 4);
    }
    return { P, G, L };
  }, []);

  const roomEdges = useMemo(() => new THREE.EdgesGeometry(new THREE.BoxGeometry(ROOM.w, ROOM.h, ROOM.d)), []);
  useEffect(() => () => roomEdges.dispose(), [roomEdges]);

  const aspect = size.width / size.height;

  useFrame((state, dtRaw) => {
    const dt = Math.min(dtRaw, 0.05) * (reduced ? 0.35 : 1);
    time.current += dt;
    const t = time.current;
    const p = sim.person;

    // wave shells
    for (let i = 0; i < SHELLS; i++) {
      R[i] = (t * WAVE_SPEED + (i * WAVE_RANGE) / SHELLS) % WAVE_RANGE;
      const s = shells.current[i];
      if (s) {
        s.scale.setScalar(Math.max(0.01, R[i]));
        (s.material as THREE.ShaderMaterial).uniforms.uOpacity.value = Math.pow(1 - R[i] / WAVE_RANGE, 1.4);
      }
    }
    uniforms.floor.uTime.value = t;
    uniforms.floor.uPerson.value.set(p.x, p.z);
    uniforms.rays.uTime.value = t;
    sim.influence.forEach((v, i) => (uniforms.rays.uInf.value[i] = v));
    uniforms.body.uPx.value = uniforms.ghost.uPx.value = state.gl.getPixelRatio();

    // body pose (CPU skinning of six rigid parts; cheap for a few thousand points)
    const swing = Math.sin(sim.walkPhase) * clamp(sim.speed * 0.9, 0, 0.55);
    const { part, local } = body;
    for (let i = 0; i < body.count; i++) {
      const pr = PARTS[part[i]];
      let x = local[i * 3];
      let y = local[i * 3 + 1];
      let z = local[i * 3 + 2];
      if (pr.swing !== 0) {
        const a = swing * pr.swing;
        const c = Math.cos(a);
        const s = Math.sin(a);
        const yy = y * c - z * s;
        const zz = y * s + z * c;
        x += pr.pivot[0];
        y = yy + pr.pivot[1];
        z = zz + pr.pivot[2];
      }
      bodyPos[i * 3] = x;
      bodyPos[i * 3 + 1] = y + Math.abs(Math.sin(sim.walkPhase)) * 0.025 * clamp(sim.speed, 0, 1);
      bodyPos[i * 3 + 2] = z;
    }
    const bg = bodyGeo.current;
    if (bg) (bg.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    const gg = ghostGeo.current;
    if (gg) (gg.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    if (personG.current) {
      personG.current.position.set(p.x, 0, p.z);
      personG.current.rotation.y = sim.heading;
    }
    if (ghostG.current) {
      ghostG.current.position.set(sim.est.x, 0, sim.est.z);
      ghostG.current.rotation.y = sim.heading;
    }
    if (estRing.current) {
      estRing.current.position.set(sim.est.x, 0.02, sim.est.z);
      estRing.current.scale.setScalar(sim.estSigma);
    }

    // rays
    const rg = raysGeo.current;
    if (rg) {
      const P = rays.P;
      RX.forEach((rx, i) => {
        P.set([TX.x, TX.y, TX.z, p.x, 1.2, p.z, p.x, 1.2, p.z, rx.x, rx.y, rx.z], i * 12);
      });
      (rg.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    }

    // camera: frame the whole room for any aspect, drift with the pointer
    const pt = scrollState.pointer;
    const m = reduced ? 0.3 : 1;
    const cam = state.camera as THREE.PerspectiveCamera;
    // A HUD covers the right edge on wide screens: shift the projection centre
    // into the visible area (square pixels: the full frustum is W+inset wide).
    const inset = insetRight > 0 && size.width - insetRight > 320 ? insetRight : 0;
    const visAspect = (size.width - inset) / size.height;
    if (inset) {
      cam.aspect = (size.width + inset) / size.height;
      cam.setViewOffset(size.width + inset, size.height, inset, 0, size.width, size.height);
    } else if (cam.view) {
      cam.clearViewOffset();
      cam.aspect = aspect;
    }
    cam.updateProjectionMatrix();
    const fov = (cam.fov * Math.PI) / 180;
    const fitW = (ROOM.w * 0.62) / (Math.tan(fov / 2) * Math.max(visAspect, 0.4));
    const fitH = (ROOM.d * 0.8) / Math.tan(fov / 2);
    const dist = clamp(Math.max(fitW, fitH), 7, 22);
    const az = 0.32 * Math.sin(t * 0.05) * m + pt.x * 0.25 * m;
    const el = visAspect < 0.9 ? 0.95 : 0.72;
    state.camera.position.set(Math.sin(az) * Math.cos(el) * dist, Math.sin(el) * dist + pt.y * 0.4 * m, Math.cos(az) * Math.cos(el) * dist);
    state.camera.lookAt(0, visAspect < 0.9 ? 0.2 : 0.55, 0.3);
  });

  return (
    <group>
      {/* floor with interference rings */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} renderOrder={0}>
        <planeGeometry args={[ROOM.w, ROOM.d]} />
        <primitive object={mats.floor} attach="material" />
      </mesh>

      {/* room outline */}
      <lineSegments geometry={roomEdges} position={[0, ROOM.h / 2, 0]}>
        <lineBasicMaterial color="#8d96ab" transparent opacity={0.22} />
      </lineSegments>

      {/* ESP32 nodes */}
      {[{ ...TX, name: "TX" }, ...RX].map((d, i) => (
        <group key={d.name} position={[d.x, d.y, d.z]}>
          <mesh>
            <boxGeometry args={[0.32, 0.06, 0.2]} />
            <meshBasicMaterial color={i === 0 ? "#7fe8ff" : "#ff9be6"} />
          </mesh>
          <mesh position={[0.1, 0.13, 0]}>
            <cylinderGeometry args={[0.012, 0.012, 0.22, 6]} />
            <meshBasicMaterial color="#e9edf6" />
          </mesh>
          <mesh>
            <sphereGeometry args={[0.16, 12, 12]} />
            <meshBasicMaterial color={i === 0 ? ICE : MAG} transparent opacity={0.18} blending={THREE.AdditiveBlending} depthWrite={false} />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -d.y + 0.01, 0]}>
            <ringGeometry args={[0.18, 0.22, 32]} />
            <meshBasicMaterial color={i === 0 ? ICE : MAG} transparent opacity={0.6} />
          </mesh>
          <mesh position={[0, -d.y / 2, 0]}>
            <cylinderGeometry args={[0.006, 0.006, d.y, 4]} />
            <meshBasicMaterial color="#8d96ab" transparent opacity={0.35} />
          </mesh>
        </group>
      ))}

      {/* expanding wavefronts from the transmitter, clipped to the room */}
      {mats.shells.map((m, i) => (
        <mesh
          key={i}
          ref={(el) => {
            shells.current[i] = el;
          }}
          position={[TX.x, TX.y, TX.z]}
          renderOrder={2}
        >
          <sphereGeometry args={[1, tier >= 3 ? 48 : 32, tier >= 3 ? 32 : 20]} />
          <primitive object={m} attach="material" />
        </mesh>
      ))}

      {/* multipath rays */}
      <lineSegments frustumCulled={false} renderOrder={3}>
        <bufferGeometry ref={raysGeo}>
          <bufferAttribute attach="attributes-position" args={[rays.P, 3]} />
          <bufferAttribute attach="attributes-aProg" args={[rays.G, 1]} />
          <bufferAttribute attach="attributes-aLink" args={[rays.L, 1]} />
        </bufferGeometry>
        <primitive object={mats.rays} attach="material" />
      </lineSegments>

      {/* the person (ground truth of the simulation) */}
      <group ref={personG}>
        <points frustumCulled={false} renderOrder={4}>
          <bufferGeometry ref={bodyGeo}>
            <bufferAttribute attach="attributes-position" args={[bodyPos, 3]} />
          </bufferGeometry>
          <primitive object={mats.body} attach="material" />
        </points>
      </group>

      {/* model estimate: position + uncertainty, and a conceptual body-shape ghost */}
      <group ref={ghostG}>
        <points frustumCulled={false} renderOrder={5}>
          <bufferGeometry ref={ghostGeo} drawRange={{ start: 0, count: ghostN }}>
            <bufferAttribute attach="attributes-position" args={[bodyPos, 3]} />
          </bufferGeometry>
          <primitive object={mats.ghost} attach="material" />
        </points>
      </group>
      <group ref={estRing}>
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.92, 1, 64]} />
          <meshBasicMaterial color={ICE} transparent opacity={0.75} blending={THREE.AdditiveBlending} depthWrite={false} />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.9, 48]} />
          <meshBasicMaterial color={ICE} transparent opacity={0.07} blending={THREE.AdditiveBlending} depthWrite={false} />
        </mesh>
      </group>
    </group>
  );
}
