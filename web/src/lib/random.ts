/**
 * Small, deterministic pseudo-random helpers. Every stochastic part of the lab
 * (data generation, workload parameters, simulated noise, DB2 Advisor's random
 * variations) draws from a seeded generator so runs are reproducible.
 */

export type Rng = () => number;

/** mulberry32: a fast 32-bit generator with good statistical quality for simulation. */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Derive an independent stream from a base seed and a label (FNV-1a hash). */
export function deriveSeed(seed: number, label: string): number {
  let h = 0x811c9dc5 ^ (seed >>> 0);
  for (let i = 0; i < label.length; i++) {
    h ^= label.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function randInt(rng: Rng, lo: number, hi: number): number {
  return lo + Math.floor(rng() * (hi - lo + 1));
}

export function pick<T>(rng: Rng, items: readonly T[]): T {
  return items[Math.floor(rng() * items.length)];
}

/** Standard normal via Box-Muller. */
export function normal(rng: Rng): number {
  let u = 0;
  while (u === 0) u = rng();
  const v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/** Fisher-Yates shuffle (returns a new array). */
export function shuffle<T>(rng: Rng, items: readonly T[]): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Zipf sampler over 1..n with exponent z (z = 0 is uniform). Uses a cumulative
 * table and binary search, which is fine for the table sizes in this lab.
 */
export function zipfSampler(n: number, z: number): (rng: Rng) => number {
  if (z <= 0) return (rng) => 1 + Math.floor(rng() * n);
  const cdf = new Float64Array(n);
  let total = 0;
  for (let k = 1; k <= n; k++) {
    total += 1 / Math.pow(k, z);
    cdf[k - 1] = total;
  }
  for (let k = 0; k < n; k++) cdf[k] /= total;
  return (rng) => {
    const u = rng();
    let lo = 0;
    let hi = n - 1;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (cdf[mid] < u) lo = mid + 1;
      else hi = mid;
    }
    return lo + 1;
  };
}
