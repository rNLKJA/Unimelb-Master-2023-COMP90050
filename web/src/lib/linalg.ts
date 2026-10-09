/** Minimal dense linear algebra for the bandit's ridge regression (d ≈ 50). */

export type Matrix = Float64Array[];

export function identity(d: number, scale = 1): Matrix {
  return Array.from({ length: d }, (_, i) => {
    const row = new Float64Array(d);
    row[i] = scale;
    return row;
  });
}

export function clone(m: Matrix): Matrix {
  return m.map((row) => Float64Array.from(row));
}

/** Inverse by Gauss-Jordan elimination with partial pivoting. */
export function invert(m: Matrix): Matrix {
  const d = m.length;
  const a = clone(m);
  const inv = identity(d);
  for (let col = 0; col < d; col++) {
    let pivot = col;
    for (let r = col + 1; r < d; r++) if (Math.abs(a[r][col]) > Math.abs(a[pivot][col])) pivot = r;
    if (Math.abs(a[pivot][col]) < 1e-14) throw new Error("Matrix is singular");
    [a[col], a[pivot]] = [a[pivot], a[col]];
    [inv[col], inv[pivot]] = [inv[pivot], inv[col]];
    const p = a[col][col];
    for (let j = 0; j < d; j++) {
      a[col][j] /= p;
      inv[col][j] /= p;
    }
    for (let r = 0; r < d; r++) {
      if (r === col) continue;
      const f = a[r][col];
      if (f === 0) continue;
      for (let j = 0; j < d; j++) {
        a[r][j] -= f * a[col][j];
        inv[r][j] -= f * inv[col][j];
      }
    }
  }
  return inv;
}

export function matVec(m: Matrix, v: Float64Array): Float64Array {
  const out = new Float64Array(m.length);
  for (let i = 0; i < m.length; i++) {
    let s = 0;
    const row = m[i];
    for (let j = 0; j < v.length; j++) s += row[j] * v[j];
    out[i] = s;
  }
  return out;
}

export function dot(a: Float64Array, b: Float64Array): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

/** m += x xᵀ (in place). */
export function addOuter(m: Matrix, x: Float64Array) {
  for (let i = 0; i < x.length; i++) {
    if (x[i] === 0) continue;
    const row = m[i];
    for (let j = 0; j < x.length; j++) row[j] += x[i] * x[j];
  }
}
