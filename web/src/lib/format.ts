export function formatMs(ms: number): string {
  if (!Number.isFinite(ms)) return "–";
  if (ms >= 60_000) return `${(ms / 60_000).toFixed(1)} min`;
  if (ms >= 10_000) return `${(ms / 1000).toFixed(1)} s`;
  if (ms >= 1000) return `${(ms / 1000).toFixed(2)} s`;
  if (ms >= 100) return `${ms.toFixed(0)} ms`;
  if (ms >= 10) return `${ms.toFixed(1)} ms`;
  if (ms >= 0.1) return `${ms.toFixed(2)} ms`;
  if (ms === 0) return "0 ms";
  return `${(ms * 1000).toFixed(0)} µs`;
}

export function formatBytes(bytes: number): string {
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(bytes >= 10_000_000 ? 0 : 1)} MB`;
  if (bytes >= 1000) return `${(bytes / 1000).toFixed(0)} kB`;
  return `${bytes} B`;
}

export function formatInt(n: number): string {
  return Math.round(n).toLocaleString("en-AU");
}

/** "Nice" axis ticks for [0, max]. */
export function niceTicks(max: number, count = 4): number[] {
  if (!(max > 0)) return [0];
  const raw = max / count;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw;
  const ticks: number[] = [];
  for (let v = 0; v <= max + step * 0.001; v += step) ticks.push(Number(v.toPrecision(12)));
  if (ticks[ticks.length - 1] < max)
    ticks.push(Number((ticks[ticks.length - 1] + step).toPrecision(12)));
  return ticks;
}
