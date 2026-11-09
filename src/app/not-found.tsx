import Link from "next/link";

export default function NotFound() {
  return (
    <section className="grid min-h-[100svh] place-items-center px-[var(--gutter)] text-center">
      <div>
        <p className="label !text-cyan">Segmentation fault · 404</p>
        <h1 className="display-xl metal-text mt-6 text-[clamp(4rem,16vw,12rem)]">Lost pointer</h1>
        <p className="mx-auto mt-6 max-w-md text-mute">That address does not map to anything. Head back to a valid page.</p>
        <Link href="/" className="label mt-10 inline-flex rounded-full border border-white/25 px-6 py-3 !text-ink transition-colors hover:border-cyan hover:!text-cyan">
          Return to start
        </Link>
      </div>
    </section>
  );
}
