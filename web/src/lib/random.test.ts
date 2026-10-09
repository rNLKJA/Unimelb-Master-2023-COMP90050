import { describe, expect, it } from "vitest";
import { deriveSeed, mulberry32, shuffle, zipfSampler } from "./random";

describe("random", () => {
  it("is deterministic for a seed", () => {
    const a = mulberry32(1);
    const b = mulberry32(1);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });

  it("derives different streams for different labels", () => {
    expect(deriveSeed(7, "a")).not.toBe(deriveSeed(7, "b"));
  });

  it("shuffles without losing items", () => {
    expect(shuffle(mulberry32(3), [1, 2, 3, 4, 5]).sort()).toEqual([1, 2, 3, 4, 5]);
  });

  it("samples Zipf values in range and skews towards 1", () => {
    const rng = mulberry32(9);
    const sample = zipfSampler(100, 1);
    const xs = Array.from({ length: 5000 }, () => sample(rng));
    expect(Math.min(...xs)).toBeGreaterThanOrEqual(1);
    expect(Math.max(...xs)).toBeLessThanOrEqual(100);
    const ones = xs.filter((x) => x === 1).length;
    expect(ones).toBeGreaterThan(xs.filter((x) => x === 50).length * 10);
  });
});
