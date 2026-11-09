"use client";

import { isReducedMotion } from "@/lib/motion";
import { useEffect, useMemo, useRef, type MutableRefObject } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { clamp, lerp } from "@/lib/rng";
import { scrollState } from "@/lib/scrollState";
import { sfx } from "@/lib/sfx";

export interface ArmControl {
  manual: boolean;
  grip: boolean;
  height: number;
  perception: boolean;
  orbit: { az: number; pol: number };
  /** Joint angles in degrees, written by the scene each frame. */
  joints: number[];
  phase: string;
  restart: boolean;
  invalidate?: () => void;
}

// Dimensions: 1 metre = 3 scene units, proportions follow a UR5e.
const BASE_H = 0.22;
const D1 = 0.5;
const HS = BASE_H + D1;
const L1 = 1.275;
const L2 = 1.176;
const LT = 1.0;
const BS = 0.28;
const HB = BS / 2;
const TIP_TO_BLOCK = 0.06;

const STARTS: [number, number][] = [
  [1.35, 0.9],
  [1.95, 0.4],
  [1.45, -0.2],
];
const STACK: [number, number] = [1.75, -1.0];
const HOME = new THREE.Vector3(1.2, 1.35, 0.1);

interface Seg {
  to: THREE.Vector3;
  dur: number;
  grip: number;
  label: string;
  block: number;
  local: number;
}

function buildSequence(): Seg[] {
  const segs: Seg[] = [];
  STARTS.forEach(([bx, bz], k) => {
    const sy = 0.2 + k * BS;
    const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
    segs.push({ to: v(bx, 1.0, bz), dur: 1.2, grip: 1, label: "Approach block", block: k, local: 0 });
    segs.push({ to: v(bx, 0.2, bz), dur: 0.85, grip: 1, label: "Descend", block: k, local: 1 });
    segs.push({ to: v(bx, 0.2, bz), dur: 0.45, grip: 0, label: "Grasp", block: k, local: 2 });
    segs.push({ to: v(bx, 1.0, bz), dur: 0.75, grip: 0, label: "Lift", block: k, local: 3 });
    segs.push({ to: v(STACK[0], 1.15, STACK[1]), dur: 1.3, grip: 0, label: "Transfer to stack", block: k, local: 4 });
    segs.push({ to: v(STACK[0], sy, STACK[1]), dur: 0.9, grip: 0, label: "Lower onto stack", block: k, local: 5 });
    segs.push({ to: v(STACK[0], sy, STACK[1]), dur: 0.45, grip: 1, label: "Release", block: k, local: 6 });
    segs.push({ to: v(STACK[0], 1.1, STACK[1]), dur: 0.6, grip: 1, label: "Retreat", block: k, local: 7 });
  });
  return segs;
}

const ease = (t: number) => t * t * (3 - 2 * t);

/** Closed-form IK for a 3-link planar arm with a vertical tool (elbow up). */
function solveIK(tip: THREE.Vector3) {
  const q0 = Math.atan2(-tip.z, tip.x);
  const r = Math.hypot(tip.x, tip.z);
  const dx = r;
  const dy = tip.y + LT - HS;
  let D = Math.hypot(dx, dy);
  const maxD = L1 + L2 - 0.01;
  const minD = Math.abs(L1 - L2) + 0.05;
  let scale = 1;
  if (D > maxD) scale = maxD / D;
  if (D < minD) scale = minD / D;
  D *= scale;
  const cx = dx * scale;
  const cy = dy * scale;
  const cosE = clamp((L1 * L1 + L2 * L2 - D * D) / (2 * L1 * L2), -1, 1);
  const q2 = -(Math.PI - Math.acos(cosE));
  const cosS = clamp((L1 * L1 + D * D - L2 * L2) / (2 * L1 * D), -1, 1);
  const q1 = Math.atan2(cy, cx) + Math.acos(cosS);
  const q3 = -Math.PI / 2 - q1 - q2;
  return { q0, q1, q2, q3 };
}

const SKIN = "#aebdd3";
const DARK = "#1a2230";
const ORANGE = "#ff8a3d";

function LinkX({ len, r = 0.13, color = SKIN }: { len: number; r?: number; color?: string }) {
  return (
    <mesh position={[len / 2, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
      <cylinderGeometry args={[r, r, len, 28]} />
      <meshStandardMaterial color={color} roughness={0.35} metalness={0.55} />
    </mesh>
  );
}
function JointCap({ r = 0.19, len = 0.34, axis = "z" }: { r?: number; len?: number; axis?: "z" | "y" | "x" }) {
  const rot: [number, number, number] = axis === "z" ? [Math.PI / 2, 0, 0] : axis === "x" ? [0, 0, Math.PI / 2] : [0, 0, 0];
  return (
    <group>
      <mesh rotation={rot}>
        <cylinderGeometry args={[r, r, len, 32]} />
        <meshStandardMaterial color={DARK} roughness={0.4} metalness={0.7} />
      </mesh>
      <mesh rotation={rot}>
        <cylinderGeometry args={[r * 0.72, r * 0.72, len + 0.03, 32]} />
        <meshStandardMaterial color={ORANGE} roughness={0.5} metalness={0.3} emissive={ORANGE} emissiveIntensity={0.25} />
      </mesh>
    </group>
  );
}

export default function ArmScene({ ctl }: { ctl: MutableRefObject<ArmControl> }) {
  const { size, invalidate } = useThree();
  const seq = useMemo(buildSequence, []);
  const total = useMemo(() => seq.reduce((a, s) => a + s.dur, 0), [seq]);

  const pan = useRef<THREE.Group>(null);
  const sh = useRef<THREE.Group>(null);
  const el = useRef<THREE.Group>(null);
  const wr = useRef<THREE.Group>(null);
  const roll = useRef<THREE.Group>(null);
  const fL = useRef<THREE.Group>(null);
  const fR = useRef<THREE.Group>(null);
  const frustum = useRef<THREE.Group>(null);
  const blockRefs = [useRef<THREE.Mesh>(null), useRef<THREE.Mesh>(null), useRef<THREE.Mesh>(null)];
  const boxRefs = [useRef<THREE.Mesh>(null), useRef<THREE.Mesh>(null), useRef<THREE.Mesh>(null)];

  const st = useRef({
    t: 0,
    tip: HOME.clone(),
    grip: 1,
    wasManual: false,
    held: -1,
    blocks: STARTS.map(([x, z]) => new THREE.Vector3(x, HB, z)),
    lastLabel: "",
    camAz: 1.2,
    camPol: 1.12,
  });
  const reduced = useRef(false);

  useEffect(() => {
    reduced.current = isReducedMotion();
    ctl.current.invalidate = invalidate;
  }, [ctl, invalidate]);

  const plane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), []);
  const ray = useMemo(() => new THREE.Raycaster(), []);
  const hit = useMemo(() => new THREE.Vector3(), []);
  const v2 = useMemo(() => new THREE.Vector2(), []);

  const aspect = size.width / size.height;

  useFrame((state, dtRaw) => {
    const dt = Math.min(dtRaw, 0.05);
    const c = ctl.current;
    const s = st.current;

    if (c.restart) {
      c.restart = false;
      s.t = 0;
      s.held = -1;
      s.grip = 1;
      s.tip.copy(HOME);
      STARTS.forEach(([x, z], i) => s.blocks[i].set(x, HB, z));
    }

    if (c.manual) {
      if (!s.wasManual) {
        s.wasManual = true;
        // blocks stay where the demo left them
      }
      const pt = scrollState.pointer;
      ray.setFromCamera(v2.set(pt.x, pt.y), state.camera);
      plane.constant = -(0.2 + c.height * 1.1);
      if (ray.ray.intersectPlane(plane, hit)) {
        const r = clamp(Math.hypot(hit.x, hit.z), 1.1, 2.1);
        const a = Math.atan2(hit.z, hit.x);
        s.tip.x = lerp(s.tip.x, Math.cos(a) * r, 1 - Math.exp(-dt * 8));
        s.tip.z = lerp(s.tip.z, Math.sin(a) * r, 1 - Math.exp(-dt * 8));
        s.tip.y = lerp(s.tip.y, 0.2 + c.height * 1.1, 1 - Math.exp(-dt * 8));
      }
      const wantClosed = c.grip;
      s.grip = lerp(s.grip, wantClosed ? 0 : 1, 1 - Math.exp(-dt * 10));
      if (wantClosed && s.held < 0 && s.grip < 0.35) {
        let best = -1;
        let bd = 0.4;
        s.blocks.forEach((b, i) => {
          const d = Math.hypot(b.x - s.tip.x, b.z - s.tip.z) + Math.abs(b.y - (s.tip.y - TIP_TO_BLOCK)) * 0.8;
          if (d < bd) {
            bd = d;
            best = i;
          }
        });
        if (best >= 0) {
          s.held = best;
          sfx.click();
        }
      }
      if (!wantClosed && s.held >= 0) {
        const b = s.blocks[s.held];
        let y = HB;
        s.blocks.forEach((o, i) => {
          if (i !== s.held && Math.hypot(o.x - b.x, o.z - b.z) < 0.22 && o.y < b.y) y = Math.max(y, o.y + BS);
        });
        b.y = y;
        s.held = -1;
        sfx.success();
      }
      if (s.held >= 0) s.blocks[s.held].set(s.tip.x, s.tip.y - TIP_TO_BLOCK, s.tip.z);
      c.phase = s.held >= 0 ? "Holding block" : "Manual control";
    } else {
      if (s.wasManual) {
        s.wasManual = false;
        s.t = 0;
        s.held = -1;
        s.tip.copy(HOME);
        STARTS.forEach(([x, z], i) => s.blocks[i].set(x, HB, z));
      }
      // Reduced motion: the same task cycle, played calmly instead of frozen.
      s.t += dt * (reduced.current ? 0.4 : 1);
      const cycle = total + 2.2;
      const tt = s.t % cycle;
      if (s.t > cycle) s.t -= cycle;

      if (tt >= total) {
        // dwell with the stack finished, then re-seat the blocks for the next loop
        s.tip.lerp(HOME, 1 - Math.exp(-dt * 3));
        s.grip = lerp(s.grip, 1, 0.1);
        c.phase = "Stack complete";
        STARTS.forEach((_, i) => s.blocks[i].set(STACK[0], HB + i * BS, STACK[1]));
      } else {
        let acc = 0;
        let idx = 0;
        while (idx < seq.length - 1 && acc + seq[idx].dur <= tt) {
          acc += seq[idx].dur;
          idx++;
        }
        const seg = seq[idx];
        const from = idx === 0 ? HOME : seq[idx - 1].to;
        const prevGrip = idx === 0 ? 1 : seq[idx - 1].grip;
        const u = ease(clamp((tt - acc) / seg.dur));
        s.tip.lerpVectors(from, seg.to, u);
        s.grip = lerp(prevGrip, seg.grip, u);
        c.phase = seg.label;
        if (seg.label !== s.lastLabel) {
          s.lastLabel = seg.label;
        }
        // block states are a pure function of the sequence position
        seq.forEach((g, gi) => {
          if (g.local !== 0) return;
          const k = g.block;
          const holdStart = gi + 3;
          const holdEnd = gi + 5;
          const b = s.blocks[k];
          if (idx < holdStart) b.set(STARTS[k][0], HB, STARTS[k][1]);
          else if (idx <= holdEnd) b.set(s.tip.x, s.tip.y - TIP_TO_BLOCK, s.tip.z);
          else b.set(STACK[0], HB + k * BS, STACK[1]);
        });
        void seg;
      }
    }

    // Inverse kinematics → joint rotations
    const { q0, q1, q2, q3 } = solveIK(s.tip);
    if (pan.current) pan.current.rotation.y = q0;
    if (sh.current) sh.current.rotation.z = q1;
    if (el.current) el.current.rotation.z = q2;
    if (wr.current) wr.current.rotation.z = q3;
    const rollA = -q0;
    if (roll.current) roll.current.rotation.x = rollA;
    const open = 0.12 + s.grip * 0.2;
    if (fL.current) fL.current.position.z = open;
    if (fR.current) fR.current.position.z = -open;
    const deg = 180 / Math.PI;
    c.joints = [q0 * deg, q1 * deg, q2 * deg, q3 * deg, 90, rollA * deg];

    blockRefs.forEach((r, i) => r.current?.position.copy(s.blocks[i]));
    boxRefs.forEach((r, i) => {
      if (!r.current) return;
      r.current.position.copy(s.blocks[i]);
      r.current.visible = c.perception;
    });
    if (frustum.current) frustum.current.visible = c.perception;

    // Camera orbit (smoothed)
    s.camAz = lerp(s.camAz, c.orbit.az, 1 - Math.exp(-dt * 6));
    s.camPol = lerp(s.camPol, c.orbit.pol, 1 - Math.exp(-dt * 6));
    const pt = scrollState.pointer;
    const dist = clamp(8.4 / Math.min(1, aspect / 1.35), 8.4, 17);
    const az = s.camAz + (c.manual ? 0 : pt.x * 0.12);
    const pol = s.camPol + (c.manual ? 0 : pt.y * -0.05);
    const target = new THREE.Vector3(1.15, 0.8, 0.1);
    state.camera.position.set(
      target.x + dist * Math.sin(pol) * Math.cos(az),
      target.y + dist * Math.cos(pol),
      target.z + dist * Math.sin(pol) * Math.sin(az),
    );
    state.camera.lookAt(target);
  });

  const blockColors = ["#e4d9ff", "#38e8ff", "#ff8a3d"];

  return (
    <group>
      <hemisphereLight args={["#c4d4ff", "#0b0e16", 1.1]} />
      <directionalLight position={[4, 8, 3]} intensity={3.2} color="#ffffff" />
      <directionalLight position={[-5, 3, -4]} intensity={0.55} color="#ff8a3d" />
      <pointLight position={[1.5, 3, 1]} intensity={25} color="#38e8ff" />

      {/* Table */}
      <mesh position={[0.9, -0.06, 0]} rotation={[0, 0, 0]}>
        <cylinderGeometry args={[4.3, 4.4, 0.12, 96]} />
        <meshStandardMaterial color="#0a0e15" roughness={0.7} metalness={0.3} />
      </mesh>
      <gridHelper args={[8, 32, "#2a3548", "#161d2a"]} position={[0.9, 0.003, 0]} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[STACK[0], 0.006, STACK[1]]}>
        <ringGeometry args={[0.24, 0.27, 48]} />
        <meshBasicMaterial color={ORANGE} />
      </mesh>

      {/* Robot */}
      <mesh position={[0, BASE_H / 2, 0]}>
        <cylinderGeometry args={[0.46, 0.52, BASE_H, 48]} />
        <meshStandardMaterial color="#111722" roughness={0.4} metalness={0.8} />
      </mesh>
      <group ref={pan} position={[0, BASE_H, 0]}>
        <mesh position={[0, D1 / 2, 0]}>
          <cylinderGeometry args={[0.2, 0.22, D1, 36]} />
          <meshStandardMaterial color={SKIN} roughness={0.35} metalness={0.55} />
        </mesh>
        <group position={[0, D1, 0]}>
          <group position={[0, 0, 0]}>
            <JointCap />
            <group ref={sh}>
              <LinkX len={L1} />
              <group position={[L1, 0, 0]}>
                <JointCap />
                <group ref={el}>
                  <LinkX len={L2} r={0.115} />
                  <group position={[L2, 0, 0]}>
                    <JointCap r={0.16} len={0.3} />
                    <group ref={wr}>
                      <LinkX len={0.32} r={0.1} />
                      <group position={[0.32, 0, 0]}>
                        <JointCap r={0.14} len={0.28} axis="x" />
                        <group ref={roll}>
                          <LinkX len={0.3} r={0.085} color="#c7d2e6" />
                          {/* RealSense wrist camera */}
                          <mesh position={[0.28, 0, 0.17]}>
                            <boxGeometry args={[0.14, 0.09, 0.26]} />
                            <meshStandardMaterial color="#0e1118" roughness={0.3} metalness={0.8} />
                          </mesh>
                          <mesh position={[0.35, 0, 0.17]} rotation={[0, 0, Math.PI / 2]}>
                            <cylinderGeometry args={[0.03, 0.03, 0.02, 16]} />
                            <meshBasicMaterial color="#38e8ff" />
                          </mesh>
                          {/* RG6 gripper */}
                          <group position={[0.62, 0, 0]}>
                            <mesh>
                              <boxGeometry args={[0.28, 0.2, 0.62]} />
                              <meshStandardMaterial color="#222b3a" roughness={0.4} metalness={0.7} />
                            </mesh>
                            <mesh position={[0, 0.105, 0]}>
                              <boxGeometry args={[0.12, 0.01, 0.2]} />
                              <meshBasicMaterial color={ORANGE} />
                            </mesh>
                            <group ref={fL} position={[0.2, 0, 0.3]}>
                              <mesh position={[0.1, 0, 0]}>
                                <boxGeometry args={[0.3, 0.1, 0.05]} />
                                <meshStandardMaterial color="#6d7a90" roughness={0.5} metalness={0.8} />
                              </mesh>
                            </group>
                            <group ref={fR} position={[0.2, 0, -0.3]}>
                              <mesh position={[0.1, 0, 0]}>
                                <boxGeometry args={[0.3, 0.1, 0.05]} />
                                <meshStandardMaterial color="#6d7a90" roughness={0.5} metalness={0.8} />
                              </mesh>
                            </group>
                          </group>
                          {/* Camera frustum (perception overlay) */}
                          <group ref={frustum} visible={false} position={[0.3, 0, 0.17]}>
                            <lineSegments>
                              <bufferGeometry>
                                <bufferAttribute
                                  attach="attributes-position"
                                  args={[
                                    new Float32Array([
                                      0, 0, 0, 1.15, 0.55, 0.55, 0, 0, 0, 1.15, 0.55, -0.55, 0, 0, 0, 1.15, -0.55, 0.55, 0, 0, 0, 1.15, -0.55, -0.55, 1.15, 0.55, 0.55, 1.15, 0.55, -0.55, 1.15, 0.55, -0.55, 1.15,
                                      -0.55, -0.55, 1.15, -0.55, -0.55, 1.15, -0.55, 0.55, 1.15, -0.55, 0.55, 1.15, 0.55, 0.55,
                                    ]),
                                    3,
                                  ]}
                                />
                              </bufferGeometry>
                              <lineBasicMaterial color="#38e8ff" transparent opacity={0.55} />
                            </lineSegments>
                          </group>
                        </group>
                      </group>
                    </group>
                  </group>
                </group>
              </group>
            </group>
          </group>
        </group>
      </group>

      {/* Blocks + perception boxes */}
      {blockRefs.map((r, i) => (
        <mesh key={i} ref={r} position={[STARTS[i][0], HB, STARTS[i][1]]}>
          <boxGeometry args={[BS, BS, BS]} />
          <meshStandardMaterial color={blockColors[i]} roughness={0.45} metalness={0.2} emissive={blockColors[i]} emissiveIntensity={0.18} />
        </mesh>
      ))}
      {boxRefs.map((r, i) => (
        <mesh key={`b${i}`} ref={r} visible={false}>
          <boxGeometry args={[BS + 0.1, BS + 0.1, BS + 0.1]} />
          <meshBasicMaterial color="#38e8ff" wireframe transparent opacity={0.8} />
        </mesh>
      ))}
    </group>
  );
}
