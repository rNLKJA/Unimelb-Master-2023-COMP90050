/**
 * Synthetic arrival-rate traces with the patterns QB5000 was built for: daily
 * cycles, weekday/weekend differences, a nightly batch and a weekly spike.
 * Hourly buckets; counts are Poisson-like draws around a smooth rate.
 */
import { deriveSeed, mulberry32, normal } from "@/lib/random";
import { READ_TEMPLATES, type TemplateGroup } from "@/lib/workload/templates";

export const HOURS_PER_DAY = 24;

export interface Trace {
  hours: number;
  /** Queries per hour, per template id. */
  series: Record<string, number[]>;
  groupOf: Record<string, TemplateGroup>;
}

const gauss = (x: number, mu: number, sigma: number) => Math.exp(-0.5 * ((x - mu) / sigma) ** 2);

/** Expected hourly rate for a group at absolute hour h (hour 0 = Monday 00:00). */
export function groupRate(group: TemplateGroup, h: number): number {
  const hour = h % 24;
  const day = Math.floor(h / 24) % 7;
  const weekend = day >= 5;
  switch (group) {
    case "orders": {
      // Office hours with a lunch dip; quiet weekends.
      const office = gauss(hour, 10.5, 2.2) + 0.85 * gauss(hour, 15, 2);
      return (weekend ? 6 : 40) * office + 2;
    }
    case "shipping": {
      // Nightly batch every day, plus a Monday-morning reconciliation spike.
      const nightly = gauss(hour, 2, 1.1) * 30;
      const monday = day === 0 ? gauss(hour, 7, 1.2) * 90 : 0;
      return nightly + monday + 1;
    }
    case "catalogue": {
      // Evening browsing, busier at weekends.
      return (weekend ? 30 : 18) * gauss(hour, 20, 2.3) + 4 * gauss(hour, 13, 3) + 1.5;
    }
  }
}

export function generateTrace({ days, seed }: { days: number; seed: number }): Trace {
  const hours = days * HOURS_PER_DAY;
  const series: Record<string, number[]> = {};
  const groupOf: Record<string, TemplateGroup> = {};
  for (const t of READ_TEMPLATES) {
    const rng = mulberry32(deriveSeed(seed, `trace:${t.id}`));
    const scale = 0.6 + 0.8 * rng();
    groupOf[t.id] = t.group;
    series[t.id] = Array.from({ length: hours }, (_, h) => {
      const rate = groupRate(t.group, h) * scale * (1 + 0.004 * (h / 24)); // gentle growth
      return Math.max(0, Math.round(rate + Math.sqrt(rate) * normal(rng)));
    });
  }
  return { hours, series, groupOf };
}

/** Sum a series into buckets of `size` hours. */
export function bucket(series: number[], size: number): number[] {
  const out: number[] = [];
  for (let i = 0; i + size <= series.length; i += size) {
    let s = 0;
    for (let j = i; j < i + size; j++) s += series[j];
    out.push(s);
  }
  return out;
}
