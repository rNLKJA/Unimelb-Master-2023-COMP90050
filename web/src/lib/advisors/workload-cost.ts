import type { CostModel } from "@/lib/engine/cost-model";
import { indexId, type IndexDef, type QueryInstance } from "@/lib/engine/types";
import { compressWorkload } from "./candidates";

export interface WeightedQuery {
  query: QueryInstance;
  weight: number;
}

export type WorkloadInput = QueryInstance[] | WeightedQuery[];

/** Accept raw statements (compressed by template) or pre-weighted templates. */
export function toWeighted(input: WorkloadInput): WeightedQuery[] {
  if (input.length === 0) return [];
  return "query" in input[0]
    ? (input as WeightedQuery[])
    : compressWorkload(input as QueryInstance[]);
}

/** Weighted what-if cost of a (compressed) workload. */
export class WhatIfWorkload {
  readonly items: WeightedQuery[];
  constructor(
    readonly model: CostModel,
    input: WorkloadInput,
  ) {
    this.items = toWeighted(input).filter((i) => i.weight > 0);
  }

  get queries(): QueryInstance[] {
    return this.items.map((i) => i.query);
  }

  cost(config: IndexDef[]): number {
    let total = 0;
    for (const { query, weight } of this.items)
      total += weight * this.model.estimate(query, config).cost;
    return total;
  }

  bytes(config: IndexDef[]): number {
    return config.reduce((s, ix) => s + this.model.indexBytes(ix), 0);
  }
}

export function withIndex(config: IndexDef[], ix: IndexDef): IndexDef[] {
  return [...config, ix];
}

export function without(config: IndexDef[], ix: IndexDef): IndexDef[] {
  const id = indexId(ix);
  return config.filter((x) => indexId(x) !== id);
}

export function containsIndex(config: IndexDef[], ix: IndexDef): boolean {
  const id = indexId(ix);
  return config.some((x) => indexId(x) === id);
}
