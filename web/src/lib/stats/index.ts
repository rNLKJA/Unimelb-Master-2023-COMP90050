/**
 * Statistical helpers behind every interval and test on the site. Each is
 * unit tested; the ones that mirror a reference implementation (numpy, scipy,
 * statsmodels, base R) are checked against values written by
 * scripts/verify_stats.py and scripts/verify_stats.R.
 */
export * from "./bootstrap";
export * from "./describe";
export * from "./paired";
export * from "./proportion";
export * from "./random";
export { erfc, gammaQ, lgamma, normalCdf, normalQuantile, normalSf } from "./special";
