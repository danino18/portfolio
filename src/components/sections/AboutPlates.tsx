/** Procedural illustrations for each layer of the hardware→software stack. */

const stroke = "currentColor";

function Gate({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} fill="none" stroke={stroke} strokeWidth="1.2">
      <path d="M0 0 H8 A9 9 0 0 1 8 18 H0 Z" />
      <path d="M-8 4 H0 M-8 14 H0 M17 9 H25" />
      <circle cx="20" cy="9" r="0" />
    </g>
  );
}

export function PlateSilicon() {
  return (
    <svg viewBox="0 0 200 200" className="h-full w-full">
      <g opacity="0.9">
        {[0, 1, 2, 3].map((r) =>
          [0, 1, 2].map((c) => <Gate key={`${r}${c}`} x={22 + c * 58} y={22 + r * 44} />)
        )}
      </g>
      <g stroke={stroke} strokeWidth="0.8" fill="none" strokeDasharray="3 5" opacity="0.7">
        {[0, 1, 2, 3].map((r) => (
          <path key={r} d={`M47 ${31 + r * 44} H64 M105 ${31 + r * 44} H122`} style={{ animation: `dash-flow ${1.4 + r * 0.3}s linear infinite` }} />
        ))}
      </g>
    </svg>
  );
}

export function PlateArch() {
  const stages = ["IF", "ID", "EX", "MEM", "WB"];
  return (
    <svg viewBox="0 0 200 200" className="h-full w-full" fill="none" stroke={stroke} strokeWidth="1.1">
      {stages.map((s, i) => (
        <g key={s}>
          <rect x={10 + i * 36} y="38" width="30" height="34" rx="3" />
          <text x={25 + i * 36} y="59" textAnchor="middle" fontSize="9" fill={stroke} stroke="none" fontFamily="monospace">
            {s}
          </text>
          {i < 4 && <path d={`M${40 + i * 36} 55 h6`} strokeDasharray="2 2" />}
        </g>
      ))}
      {[0, 1, 2].map((i) => (
        <rect key={i} x={14 + i * 58} y={100 + i * 6} width={50 - i * 4} height={20 + i * 8} rx="3" opacity={1 - i * 0.2} />
      ))}
      <path d="M10 160 H190 M10 172 H150 M10 184 H110" strokeDasharray="1 4" strokeLinecap="round" />
    </svg>
  );
}

export function PlateParallel() {
  const dots = Array.from({ length: 144 }, (_, i) => i);
  return (
    <svg viewBox="0 0 200 200" className="h-full w-full" fill={stroke}>
      {dots.map((i) => {
        const x = 14 + (i % 12) * 15.5;
        const y = 14 + Math.floor(i / 12) * 15.5;
        const warp = Math.floor(i / 12) % 4;
        return <rect key={i} x={x} y={y} width="8" height="8" rx="1.5" opacity="0.8" style={{ animation: `pulse-dot ${2 + warp * 0.35}s ${(i % 12) * 0.08}s ease-in-out infinite` }} />;
      })}
    </svg>
  );
}

export function PlateSystems() {
  return (
    <svg viewBox="0 0 200 200" className="h-full w-full" fill="none" stroke={stroke} strokeWidth="1.2" strokeLinecap="round">
      <path d="M44 56 L20 100 L44 144 M156 56 L180 100 L156 144" strokeWidth="2" />
      <path d="M70 70 h48 M70 86 h72 M80 102 h40 M80 118 h66 M70 134 h30" opacity="0.85" />
      <path d="M100 54 L90 150" opacity="0.5" />
    </svg>
  );
}

export function PlateIntel() {
  return (
    <svg viewBox="0 0 200 200" className="h-full w-full" fill="none" stroke={stroke} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M30 170 H80" strokeWidth="3" />
      <path d="M55 170 V140 L110 96 L148 118" />
      <circle cx="55" cy="140" r="5" />
      <circle cx="110" cy="96" r="5" />
      <path d="M148 118 l10 -8 m-10 8 l10 8" />
      <path d="M150 40 l20 28 H130 Z" opacity="0.55" strokeDasharray="3 3" />
      <circle cx="150" cy="38" r="5" />
      <g opacity="0.7">
        <circle cx="38" cy="50" r="4" /> <circle cx="38" cy="76" r="4" /> <circle cx="72" cy="40" r="4" /> <circle cx="72" cy="66" r="4" /> <circle cx="72" cy="92" r="4" />
        <path d="M42 50 L68 40 M42 50 L68 66 M42 76 L68 66 M42 76 L68 92 M42 76 L68 40" />
      </g>
    </svg>
  );
}

export function PlateProduct() {
  return (
    <svg viewBox="0 0 200 200" className="h-full w-full" fill="none" stroke={stroke} strokeWidth="1.2">
      <rect x="16" y="26" width="168" height="148" rx="8" />
      <path d="M16 48 H184" />
      <circle cx="30" cy="37" r="3" fill={stroke} stroke="none" />
      <circle cx="42" cy="37" r="3" opacity="0.6" />
      <circle cx="54" cy="37" r="3" opacity="0.4" />
      <rect x="28" y="62" width="50" height="40" rx="4" />
      <rect x="86" y="62" width="50" height="40" rx="4" opacity="0.7" />
      <rect x="144" y="62" width="30" height="40" rx="4" opacity="0.45" />
      <path d="M28 120 H172 M28 134 H140 M28 148 H112" strokeLinecap="round" opacity="0.7" />
    </svg>
  );
}

export const plates = [PlateSilicon, PlateArch, PlateParallel, PlateSystems, PlateIntel, PlateProduct];
