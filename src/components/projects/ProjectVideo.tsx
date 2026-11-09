"use client";

import { useEffect, useRef, useState } from "react";
import type { ProjectMedia } from "@/content/projects";
import { isReducedMotion } from "@/lib/motion";
import { ExternalIcon, PauseIcon, PlayIcon } from "@/components/ui/Icons";

/**
 * Cinematic frame for a project's real footage.
 *
 * YouTube: a lightweight facade (poster + play button, which is also a plain
 * link to YouTube without JS) until the frame comes near the viewport; then
 * the privacy-enhanced player is loaded muted + playsinline and, when motion
 * is allowed, starts on its own. It pauses when scrolled away. Play/pause is
 * a real button driven through the player's postMessage API, and a "Watch on
 * YouTube" link is always available if the embed is blocked.
 *
 * File: a native <video> with preload="none", poster, muted/playsInline
 * autoplay only while visible, native controls and a link fallback.
 */
export default function ProjectVideo({ media, accent = "#ff8a3d", className = "" }: { media: ProjectMedia; accent?: string; className?: string }) {
  return media.kind === "youtube" ? <YouTubeFrame media={media} accent={accent} className={className} /> : <FileFrame media={media} accent={accent} className={className} />;
}

function Frame({ aspect, accent, className, children, caption, label }: { aspect: number; accent: string; className: string; children: React.ReactNode; caption: string; label: React.ReactNode }) {
  return (
    <figure className={`relative ${className}`}>
      <div
        className="video-frame mx-auto w-full"
        style={{ aspectRatio: String(aspect), maxHeight: "min(82svh, 46rem)", maxWidth: aspect < 1 ? `calc(min(82svh, 46rem) * ${aspect})` : undefined }}
      >
        {children}
        <div aria-hidden className="pointer-events-none absolute inset-0 rounded-[inherit] ring-1 ring-inset ring-white/10" />
        <div aria-hidden className="pointer-events-none absolute -inset-px rounded-[inherit] opacity-60" style={{ background: `linear-gradient(160deg, ${accent}33, transparent 35%, transparent 65%, #38e8ff22)` , mixBlendMode: "screen" }} />
      </div>
      <figcaption className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <span className="label flex items-center gap-2 !text-ink">
          <span aria-hidden className="h-1.5 w-1.5 rounded-full" style={{ background: accent, boxShadow: `0 0 10px ${accent}` }} />
          {caption}
        </span>
        {label}
      </figcaption>
    </figure>
  );
}

function YouTubeFrame({ media, accent, className }: { media: Extract<ProjectMedia, { kind: "youtube" }>; accent: string; className: string }) {
  const host = useRef<HTMLDivElement>(null);
  const iframe = useRef<HTMLIFrameElement>(null);
  const [load, setLoad] = useState(false);
  const [playing, setPlaying] = useState(false);
  const wantPlaying = useRef(false);
  const src = useRef<string | null>(null);

  const post = (func: "playVideo" | "pauseVideo" | "mute") => {
    iframe.current?.contentWindow?.postMessage(JSON.stringify({ event: "command", func, args: [] }), "*");
  };

  // Load the player shortly before it scrolls into view; play/pause with visibility.
  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const allowAuto = !isReducedMotion() && !(navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData;
    const near = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setLoad(true);
          near.disconnect();
        }
      },
      { rootMargin: "300px 0px" },
    );
    const vis = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting && wantPlaying.current) {
          post("pauseVideo");
          setPlaying(false);
        } else if (e.isIntersecting && allowAuto && e.intersectionRatio > 0.5 && !wantPlaying.current) {
          wantPlaying.current = true;
          post("playVideo");
          setPlaying(true);
        }
      },
      { threshold: [0, 0.5] },
    );
    near.observe(el);
    vis.observe(el);
    return () => {
      near.disconnect();
      vis.disconnect();
    };
  }, []);

  const toggle = () => {
    if (!load) {
      setLoad(true);
      wantPlaying.current = true;
      setPlaying(true);
      return;
    }
    if (playing) {
      post("pauseVideo");
      setPlaying(false);
      wantPlaying.current = false;
    } else {
      post("playVideo");
      setPlaying(true);
      wantPlaying.current = true;
    }
  };

  // The src is fixed the first time the player loads (changing it would reload the iframe).
  if (load && !src.current) {
    const params = new URLSearchParams({
      enablejsapi: "1",
      mute: "1",
      playsinline: "1",
      loop: "1",
      playlist: media.id,
      rel: "0",
      modestbranding: "1",
      controls: "1",
      autoplay: wantPlaying.current ? "1" : "0",
    });
    src.current = `https://www.youtube-nocookie.com/embed/${media.id}?${params.toString()}`;
  }
  const poster = `https://i.ytimg.com/vi/${media.id}/hqdefault.jpg`;

  return (
    <Frame
      aspect={media.aspect}
      accent={accent}
      className={className}
      caption={media.caption}
      label={
        <span className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggle}
            aria-pressed={playing}
            className="label inline-flex items-center gap-2 rounded-full border border-white/20 px-3 py-1.5 !text-ink transition-colors hover:border-[var(--accent)]"
          >
            {playing ? <PauseIcon className="h-3 w-3" /> : <PlayIcon className="h-3 w-3" />}
            {playing ? "Pause" : "Play"}
          </button>
          <a href={media.url} target="_blank" rel="noopener noreferrer" className="label inline-flex items-center gap-1.5 hover:!text-ink">
            YouTube <ExternalIcon className="h-3 w-3" />
          </a>
        </span>
      }
    >
      <div ref={host} className="absolute inset-0" data-video="youtube">
        {/* Poster / facade: also a real link, so it works without JS or with embeds blocked. */}
        <a
          href={media.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => {
            e.preventDefault();
            toggle();
          }}
          aria-label={`Play video: ${media.title}`}
          className={`group absolute inset-0 grid place-items-center transition-opacity duration-500 ${load ? "pointer-events-none opacity-0" : "opacity-100"}`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={poster} alt="" loading="lazy" decoding="async" className="absolute inset-0 h-full w-full scale-[1.02] object-cover opacity-80" />
          <span aria-hidden className="absolute inset-0 bg-[radial-gradient(70%_60%_at_50%_45%,transparent,rgba(3,4,7,0.75))]" />
          <span aria-hidden className="relative grid h-16 w-16 place-items-center rounded-full border border-white/40 bg-bg/60 text-ink backdrop-blur transition-transform duration-300 group-hover:scale-110" style={{ boxShadow: `0 0 40px ${accent}66` }}>
            <PlayIcon className="ml-0.5 h-6 w-6" />
          </span>
        </a>
        {load && (
          <iframe
            ref={iframe}
            title={media.title}
            src={src.current ?? undefined}
            className="absolute inset-0 h-full w-full"
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            loading="lazy"
            referrerPolicy="strict-origin-when-cross-origin"
            onLoad={() => {
              post("mute");
              if (wantPlaying.current) post("playVideo");
            }}
          />
        )}
      </div>
    </Frame>
  );
}

function FileFrame({ media, accent, className }: { media: Extract<ProjectMedia, { kind: "file" }>; accent: string; className: string }) {
  const video = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const v = video.current;
    if (!v) return;
    const allowAuto = !isReducedMotion();
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting && e.intersectionRatio > 0.5 && allowAuto) v.play().catch(() => setPlaying(false));
        else if (!e.isIntersecting) v.pause();
      },
      { threshold: [0, 0.5] },
    );
    io.observe(v);
    return () => io.disconnect();
  }, []);

  const toggle = () => {
    const v = video.current;
    if (!v) return;
    if (v.paused) v.play().catch(() => setFailed(true));
    else v.pause();
  };

  return (
    <Frame
      aspect={media.aspect}
      accent={accent}
      className={className}
      caption={media.caption}
      label={
        <button type="button" onClick={toggle} aria-pressed={playing} className="label inline-flex items-center gap-2 rounded-full border border-white/20 px-3 py-1.5 !text-ink">
          {playing ? <PauseIcon className="h-3 w-3" /> : <PlayIcon className="h-3 w-3" />}
          {playing ? "Pause" : "Play"}
        </button>
      }
    >
      <video
        ref={video}
        className="absolute inset-0 h-full w-full object-cover"
        poster={media.poster}
        preload="none"
        muted
        playsInline
        loop={media.loop}
        controls
        aria-label={media.title}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onError={() => setFailed(true)}
        data-video="file"
      >
        {media.sources.map((s) => (
          <source key={s.src} src={s.src} type={s.type} />
        ))}
        <a href={media.sources[0]?.src}>Download the video</a>
      </video>
      {failed && (
        <div className="absolute inset-0 grid place-items-center bg-bg/80 p-6 text-center text-sm text-mute">
          This browser could not play the video. <a className="underline" href={media.sources[0]?.src}>Open it directly</a>.
        </div>
      )}
    </Frame>
  );
}
