#!/usr/bin/env node
/**
 * Optimise the raw showcase output of e2e/showcase.spec.ts.
 *
 *   .showcase/screens/<shot>.png       -> ../docs/showcase/<shot>.png         (README, < 600 KB each)
 *                                      -> public/showcase/<shot>.webp         (/tour lightbox)
 *                                      -> public/showcase/<shot>-thumb.webp   (/tour grid, 720 px)
 *   .showcase/videos/<workflow>.webm   -> public/showcase/<workflow>.mp4      (H.264, CRF ~28, faststart, <= 8 MB)
 *                                      -> public/showcase/<workflow>-poster.webp
 *                                      -> public/showcase/<workflow>.vtt      (captions from the on-screen steps)
 *                                      -> ../docs/showcase/<workflow>.gif     (960 px, 10 fps, <= 8 MB)
 *
 * The page load before the first caption is trimmed from every recording.
 * Needs ffmpeg (with libx264) and cwebp (`brew install ffmpeg webp`).
 * Run from web/: `pnpm showcase:media` (or `pnpm showcase` for tour + media).
 */
import { execFileSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const WEB = dirname(dirname(fileURLToPath(import.meta.url)));
const RAW = join(WEB, ".showcase");
const TMP = join(RAW, "tmp");
const DOCS = join(WEB, "..", "docs", "showcase");
const PUBLIC = join(WEB, "public", "showcase");

const MAX_PNG = 600 * 1024;
const MAX_VIDEO = 8 * 1024 * 1024;
const MAX_GIF = 8 * 1024 * 1024;
/** Mobile shots are captured at 2x (780 x 1688) and kept at 1.5x. */
const MOBILE_WIDTH = 585;
const THUMB_WIDTH = 720;

/** Which step's midpoint makes the poster frame (0-based), as in src/lib/showcase.ts. */
const POSTER_STEP = { "levels-of-autonomy": 1, "louvre-arena": 4, "llm-advisor": 3 };

function need(cmd, args, hint) {
  try {
    execFileSync(cmd, args, { stdio: "ignore" });
  } catch {
    console.error(`showcase-media: ${cmd} is required (${hint}).`);
    process.exit(1);
  }
}
need("ffmpeg", ["-version"], "brew install ffmpeg");
need("cwebp", ["-version"], "brew install webp");

const ffmpeg = (...args) =>
  execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", ...args]);
const size = (p) => statSync(p).size;
const kb = (n) => `${(n / 1024).toFixed(0)} KB`;
const mb = (n) => `${(n / 1024 / 1024).toFixed(2)} MB`;
const human = (n) => (n >= 1024 * 1024 ? mb(n) : kb(n));

for (const d of [TMP, DOCS, PUBLIC]) mkdirSync(d, { recursive: true });
const written = [];
const note = (path, bytes) =>
  written.push({ path: path.replace(join(WEB, "..") + "/", ""), bytes });

// ---------------------------------------------------------------------------
// screenshots

const screens = join(RAW, "screens");
const shots = existsSync(screens)
  ? readdirSync(screens)
      .filter((f) => f.endsWith(".png"))
      .sort()
  : [];
for (const file of shots) {
  const name = file.replace(/\.png$/, "");
  const src = join(screens, file);
  const mobile = name.includes("mobile");

  // 1. scale (mobile only) into a full-colour master
  const master = join(TMP, `${name}.png`);
  ffmpeg(
    "-i",
    src,
    ...(mobile ? ["-vf", `scale=${MOBILE_WIDTH}:-1:flags=lanczos`] : []),
    "-compression_level",
    "9",
    master,
  );

  // 2. a 256-colour palette version; keep whichever is smaller (UI screenshots quantise cleanly)
  const quantised = join(TMP, `${name}.q.png`);
  ffmpeg(
    "-i",
    master,
    "-vf",
    "split[a][b];[a]palettegen=max_colors=256:reserve_transparent=0:stats_mode=single[p];[b][p]paletteuse=dither=sierra2_4a",
    "-compression_level",
    "9",
    quantised,
  );
  const best = size(quantised) < size(master) ? quantised : master;
  const png = join(DOCS, file);
  copyFileSync(best, png);
  if (size(png) > MAX_PNG) throw new Error(`${png} is ${kb(size(png))}, over ${kb(MAX_PNG)}`);
  note(png, size(png));

  // 3. WebP for the site, from the full-colour master: full size and a grid thumbnail
  const webp = join(PUBLIC, `${name}.webp`);
  execFileSync("cwebp", ["-quiet", "-q", "84", "-m", "6", "-sharp_yuv", master, "-o", webp]);
  note(webp, size(webp));
  const thumb = join(PUBLIC, `${name}-thumb.webp`);
  const width = mobile ? Math.round(MOBILE_WIDTH / 1.5) : THUMB_WIDTH;
  execFileSync("cwebp", [
    "-quiet",
    "-q",
    "80",
    "-m",
    "6",
    "-sharp_yuv",
    "-resize",
    String(width),
    "0",
    master,
    "-o",
    thumb,
  ]);
  note(thumb, size(thumb));
}

// ---------------------------------------------------------------------------
// recordings

const videos = join(RAW, "videos");
const runs = existsSync(videos)
  ? readdirSync(videos)
      .filter((f) => f.endsWith(".json"))
      .sort()
  : [];
const vttTime = (s) => {
  const ms = Math.max(0, Math.round(s * 1000));
  const h = String(Math.floor(ms / 3_600_000)).padStart(2, "0");
  const m = String(Math.floor((ms % 3_600_000) / 60_000)).padStart(2, "0");
  const sec = String(Math.floor((ms % 60_000) / 1000)).padStart(2, "0");
  return `${h}:${m}:${sec}.${String(ms % 1000).padStart(3, "0")}`;
};

for (const file of runs) {
  const timing = JSON.parse(readFileSync(join(videos, file), "utf8"));
  const { slug, cues } = timing;
  const webm = join(videos, `${slug}.webm`);
  if (!existsSync(webm)) throw new Error(`missing ${webm}`);
  // trim the page load before the first caption; keep a short lead-in
  const start = Math.max(0, cues[0].start - 0.6);
  const end = timing.end;
  const trim = ["-ss", start.toFixed(3), "-to", end.toFixed(3), "-i", webm];

  // MP4 for the site; raise CRF until it fits
  const mp4 = join(PUBLIC, `${slug}.mp4`);
  for (const crf of [28, 30, 32, 34]) {
    ffmpeg(
      ...trim,
      "-an",
      "-c:v",
      "libx264",
      "-preset",
      "slow",
      "-crf",
      String(crf),
      "-pix_fmt",
      "yuv420p",
      "-movflags",
      "+faststart",
      mp4,
    );
    if (size(mp4) <= MAX_VIDEO) break;
  }
  if (size(mp4) > MAX_VIDEO) throw new Error(`${mp4} is ${mb(size(mp4))}`);
  note(mp4, size(mp4));

  // GIF for the README: 960 px, 10 fps, one palette for the clip, only changed rectangles re-encoded
  const gif = join(DOCS, `${slug}.gif`);
  for (const colours of [128, 96, 64, 48]) {
    ffmpeg(
      ...trim,
      "-vf",
      `fps=10,scale=960:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=${colours}:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle`,
      "-loop",
      "0",
      gif,
    );
    if (size(gif) <= MAX_GIF) break;
  }
  if (size(gif) > MAX_GIF) throw new Error(`${gif} is ${mb(size(gif))}`);
  note(gif, size(gif));

  // poster frame: the middle of a representative step
  const cue = cues[POSTER_STEP[slug] ?? 0] ?? cues[0];
  const at = (cue.start + cue.end) / 2 - start;
  const posterPng = join(TMP, `${slug}-poster.png`);
  ffmpeg("-ss", at.toFixed(3), "-i", mp4, "-frames:v", "1", posterPng);
  const poster = join(PUBLIC, `${slug}-poster.webp`);
  execFileSync("cwebp", ["-quiet", "-q", "80", "-m", "6", posterPng, "-o", poster]);
  note(poster, size(poster));

  // WebVTT captions: the same text as the on-screen banner
  const total = cues.length;
  const vtt = [
    "WEBVTT",
    "",
    ...cues.flatMap((c, i) => [
      `${i + 1}`,
      `${vttTime(c.start - start)} --> ${vttTime(c.end - start)}`,
      `Step ${i + 1} of ${total}: ${c.text}`,
      "",
    ]),
  ].join("\n");
  const vttPath = join(PUBLIC, `${slug}.vtt`);
  writeFileSync(vttPath, vtt);
  note(vttPath, size(vttPath));
}

rmSync(TMP, { recursive: true, force: true });

if (!written.length) {
  console.error("showcase-media: nothing to do; run `pnpm showcase:e2e` first.");
  process.exit(1);
}
const width = Math.max(...written.map((w) => w.path.length));
console.log("\nShowcase media");
for (const w of written) console.log(`  ${w.path.padEnd(width)}  ${human(w.bytes).padStart(9)}`);
const total = written.reduce((s, w) => s + w.bytes, 0);
console.log(`  ${"total".padEnd(width)}  ${human(total).padStart(9)}\n`);
