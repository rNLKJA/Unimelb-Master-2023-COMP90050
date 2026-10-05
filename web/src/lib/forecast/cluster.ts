/**
 * QB5000's Clusterer (Ma 2021, §3.4): group templates whose arrival-rate
 * histories move together, using an on-line DBSCAN variant around cluster
 * centres. A template joins the centre with the highest cosine similarity if
 * it exceeds ρ (0.8 in the paper); templates that drift away are re-placed;
 * clusters whose centres become similar are merged.
 */

export interface Cluster {
  members: string[];
  center: number[];
}

export function cosine(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return na === 0 || nb === 0 ? 0 : dot / Math.sqrt(na * nb);
}

function centerOf(members: string[], history: Record<string, number[]>): number[] {
  const n = history[members[0]].length;
  const c = new Array<number>(n).fill(0);
  for (const m of members) for (let i = 0; i < n; i++) c[i] += history[m][i] / members.length;
  return c;
}

export function clusterTemplates(history: Record<string, number[]>, rho = 0.8): Cluster[] {
  let clusters: Cluster[] = [];
  const place = (t: string) => {
    let best = -1;
    let bestSim = rho;
    clusters.forEach((c, i) => {
      const s = cosine(history[t], c.center);
      if (s > bestSim) {
        best = i;
        bestSim = s;
      }
    });
    if (best < 0) clusters.push({ members: [t], center: [...history[t]] });
    else {
      clusters[best].members.push(t);
      clusters[best].center = centerOf(clusters[best].members, history);
    }
  };

  // Step 1: place every template.
  for (const t of Object.keys(history)) place(t);

  // Step 2: re-place templates that drifted from their centre.
  for (const c of [...clusters]) {
    for (const t of [...c.members]) {
      if (c.members.length > 1 && cosine(history[t], c.center) <= rho) {
        c.members = c.members.filter((m) => m !== t);
        c.center = centerOf(c.members, history);
        place(t);
      }
    }
  }
  clusters = clusters.filter((c) => c.members.length > 0);

  // Step 3: merge clusters whose centres are similar.
  let merged = true;
  while (merged) {
    merged = false;
    outer: for (let i = 0; i < clusters.length; i++) {
      for (let j = i + 1; j < clusters.length; j++) {
        if (cosine(clusters[i].center, clusters[j].center) > rho) {
          const members = [...clusters[i].members, ...clusters[j].members];
          clusters[i] = { members, center: centerOf(members, history) };
          clusters.splice(j, 1);
          merged = true;
          break outer;
        }
      }
    }
  }
  return clusters.map((c) => ({ ...c, members: [...c.members].sort() }));
}
