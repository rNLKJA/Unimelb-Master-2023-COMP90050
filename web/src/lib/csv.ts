/** RFC 4180 CSV: quote cells with commas, quotes or line breaks. */
export type Cell = string | number | boolean | null | undefined;

export function csvCell(v: Cell): string {
  if (v === null || v === undefined) return "";
  const s =
    typeof v === "number"
      ? Number.isInteger(v)
        ? String(v)
        : String(Number(v.toFixed(6)))
      : String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(header: readonly string[], rows: readonly (readonly Cell[])[]): string {
  return (
    [header.map(csvCell).join(","), ...rows.map((r) => r.map(csvCell).join(","))].join("\n") + "\n"
  );
}

/** Save text as a file from the browser. */
export function download(name: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
