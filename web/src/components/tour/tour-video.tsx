"use client";

import { useEffect, useRef, useState } from "react";

/**
 * A captioned walkthrough video that only starts loading when it comes near
 * the viewport. Until then the poster stands in for it, so the /tour page
 * costs three small images rather than three videos on first load.
 */
export function TourVideo({
  src,
  poster,
  captions,
  label,
  width,
  height,
}: {
  src: string;
  poster: string;
  captions: string;
  /** Accessible name, e.g. "Walkthrough 1: Levels of autonomy". */
  label: string;
  width: number;
  height: number;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const [near, setNear] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || near) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setNear(true);
          io.disconnect();
        }
      },
      { rootMargin: "400px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [near]);

  return (
    <video
      ref={ref}
      src={near ? src : undefined}
      poster={poster}
      width={width}
      height={height}
      controls
      muted
      playsInline
      preload="metadata"
      aria-label={label}
      className="border-border bg-surface-2 aspect-[8/5] h-auto w-full rounded-lg border"
    >
      <track kind="captions" src={captions} srcLang="en" label="English" />
      Your browser cannot play this video. <a href={src}>Download the MP4</a>.
    </video>
  );
}
