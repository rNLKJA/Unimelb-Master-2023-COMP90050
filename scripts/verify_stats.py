# /// script
# requires-python = ">=3.11"
# dependencies = ["numpy>=2", "scipy>=1.14", "statsmodels>=0.14"]
# ///
"""Reference values for the statistics helpers in web/src/lib/stats/.

The benchmark, the LLM index-advisor evaluation and the invalid-proposal rate
are summarised in the browser by TypeScript helpers: Wilson intervals, exact
sign tests, means, standard deviations, Cohen's d_z and percentile-bootstrap
intervals. This script computes the same quantities with numpy, scipy and
statsmodels and writes web/src/lib/stats/__fixtures__/stats-parity.json, which
web/src/lib/stats/stats.test.ts compares against.

    uv run scripts/verify_stats.py
"""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import scipy
import statsmodels
from scipy import stats
from statsmodels.stats.proportion import proportion_confint

OUT = (
    Path(__file__).resolve().parent.parent
    / "web" / "src" / "lib" / "stats" / "__fixtures__" / "stats-parity.json"
)

# Paired workload totals (ms) of two advisors over ten seeded replicates, and
# timing-like samples. Fixed here so both implementations see the same data.
SAMPLES = {
    "a": [412.5, 398.1, 455.0, 430.2, 401.7, 470.9, 388.4, 420.0, 441.3, 409.8],
    "b": [455.2, 430.6, 470.1, 468.0, 440.3, 482.5, 430.9, 451.7, 470.2, 433.0],
    "odd": [3.1, 0.4, 2.2, 9.7, 5.5, 1.0, 4.4],
    "even": [12.0, 7.5, 3.25, 8.0, 1.5, 6.0],
    "timings": [0.84, 0.91, 0.79, 1.02, 0.88, 0.95, 0.81, 0.86, 1.31, 0.83, 0.9, 0.87, 0.92, 0.85, 0.8],
}


def main() -> None:
    normal_cdf = [[x, float(stats.norm.cdf(x))] for x in (-8.0, -3.5, -1.96, -1.0, -0.25, 0.0, 0.5, 1.0, 1.6449, 2.5, 6.0)]
    normal_sf = [[x, float(stats.norm.sf(x))] for x in (0.0, 1.0, 1.96, 3.0, 5.0, 8.0, 12.0)]
    normal_ppf = [[p, float(stats.norm.ppf(p))] for p in (1e-10, 0.001, 0.01, 0.025, 0.05, 0.1, 0.3, 0.5, 0.7, 0.9, 0.95, 0.975, 0.99, 0.999)]

    wilson = []
    for k, n in [(0, 10), (1, 10), (3, 10), (10, 10), (0, 1), (1, 1), (0, 20), (7, 20), (19, 20), (3, 7), (13, 14), (45, 60), (500, 1000)]:
        for level in (0.95, 0.9):
            lo, hi = proportion_confint(k, n, alpha=1 - level, method="wilson")
            wilson.append([k, n, level, float(lo), float(hi)])

    sign = []
    for w, l in [(0, 0), (1, 0), (0, 5), (3, 2), (7, 1), (10, 0), (8, 2), (5, 5), (0, 12), (13, 4), (40, 25)]:
        p = 1.0 if w + l == 0 else float(stats.binomtest(w, w + l, 0.5, alternative="two-sided").pvalue)
        sign.append([w, l, p])

    quantiles = []
    for name in ("odd", "even", "timings", "a"):
        xs = SAMPLES[name]
        for p in (0.0, 0.025, 0.1, 0.25, 0.5, 0.75, 0.9, 0.975, 1.0):
            quantiles.append([name, p, float(np.percentile(xs, p * 100))])

    a = np.array(SAMPLES["a"])
    b = np.array(SAMPLES["b"])
    d = a - b
    describe = {
        name: {"mean": float(np.mean(xs)), "sd": float(np.std(xs, ddof=1)), "median": float(np.median(xs))}
        for name, xs in SAMPLES.items()
    }
    dz = float(np.mean(d) / np.std(d, ddof=1))

    # scipy's percentile bootstrap: Monte Carlo references, so the TypeScript
    # intervals (a different random stream) must agree within resampling error.
    rng = np.random.default_rng(90050)
    boot_mean_diff = stats.bootstrap((d,), np.mean, n_resamples=20000, method="percentile", random_state=rng)
    boot_ratio = stats.bootstrap(
        (a, b),
        lambda x, y: np.mean(x) / np.mean(y),
        paired=True,
        vectorized=False,
        n_resamples=20000,
        method="percentile",
        random_state=np.random.default_rng(90051),
    )
    boot_mean = stats.bootstrap((a,), np.mean, n_resamples=20000, method="percentile", random_state=np.random.default_rng(90052))

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(
        json.dumps(
            {
                "source": f"numpy {np.__version__}, scipy {scipy.__version__}, statsmodels {statsmodels.__version__}",
                "normalCdf": normal_cdf,
                "normalSf": normal_sf,
                "normalPpf": normal_ppf,
                "wilson": wilson,
                "signTest": sign,
                "samples": SAMPLES,
                "quantiles": quantiles,
                "describe": describe,
                "pairedDiffMean": float(np.mean(d)),
                "cohensDz": dz,
                "bootstrap": {
                    "B": 20000,
                    "meanDiff": [float(boot_mean_diff.confidence_interval.low), float(boot_mean_diff.confidence_interval.high)],
                    "ratioOfMeans": [float(boot_ratio.confidence_interval.low), float(boot_ratio.confidence_interval.high)],
                    "meanA": [float(boot_mean.confidence_interval.low), float(boot_mean.confidence_interval.high)],
                },
            },
            indent=1,
        )
        + "\n"
    )
    print(f"wrote {OUT}")


if __name__ == "__main__":
    main()
