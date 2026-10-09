"use client";

import { Download, Trash2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AiGeneratedLabel } from "@/components/ai/ai-label";
import { Panel } from "@/components/shared/section";
import { Button } from "@/components/ui/button";
import {
  auditCounts,
  clearEntries,
  entriesToCsv,
  entriesToJson,
  listEntries,
  onAuditChange,
  type AuditEntry,
} from "@/lib/ai/audit-log";
import { invalidRates } from "@/lib/ai/index-advisor";
import { download } from "@/lib/csv";
import { formatBytes, formatInt, formatMs } from "@/lib/format";
import { cn } from "@/lib/utils";
import { formatInterval, pctChange } from "@/lib/stats/format";

const DECISION_STYLE: Record<AuditEntry["decision"], string> = {
  pending: "border-amber/60 text-amber-ink",
  accepted: "border-mint/60 text-mint",
  edited: "border-sky/60 text-sky",
  rejected: "border-coral/60 text-coral",
  "not-applicable": "border-border text-muted-foreground",
};

function Stat({ label, value, sub }: { label: string; value: React.ReactNode; sub?: string }) {
  return (
    <div>
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="font-display tabular text-3xl font-semibold">{value}</dd>
      {sub ? <dd className="text-muted-foreground font-mono text-[11px]">{sub}</dd> : null}
    </div>
  );
}

export function AuditLogView() {
  const [entries, setEntries] = useState<AuditEntry[] | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    const load = () =>
      listEntries()
        .then((e) => {
          setEntries(e);
          setFailed(null);
        })
        .catch((e: Error) => setFailed(e.message));
    load();
    return onAuditChange(load);
  }, []);

  const counts = useMemo(() => auditCounts(entries ?? []), [entries]);
  const rates = useMemo(() => invalidRates(entries ?? []), [entries]);
  const children = useMemo(() => {
    const m = new Map<string, AuditEntry[]>();
    for (const e of entries ?? [])
      if (e.parentId) m.set(e.parentId, [...(m.get(e.parentId) ?? []), e]);
    return m;
  }, [entries]);

  if (failed) {
    return (
      <Panel role="alert" className="p-5 text-sm">
        The audit log could not be opened in this browser ({failed}). Private windows in some
        browsers block IndexedDB.
      </Panel>
    );
  }
  if (!entries) {
    return <Panel className="h-40 animate-pulse" aria-label="Loading the audit log" />;
  }
  const calls = entries.filter((e) => e.kind === "call");

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <dl className="flex flex-wrap gap-x-10 gap-y-4">
          <Stat label="AI calls recorded" value={counts.calls} />
          <Stat label="Tokens reported" value={formatInt(counts.tokens)} />
          <Stat
            label="Proposals with a human decision"
            value={`${counts.decided} / ${counts.proposals}`}
          />
          <Stat
            label="Proposed indexes rejected by the validator"
            value={rates.indexes.n > 0 ? `${(rates.indexes.estimate * 100).toFixed(0)}%` : "–"}
            sub={
              rates.indexes.n > 0
                ? `${rates.indexes.k} of ${rates.indexes.n} · 95% CI ${formatInterval(rates.indexes, (x) => `${(x * 100).toFixed(0)}%`)}`
                : "no proposals yet"
            }
          />
        </dl>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            disabled={!entries.length}
            onClick={() =>
              download("sddb-ai-audit-log.json", entriesToJson(entries), "application/json")
            }
          >
            <Download aria-hidden /> JSON
          </Button>
          <Button
            variant="outline"
            disabled={!entries.length}
            onClick={() => download("sddb-ai-audit-log.csv", entriesToCsv(entries), "text/csv")}
          >
            <Download aria-hidden /> CSV
          </Button>
          {confirming ? (
            <>
              <Button
                variant="destructive"
                onClick={() => {
                  void clearEntries();
                  setConfirming(false);
                }}
              >
                Delete all {entries.length}
              </Button>
              <Button variant="ghost" onClick={() => setConfirming(false)}>
                Keep
              </Button>
            </>
          ) : (
            <Button variant="ghost" disabled={!entries.length} onClick={() => setConfirming(true)}>
              <Trash2 aria-hidden /> Clear
            </Button>
          )}
        </div>
      </div>

      {calls.length === 0 ? (
        <Panel className="p-8 text-center text-sm">
          <p className="text-muted-foreground">Nothing recorded in this browser yet.</p>
          <p className="text-muted-foreground mt-1">
            Records appear here when you ask the LLM index advisor for a proposal in the{" "}
            <Link href="/arena" className="text-foreground decoration-mint underline">
              arena
            </Link>{" "}
            or the{" "}
            <Link href="/benchmark#llm" className="text-foreground decoration-mint underline">
              benchmark
            </Link>{" "}
            with your own key.
          </p>
        </Panel>
      ) : (
        <ol className="space-y-3">
          {calls.map((e) => (
            <li key={e.id}>
              <Panel className="p-4">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="text-muted-foreground font-mono">
                    {new Date(e.timestamp).toLocaleString("en-AU")}
                  </span>
                  <span className="border-border rounded-full border px-2 py-0.5">
                    LLM index advisor · {e.input.dataset === "louvre" ? "Louvre" : "TPC-H-like"} ·{" "}
                    {e.input.scenario}
                  </span>
                  <AiGeneratedLabel model={e.servedModel ?? e.model} />
                  <span
                    className={cn(
                      "rounded-full border px-2 py-0.5 font-medium",
                      DECISION_STYLE[e.decision],
                    )}
                  >
                    {e.decision === "not-applicable" ? "no decision needed" : e.decision}
                  </span>
                  {e.fallbackUsed ? (
                    <span className="border-border rounded-full border px-2 py-0.5">
                      fallback model answered
                    </span>
                  ) : null}
                </div>
                {e.error ? (
                  <p className="text-destructive mt-2 text-sm">{e.error}</p>
                ) : (
                  <p className="mt-2 text-sm">
                    {e.output.indexes?.length ?? 0} indexes proposed ·{" "}
                    <span className="text-mint">{e.validation?.accepted.length ?? 0} valid</span> ·{" "}
                    <span className={e.validation?.rejected.length ? "text-coral" : ""}>
                      {e.validation?.rejected.length ?? 0} rejected
                    </span>
                    {e.finalConfig ? ` · ${e.finalConfig.length} built after review` : ""}
                  </p>
                )}
                {(children.get(e.id) ?? []).map((m) =>
                  m.output.measurement ? (
                    <p key={m.id} className="text-muted-foreground mt-1 text-xs">
                      Measured {new Date(m.timestamp).toLocaleString("en-AU")} over{" "}
                      {m.output.measurement.replicates} replicates (
                      {m.output.measurement.engine === "sqlite" ? "SQLite" : "simulated engine"}).
                      Change in build + run time{" "}
                      {m.output.measurement.comparisons
                        .map(
                          (c) =>
                            `against ${c.against === "mab" ? "the bandit" : "AutoAdmin"} ${pctChange(c.ratio)} (95% CI ${pctChange(c.lower)} to ${pctChange(c.upper)})`,
                        )
                        .join(", ")}
                      .
                    </p>
                  ) : null,
                )}
                <details className="mt-2 text-sm">
                  <summary className="text-mint cursor-pointer">Full record</summary>
                  <div className="mt-3 space-y-3">
                    {e.output.indexes?.length ? (
                      <ul className="space-y-1 font-mono text-xs">
                        {e.output.indexes.map((ix, i) => (
                          <li key={i}>
                            {ix.table}({ix.columns.join(", ")})
                            <span className="text-muted-foreground font-sans">
                              {" "}
                              · {ix.rationale}
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    {e.output.notes ? (
                      <p className="text-muted-foreground text-xs">{e.output.notes}</p>
                    ) : null}
                    <dl className="grid grid-cols-[9rem_minmax(0,1fr)] gap-x-3 gap-y-1 text-xs">
                      <dt className="text-muted-foreground">Provider, model</dt>
                      <dd className="font-mono break-all">
                        {e.provider} · {e.model}
                        {e.servedModel && e.servedModel !== e.model
                          ? ` (served ${e.servedModel})`
                          : ""}
                      </dd>
                      <dt className="text-muted-foreground">Prompt version</dt>
                      <dd className="font-mono">{e.input.promptVersion}</dd>
                      <dt className="text-muted-foreground">Workload</dt>
                      <dd>
                        seed {e.input.seed} · {e.input.rounds} rounds · budget{" "}
                        {formatBytes(e.input.budgetBytes)}
                      </dd>
                      {e.validation?.rejected.length ? (
                        <>
                          <dt className="text-muted-foreground">Rejected</dt>
                          <dd>
                            {e.validation.rejected.map((r) => `${r.index}: ${r.reason}`).join("; ")}
                          </dd>
                        </>
                      ) : null}
                      {e.finalConfig ? (
                        <>
                          <dt className="text-muted-foreground">Built</dt>
                          <dd className="font-mono break-all">
                            {e.finalConfig.join(", ") || "none"}
                          </dd>
                        </>
                      ) : null}
                      <dt className="text-muted-foreground">Latency</dt>
                      <dd>{e.latencyMs ? formatMs(e.latencyMs) : "n/a"}</dd>
                      <dt className="text-muted-foreground">Tokens</dt>
                      <dd>
                        {e.usage
                          ? `${formatInt(e.usage.inputTokens)} in, ${formatInt(e.usage.outputTokens)} out`
                          : "not reported"}
                      </dd>
                      {e.decidedAt ? (
                        <>
                          <dt className="text-muted-foreground">Decided</dt>
                          <dd>{new Date(e.decidedAt).toLocaleString("en-AU")}</dd>
                        </>
                      ) : null}
                      <dt className="text-muted-foreground">Record id</dt>
                      <dd className="font-mono break-all">{e.id}</dd>
                    </dl>
                    <details>
                      <summary className="text-muted-foreground cursor-pointer text-xs">
                        Message sent to the provider
                      </summary>
                      <pre
                        tabIndex={0}
                        className="border-border bg-surface-2/60 mt-2 max-h-80 overflow-auto rounded-md border p-3 font-mono text-[11px] leading-relaxed whitespace-pre-wrap"
                      >
                        {e.input.message}
                      </pre>
                    </details>
                  </div>
                </details>
              </Panel>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
