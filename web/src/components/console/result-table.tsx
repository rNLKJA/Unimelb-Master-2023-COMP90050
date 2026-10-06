import { Panel, PanelHeader } from "@/components/shared/section";
import type { ConsoleResult } from "@/workers/protocol";

/** Up to 200 result rows; numbers right-aligned in the data font. */
export function ResultTable({ result }: { result: ConsoleResult }) {
  const numeric = result.columns.map((_, i) => result.rows.some((r) => typeof r[i] === "number"));
  if (result.columns.length === 0) {
    return (
      <Panel className="text-muted-foreground px-4 py-3 text-sm">
        The statement returned no columns
        {result.changes > 0
          ? ` and changed ${result.changes.toLocaleString("en-AU")} row${result.changes === 1 ? "" : "s"}`
          : ""}
        .
      </Panel>
    );
  }
  return (
    <Panel>
      <PanelHeader
        title="Result"
        sub={
          result.rows.length === 0
            ? "No rows."
            : `${result.rows.length.toLocaleString("en-AU")} row${result.rows.length === 1 ? "" : "s"}${
                result.truncated ? " shown (first 200)" : ""
              }`
        }
      />
      {result.rows.length > 0 && (
        <div className="max-h-[28rem] overflow-auto">
          <table className="w-full text-xs">
            <thead className="bg-surface sticky top-0">
              <tr className="border-border border-b">
                {result.columns.map((c, i) => (
                  <th
                    key={`${c}-${i}`}
                    scope="col"
                    className={`text-muted-foreground px-3 py-2 font-mono font-medium whitespace-nowrap ${
                      numeric[i] ? "text-right" : "text-left"
                    }`}
                  >
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {result.rows.map((row, r) => (
                <tr
                  key={r}
                  className="border-border/40 hover:bg-surface-2/50 border-b last:border-0"
                >
                  {row.map((v, i) => (
                    <td
                      key={i}
                      className={
                        typeof v === "number"
                          ? "tabular px-3 py-1 text-right font-mono whitespace-nowrap"
                          : "max-w-[28rem] truncate px-3 py-1 font-mono whitespace-nowrap"
                      }
                      title={typeof v === "string" && v.length > 40 ? v : undefined}
                    >
                      {v === null ? <span className="text-muted-foreground">NULL</span> : String(v)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}
