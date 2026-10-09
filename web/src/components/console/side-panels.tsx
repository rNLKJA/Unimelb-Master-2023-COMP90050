"use client";

import { KeyRound, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Panel, PanelHeader } from "@/components/shared/section";
import { SCHEMA, TABLE_NAMES, type TpchTable } from "@/lib/db/schema";
import { indexId, type IndexDef } from "@/lib/engine/types";
import { formatBytes, formatInt } from "@/lib/format";
import { cn } from "@/lib/utils";

export function IndexPanel({
  indexes,
  disabled,
  onAction,
}: {
  indexes: { index: IndexDef; bytes: number }[];
  disabled: boolean;
  onAction: (action: "create" | "drop", index: IndexDef) => void;
}) {
  const [table, setTable] = useState<TpchTable>("lineitem");
  const [columns, setColumns] = useState<string[]>([]);
  const pk = SCHEMA[table].primaryKey;
  const choices = SCHEMA[table].columns.filter((c) => c.name !== pk);
  const toggle = (name: string) =>
    setColumns((cols) =>
      cols.includes(name) ? cols.filter((c) => c !== name) : [...cols, name].slice(0, 4),
    );
  const total = indexes.reduce((s, e) => s + e.bytes, 0);

  return (
    <Panel>
      <PanelHeader
        level={2}
        title="Secondary indexes"
        sub={
          indexes.length
            ? `${indexes.length} built · ${formatBytes(total)}`
            : "None yet: every non-key predicate scans."
        }
      />
      <div className="space-y-4 p-4">
        {indexes.length > 0 && (
          <ul className="space-y-1.5" aria-label="Built indexes">
            {indexes.map(({ index, bytes }) => (
              <li
                key={indexId(index)}
                className="border-border bg-surface-2/50 flex items-center gap-2 rounded-md border py-1 pr-1 pl-2.5"
              >
                <span className="min-w-0 flex-1 truncate font-mono text-xs" title={indexId(index)}>
                  {indexId(index)}
                </span>
                <span className="text-muted-foreground font-mono text-[10px]">
                  {formatBytes(bytes)}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  disabled={disabled}
                  onClick={() => onAction("drop", index)}
                  aria-label={`Drop index ${indexId(index)}`}
                >
                  <Trash2 className="size-3.5" aria-hidden />
                </Button>
              </li>
            ))}
          </ul>
        )}
        <form
          className="space-y-2.5"
          onSubmit={(e) => {
            e.preventDefault();
            if (columns.length === 0) return;
            onAction("create", { table, columns });
            setColumns([]);
          }}
        >
          <label className="flex items-center justify-between gap-2 text-sm">
            <span className="kicker">Table</span>
            <select
              value={table}
              onChange={(e) => {
                setTable(e.target.value as TpchTable);
                setColumns([]);
              }}
              className="border-input bg-surface rounded-md border px-2 py-1 font-mono text-xs"
            >
              {TABLE_NAMES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          <fieldset>
            <legend className="kicker mb-1.5">Key columns, in order</legend>
            <div className="flex flex-wrap gap-1">
              {choices.map((c) => {
                const pos = columns.indexOf(c.name);
                return (
                  <label
                    key={c.name}
                    className={cn(
                      "has-[:focus-visible]:outline-ring relative cursor-pointer rounded-md border px-1.5 py-0.5 font-mono text-[11px] transition-colors select-none has-[:focus-visible]:outline-2",
                      pos >= 0
                        ? "border-mint/60 bg-mint-soft text-accent-foreground"
                        : "border-border text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={pos >= 0}
                      onChange={() => toggle(c.name)}
                    />
                    {pos >= 0 && <span className="mr-1 font-semibold">{pos + 1}</span>}
                    {c.name}
                  </label>
                );
              })}
            </div>
          </fieldset>
          <Button
            type="submit"
            variant="outline"
            size="sm"
            className="h-auto w-full py-1.5 font-mono text-[11px] whitespace-normal"
            disabled={disabled || columns.length === 0}
          >
            <Plus className="size-3.5" aria-hidden />
            {columns.length
              ? `CREATE INDEX ON ${table} (${columns.join(", ")})`
              : "Pick columns to build an index"}
          </Button>
        </form>
      </div>
    </Panel>
  );
}

export function SchemaPanel({ rows }: { rows: Record<string, number> | null }) {
  return (
    <Panel>
      <PanelHeader
        level={2}
        title="Schema"
        sub="A TPC-H-shaped database generated in your browser."
      />
      <ul className="divide-border/70 divide-y">
        {TABLE_NAMES.map((t) => (
          <li key={t}>
            <details className="group px-4 py-2">
              <summary className="flex cursor-pointer items-baseline justify-between gap-2 text-sm select-none">
                <span className="font-mono">{t}</span>
                <span className="text-muted-foreground font-mono text-[11px]">
                  {rows ? `${formatInt(rows[t])} rows` : "…"}
                </span>
              </summary>
              <ul className="mt-2 space-y-0.5 pb-1 font-mono text-[11px]">
                {SCHEMA[t].columns.map((c) => (
                  <li
                    key={c.name}
                    className="text-muted-foreground flex items-center justify-between gap-2"
                  >
                    <span className="text-foreground/90 flex items-center gap-1.5">
                      {c.name === SCHEMA[t].primaryKey && (
                        <KeyRound className="text-amber-ink size-3" aria-label="primary key" />
                      )}
                      {c.name}
                    </span>
                    <span>{c.type}</span>
                  </li>
                ))}
              </ul>
              <p className="text-muted-foreground pb-1 text-[11px]">{SCHEMA[t].blurb}</p>
            </details>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
