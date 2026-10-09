/**
 * Seeded pseudo-random numbers for the bootstrap, so a page shows the same
 * intervals on every render and in every browser. xoshiro128** seeded
 * through splitmix32 (both 32-bit, exact in JavaScript integer arithmetic).
 *
 * This is deliberately a separate stream from the lab's data and workload
 * generator (lib/random.ts): resampling must never shift a workload.
 */

/** The seed every resampling procedure on the site uses unless told otherwise (the subject code). */
export const STATS_SEED = 90050;

export interface StatsRng {
  readonly seed: number;
  /** Uniform on [0, 1). */
  next(): number;
  /** Uniform integer on [0, n). */
  int(n: number): number;
}

function splitmix32(seed: number): () => number {
  let a = seed | 0;
  return () => {
    a = (a + 0x9e3779b9) | 0;
    let t = a ^ (a >>> 16);
    t = Math.imul(t, 0x21f0aaad);
    t ^= t >>> 15;
    t = Math.imul(t, 0x735a2d97);
    t ^= t >>> 15;
    return t >>> 0;
  };
}

export function createStatsRng(seed: number = STATS_SEED): StatsRng {
  const sm = splitmix32(seed);
  let a = sm();
  let b = sm();
  let c = sm();
  let d = sm();
  const nextU32 = () => {
    const t = b << 9;
    let r = Math.imul(b, 5);
    r = Math.imul((r << 7) | (r >>> 25), 9);
    c ^= a;
    d ^= b;
    b ^= c;
    a ^= d;
    c ^= t;
    d = (d << 11) | (d >>> 21);
    return r >>> 0;
  };
  return {
    seed,
    next: () => nextU32() / 4294967296,
    int: (n: number) => Math.floor((nextU32() / 4294967296) * n),
  };
}
