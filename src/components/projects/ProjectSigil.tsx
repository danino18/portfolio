import type { Project } from "@/content/projects";

/** Static, animated SVG identity mark for each project (server-renderable). */
export default function ProjectSigil({ project }: { project: Project }) {
  const a = project.accent.a;
  const b = project.accent.b;
  const flow = { strokeDasharray: "5 7", animation: "dash-flow 3s linear infinite" } as const;

  return (
    <svg viewBox="0 0 400 300" role="img" aria-label={`${project.title} emblem`} className="h-full w-full" fill="none" strokeLinecap="round" strokeLinejoin="round">
      {project.kind === "dart" && (
        <g strokeWidth="1.6">
          {[0, 1].map((s) => (
            <path key={s} stroke={s ? b : a} style={flow} d={`M10 150 ${Array.from({ length: 40 }, (_, i) => `L${10 + i * 9.8} ${150 + Math.sin(i * 0.42 + s * Math.PI) * 78}`).join(" ")}`} />
          ))}
          {Array.from({ length: 40 }, (_, i) => (
            <path key={i} stroke="#ffffff30" d={`M${10 + i * 9.8} ${150 + Math.sin(i * 0.42) * 78} V${150 + Math.sin(i * 0.42 + Math.PI) * 78}`} />
          ))}
        </g>
      )}
      {project.kind === "planner" && (
        <g strokeWidth="1.6">
          {[
            [60, 70, 170, 50],
            [60, 150, 170, 130],
            [60, 230, 170, 210],
            [170, 50, 290, 100],
            [170, 130, 290, 100],
            [170, 130, 290, 200],
            [170, 210, 290, 200],
            [290, 100, 360, 150],
            [290, 200, 360, 150],
          ].map(([x1, y1, x2, y2], i) => (
            <path key={i} stroke={i % 3 === 0 ? b : a} opacity=".7" style={flow} d={`M${x1} ${y1} C${(x1 + x2) / 2} ${y1} ${(x1 + x2) / 2} ${y2} ${x2} ${y2}`} />
          ))}
          {[
            [60, 70],
            [60, 150],
            [60, 230],
            [170, 50],
            [170, 130],
            [170, 210],
            [290, 100],
            [290, 200],
            [360, 150],
          ].map(([x, y], i) => (
            <rect key={i} x={x - 26} y={y - 12} width="52" height="24" rx="6" fill="#0a0c13" stroke={i % 2 ? b : a} />
          ))}
        </g>
      )}
      {project.kind === "maze" && (
        <g strokeWidth="3" stroke={a}>
          <path d="M40 40 H360 V260 H40 Z" opacity=".5" />
          <path d="M40 90 H200 M120 90 V160 M120 160 H280 M280 160 V90 M200 40 V90 M200 200 H360 M200 200 V260 M80 210 H140 M280 210 V260" />
          <rect x="52" y="52" width="24" height="24" fill={b} stroke="none" style={{ animation: "pulse-dot 1.4s infinite" }} />
          <rect x="324" y="224" width="24" height="24" fill="#ffcf4a" stroke="none" />
        </g>
      )}
      {project.kind === "arm" && (
        <g strokeWidth="14" stroke={b}>
          <path d="M40 260 H190" stroke="#1a2230" />
          <path d="M115 260 V220 L210 90 L300 170 V235" />
          {[
            [115, 220],
            [210, 90],
            [300, 170],
          ].map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r="14" fill={a} stroke="none" />
          ))}
          <path d="M282 240 h36" strokeWidth="6" />
          <rect x="262" y="256" width="36" height="30" rx="3" fill="#e4d9ff" stroke="none" />
          <rect x="298" y="226" width="36" height="30" rx="3" fill="#38e8ff" stroke="none" opacity=".8" />
        </g>
      )}
      {project.kind === "wifi" && (
        <g strokeWidth="1.6">
          {[1, 2, 3, 4].map((i) => (
            <path key={i} stroke={a} opacity={1 - i * 0.18} style={flow} d={`M${110 - i * 6} ${150 - i * 30} A ${i * 34} ${i * 34} 0 0 1 ${110 - i * 6} ${150 + i * 30}`} transform="rotate(180 110 150)" />
          ))}
          <rect x="96" y="142" width="22" height="16" rx="3" fill={b} stroke="none" />
          <circle cx="262" cy="118" r="11" stroke={a} />
          <path d="M262 130 V188 M262 146 l-20 18 M262 146 l20 18 M262 188 l-16 30 M262 188 l16 30" stroke={a} />
          <circle cx="262" cy="230" r="34" stroke={b} strokeDasharray="4 6" />
        </g>
      )}
      {project.kind === "reef" && (
        <g strokeWidth="1.6">
          <path d="M40 90 L200 150 L40 210" stroke="#ffffff30" />
          <path d="M360 90 L200 150 L360 210" stroke="#ffffff18" />
          {[0, 1, 2, 3, 4].map((i) => (
            <circle key={i} cx={70 + i * 65} cy={150} r={i === 4 ? 16 : 9} stroke={i === 4 ? a : b} fill={i === 4 ? a : "none"} opacity={0.5 + i * 0.12} />
          ))}
          <path d="M70 150 H330" stroke={b} style={flow} />
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <circle key={`p${i}`} cx={60 + i * 18} cy={70 + (i % 3) * 14} r="3" fill={a} stroke="none" opacity={0.6} />
          ))}
        </g>
      )}
    </svg>
  );
}
