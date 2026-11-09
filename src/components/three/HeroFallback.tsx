/**
 * Static/CSS hero visual used for low-end devices, reduced-motion with no
 * WebGL, or when the 3D scene fails. Pure SVG + CSS, no JS required.
 */
export default function HeroFallback() {
  const tiles = Array.from({ length: 64 }, (_, i) => i);
  return (
    <div aria-hidden className="absolute inset-0 overflow-hidden">
      <div className="grid-bg absolute inset-0 opacity-60 [mask-image:radial-gradient(60%_60%_at_50%_45%,#000,transparent)]" />
      <svg viewBox="0 0 400 400" className="absolute left-1/2 top-[44%] h-[min(78vh,120vw)] w-[min(78vh,120vw)] -translate-x-1/2 -translate-y-1/2">
        <defs>
          <linearGradient id="hf-g" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0" stopColor="#38e8ff" />
            <stop offset="1" stopColor="#8b5cff" />
          </linearGradient>
        </defs>
        {Array.from({ length: 12 }, (_, i) => {
          const o = 130 + i * 11;
          return (
            <g key={i} stroke="url(#hf-g)" strokeWidth="0.6" fill="none" opacity="0.55">
              <path d={`M${o} 118 V70 L${o + 14} 54 V10`} strokeDasharray="4 8" style={{ animation: `dash-flow ${2 + (i % 4) * 0.5}s linear infinite` }} />
              <path d={`M${o} 282 V330 L${o - 14} 346 V390`} strokeDasharray="4 8" style={{ animation: `dash-flow ${2.4 + (i % 3) * 0.5}s linear infinite` }} />
              <path d={`M118 ${o} H70 L54 ${o + 14} H10`} strokeDasharray="4 8" style={{ animation: `dash-flow ${2.2 + (i % 5) * 0.4}s linear infinite` }} />
              <path d={`M282 ${o} H330 L346 ${o - 14} H390`} strokeDasharray="4 8" style={{ animation: `dash-flow ${2.6 + (i % 4) * 0.4}s linear infinite` }} />
            </g>
          );
        })}
        <rect x="118" y="118" width="164" height="164" rx="6" fill="#0a0d16" stroke="url(#hf-g)" strokeWidth="1.2" />
        {tiles.map((i) => {
          const x = 124 + (i % 8) * 19.5;
          const y = 124 + Math.floor(i / 8) * 19.5;
          return <rect key={i} x={x} y={y} width="16" height="16" rx="2" fill="#38e8ff" opacity={0.06 + ((i * 37) % 10) / 55} />;
        })}
      </svg>
    </div>
  );
}
