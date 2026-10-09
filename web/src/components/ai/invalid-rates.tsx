import { REJECT_LABEL, type InvalidRates, type RejectCode } from "@/lib/ai/index-advisor";
import { formatInterval } from "@/lib/stats/format";

const pct = (x: number) => `${(x * 100).toFixed(0)}%`;

/**
 * The LLM advisor's invalid-proposal rates, one row per provider, model,
 * prompt version and dataset, never pooled across them.
 */
export function InvalidRateGroups({ rates }: { rates: InvalidRates }) {
  return (
    <div className="space-y-4 text-sm">
      {rates.groups.length === 0 ? (
        <p className="text-muted-foreground">No answered proposals in this browser yet.</p>
      ) : (
        <ul className="space-y-4">
          {rates.groups.map((g) => (
            <li
              key={g.key}
              className="border-border space-y-2 border-b pb-4 last:border-0 last:pb-0"
            >
              <p className="font-mono text-xs break-all">
                {g.model}
                <span className="text-muted-foreground">
                  {" "}
                  · {g.provider} · prompt {g.promptVersion} ·{" "}
                  {g.dataset === "louvre" ? "Louvre" : "TPC-H-like"}
                </span>
              </p>
              <dl className="grid gap-2">
                <div>
                  <dt className="text-muted-foreground text-xs">
                    Calls with an unusable reply or any rejected index (Wilson)
                  </dt>
                  <dd className="tabular font-mono text-xs">
                    <span className="font-display text-foreground mr-1.5 text-lg font-semibold">
                      {pct(g.calls.estimate)}
                    </span>
                    {g.calls.k} of {g.calls.n} calls · {formatInterval(g.calls, pct)}
                    {g.unusable ? ` · ${g.unusable} unusable` : ""}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground text-xs">
                    Proposed indexes the validator rejected (bootstrap over calls)
                  </dt>
                  <dd className="tabular font-mono text-xs">
                    {g.indexes.proposed > 0 ? (
                      <>
                        <span className="font-display text-foreground mr-1.5 text-lg font-semibold">
                          {pct(g.indexes.estimate)}
                        </span>
                        {g.indexes.rejected} of {g.indexes.proposed} indexes
                        {g.indexes.n > 1 ? ` · ${formatInterval(g.indexes, pct)}` : ""}
                      </>
                    ) : (
                      "no indexes proposed"
                    )}
                  </dd>
                </div>
                {Object.keys(g.byReason).length > 0 ? (
                  <div>
                    <dt className="text-muted-foreground text-xs">Rejections by reason</dt>
                    <dd className="text-xs">
                      {Object.entries(g.byReason)
                        .map(([code, n]) => `${REJECT_LABEL[code as RejectCode] ?? code}: ${n}`)
                        .join(" · ")}
                    </dd>
                  </div>
                ) : null}
              </dl>
            </li>
          ))}
        </ul>
      )}
      <p className="text-muted-foreground text-xs leading-relaxed">
        Calls are the independent unit, so the call-level rate has a Wilson interval. Indexes from
        one reply share its mistakes, so the index-level interval resamples whole calls. Provider,
        network and cancelled calls ({rates.infrastructure}) are left out: they say nothing about
        the model.
      </p>
    </div>
  );
}
