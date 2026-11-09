/**
 * Server-rendered first frame so the page never flashes unstyled text before
 * the intro starts. Removed by the Hero on mount; a CSS animation also
 * dismisses it on its own if JavaScript never runs.
 */
export default function BootVeil() {
  return (
    <div id="boot-veil" aria-hidden className="boot-veil">
      <div className="label flex items-center gap-3 !text-cyan">
        <span className="h-1.5 w-1.5 rounded-full bg-cyan" style={{ animation: "pulse-dot 1s infinite" }} />
        Initializing
        <span style={{ animation: "blink 0.8s steps(1) infinite" }}>_</span>
      </div>
    </div>
  );
}
