/**
 * QB5000's Pre-Processor (Ma et al., SIGMOD 2018; Ma 2021, §3.3): turn a raw
 * SQL statement into a template by replacing constants with placeholders and
 * normalising spacing and keyword case, so statements that differ only in
 * their parameters are counted as one template.
 */

const KEYWORDS = [
  "select",
  "from",
  "where",
  "and",
  "or",
  "not",
  "join",
  "on",
  "group",
  "by",
  "order",
  "asc",
  "desc",
  "sum",
  "count",
  "avg",
  "min",
  "max",
  "as",
  "between",
  "update",
  "set",
  "insert",
  "into",
  "values",
  "delete",
  "in",
  "is",
  "null",
  "limit",
  "having",
  "distinct",
  "like",
];
const KEYWORD_RE = new RegExp(`\\b(${KEYWORDS.join("|")})\\b`, "gi");

export function templatize(sql: string): string {
  return sql
    .replace(/'(?:[^']|'')*'/g, "?") // string and date literals
    .replace(/(?<![\w.])-?\d+(?:\.\d+)?(?![\w.])/g, "?") // numeric literals
    .replace(/\(\s*\?(?:\s*,\s*\?)+\s*\)/g, "(?)") // IN lists of any length
    .replace(KEYWORD_RE, (k) => k.toUpperCase())
    .replace(/\s+/g, " ")
    .replace(/\(\s+/g, "(")
    .replace(/\s+\)/g, ")")
    .replace(/\s*,\s*/g, ", ")
    .trim();
}
