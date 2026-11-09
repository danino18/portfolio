"use client";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <section role="alert" className="grid min-h-[100svh] place-items-center px-[var(--gutter)] text-center">
      <div>
        <p className="label !text-signal">Runtime exception</p>
        <h1 className="display-xl metal-text mt-6 text-[clamp(3rem,12vw,9rem)]">Something faulted</h1>
        <p className="mx-auto mt-6 max-w-md text-mute">The page hit an unexpected error{error.digest ? ` (ref ${error.digest})` : ""}. Reloading usually fixes it.</p>
        <button type="button" onClick={reset} className="label mt-10 inline-flex rounded-full border border-white/25 px-6 py-3 !text-ink transition-colors hover:border-cyan hover:!text-cyan">
          Try again
        </button>
      </div>
    </section>
  );
}
