"use client";

import { Check, KeyRound, LoaderCircle, Sparkles, TriangleAlert, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useMemo, useRef, useState } from "react";
import { AiGeneratedLabel } from "@/components/ai/ai-label";
import { openAiSettings } from "@/components/ai/ai-settings-dialog";
import { Panel, PanelHeader } from "@/components/shared/section";
import { Button } from "@/components/ui/button";
import { useAiSettings } from "@/hooks/use-ai-settings";
import { useLabWorker } from "@/hooks/use-lab-worker";
import {
  appendEntry,
  decisionPatch,
  newId,
  updateDecision,
  type AuditEntry,
} from "@/lib/ai/audit-log";
import {
  PROMPT_VERSION,
  auditValidation,
  buildUserMessage,
  proposeIndexes,
  validateProposal,
  type LlmContext,
  type Proposal,
  type ValidationResult,
} from "@/lib/ai/index-advisor";
import { getKey } from "@/lib/ai/settings";
import { AiError, modelFor, PROVIDER_LABEL, type Provider, type TokenUsage } from "@/lib/ai/types";
import { indexId } from "@/lib/engine/types";
import { formatBytes, formatInt, formatMs } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { LabResponse, LlmContextRequest, LlmPlan } from "@/workers/protocol";

/** "Louvre · static · seed 2023 · 25 rounds · budget 200%". */
export function describeRequest(r: LlmContextRequest): string {
  return [
    r.dataset === "louvre" ? "Louvre" : `TPC-H-like (${r.scale.toUpperCase()})`,
    r.scenario === "drifting" ? `drifting ${r.drift.toFixed(2)}` : r.scenario,
    `seed ${r.seed}`,
    `${r.rounds} rounds`,
    `budget ${Math.round(r.budget * 100)}%`,
  ].join(" · ");
}

type Phase =
  | { kind: "idle" }
  | { kind: "context" }
  | { kind: "calling"; model: string }
  | {
      kind: "proposed";
      auditId: string;
      proposal: Proposal;
      validation: ValidationResult;
      model: string;
      provider: Provider;
      latencyMs: number;
      usage: TokenUsage | null;
      fallbackUsed: boolean;
      budgetBytes: number;
      /** The settings the model was shown. */
      request: LlmContextRequest;
      /** Whether the call reached the audit log; a proposal that did not cannot be accepted. */
      logged: boolean;
    }
  | { kind: "error"; message: string; keyProblem: boolean };

/**
 * Ask the visitor's own LLM for an index configuration, show it labelled as
 * AI-generated with the validator's verdict, and let the person accept, edit
 * (untick indexes) or reject it. Every call and decision goes to the audit log.
 */
export function LlmAdvisorPanel({
  request,
  plan,
  onPlan,
  level = 3,
}: {
  request: LlmContextRequest;
  plan: LlmPlan | null;
  onPlan: (plan: LlmPlan | null) => void;
  level?: 2 | 3;
}) {
  const { settings, hasKey } = useAiSettings();
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const abort = useRef<AbortController | null>(null);
  /** The settings the pending request was built from. */
  const asked = useRef<LlmContextRequest>(request);

  const ask = useCallback(
    async (context: LlmContext) => {
      const askedFor = asked.current;
      const key = getKey(settings.provider);
      const model = modelFor(settings);
      const id = newId();
      const timestamp = new Date().toISOString();
      const message = buildUserMessage(context);
      const base: Omit<AuditEntry, "output" | "latencyMs" | "decision"> = {
        id,
        kind: "call",
        timestamp,
        feature: "llm-index-advisor",
        provider: settings.provider,
        model,
        input: {
          promptVersion: PROMPT_VERSION,
          dataset: context.dataset,
          scenario: context.scenario,
          seed: context.seed,
          rounds: context.rounds,
          budgetBytes: context.budgetBytes,
          message,
        },
      };
      setPhase({ kind: "calling", model });
      const controller = new AbortController();
      abort.current = controller;
      try {
        const { result } = await proposeIndexes(context, settings, key, {
          signal: controller.signal,
        });
        const validation = validateProposal(result.data, context.stats, {
          budgetBytes: context.budgetBytes,
        });
        const logged = await appendEntry(
          {
            ...base,
            servedModel: result.servedModel,
            fallbackUsed: result.fallbackUsed,
            output: { indexes: result.data.indexes, notes: result.data.notes },
            validation: auditValidation(validation),
            latencyMs: result.latencyMs,
            usage: result.usage,
            decision: "pending",
          },
          [key],
        ).then(
          () => true,
          () => false,
        );
        setSelected(new Set(validation.accepted.map((a) => indexId(a.index))));
        setPhase({
          kind: "proposed",
          auditId: id,
          proposal: result.data,
          validation,
          model: result.servedModel || model,
          provider: settings.provider,
          latencyMs: result.latencyMs,
          usage: result.usage,
          fallbackUsed: result.fallbackUsed,
          budgetBytes: context.budgetBytes,
          request: askedFor,
          logged,
        });
      } catch (e) {
        const err = e instanceof AiError ? e : new AiError("network", { detail: String(e) });
        // Every call that left the browser is logged, cancelled ones included: a
        // request cancelled after it reached the provider can still be billed.
        const logged =
          err.kind === "no_key" ||
          (await appendEntry(
            {
              ...base,
              output: {},
              latencyMs: err.latencyMs ?? 0,
              usage: err.usage,
              decision: "not-applicable",
              error: err.message,
              errorKind: err.kind,
            },
            [key],
          ).then(
            () => true,
            () => false,
          ));
        const unlogged = logged ? "" : " This call could not be written to the audit log.";
        setPhase(
          err.kind === "aborted"
            ? logged
              ? { kind: "idle" }
              : { kind: "error", message: `Cancelled.${unlogged}`, keyProblem: false }
            : {
                kind: "error",
                message: `${err.message}${unlogged}`,
                keyProblem: err.kind === "no_key" || err.kind === "invalid_key",
              },
        );
      } finally {
        abort.current = null;
      }
    },
    [settings],
  );

  const onMessage = useCallback(
    (msg: LabResponse) => {
      if (msg.type === "llm:context") void ask(msg.context);
      else if (msg.type === "error")
        setPhase({ kind: "error", message: msg.message, keyProblem: false });
    },
    [ask],
  );
  const { post, restart } = useLabWorker(onMessage);

  const start = () => {
    asked.current = request;
    setPhase({ kind: "context" });
    post({ type: "llm:context", request });
  };
  const cancel = () => {
    abort.current?.abort();
    restart();
    setPhase({ kind: "idle" });
  };

  const decide = async (decision: "accepted" | "edited" | "rejected") => {
    if (phase.kind !== "proposed") return;
    const chosen = phase.validation.accepted.filter((a) => selected.has(indexId(a.index)));
    const finalConfig = decision === "rejected" ? [] : chosen.map((a) => indexId(a.index));
    const recorded = await updateDecision(
      phase.auditId,
      decisionPatch(decision, finalConfig),
    ).catch(() => false);
    if (!recorded && decision !== "rejected") {
      // No audit record, no build: the decision has to be on the record first.
      setPhase({
        kind: "error",
        message:
          "Your decision could not be written to the audit log, so the proposal was not applied. Check that this browser allows site storage (IndexedDB) and ask again.",
        keyProblem: false,
      });
      return;
    }
    onPlan(
      decision === "rejected"
        ? null
        : {
            config: chosen.map((a) => a.index),
            latencyMs: phase.latencyMs,
            auditId: phase.auditId,
            model: phase.model,
            provider: phase.provider,
            request: phase.request,
          },
    );
    setPhase({ kind: "idle" });
  };

  const busy = phase.kind === "context" || phase.kind === "calling";
  const proposed = phase.kind === "proposed" ? phase : null;
  const chosenBytes = useMemo(
    () =>
      proposed
        ? proposed.validation.accepted
            .filter((a) => selected.has(indexId(a.index)))
            .reduce((s, a) => s + a.bytes, 0)
        : 0,
    [proposed, selected],
  );
  const allChosen = proposed ? selected.size === proposed.validation.accepted.length : false;

  return (
    <Panel id="llm" className="scroll-mt-20">
      <PanelHeader
        level={level}
        title="LLM index advisor (your key)"
        sub={
          <>
            Optional. Your {PROVIDER_LABEL[settings.provider]} key proposes indexes from the schema,
            a summary of round 1 and SQLite&apos;s current plans. The lab validates them and builds
            only valid indexes, at the start of round 2. See the{" "}
            <Link href="/methods#ai-use" className="text-foreground decoration-mint underline">
              AI use statement
            </Link>
            .
          </>
        }
      />
      <div className="space-y-4 p-4 sm:p-5">
        {plan && !proposed ? (
          <div className="border-mint/40 bg-mint-soft/30 rounded-lg border p-3 text-sm">
            <p className="flex flex-wrap items-center gap-2">
              <Check className="text-mint size-4" aria-hidden />
              <span>
                Approved: {plan.config.length} index{plan.config.length === 1 ? "" : "es"} from
              </span>
              <AiGeneratedLabel model={plan.model} />
            </p>
            <p className="text-muted-foreground mt-1 font-mono text-xs break-words">
              {plan.config.map(indexId).join(" · ") || "no indexes"}
            </p>
            <p className="text-muted-foreground mt-1 text-xs">
              Proposed for {describeRequest(plan.request)}. Changing any of these settings discards
              it, because the model never saw that data or workload.
            </p>
            <p className="text-muted-foreground mt-1 text-xs">
              Charged {formatMs(plan.latencyMs)} of recommendation time (the provider&apos;s
              response time).{" "}
              <button
                type="button"
                className="text-foreground decoration-mint underline"
                onClick={() => onPlan(null)}
              >
                Discard
              </button>
            </p>
          </div>
        ) : null}

        {!hasKey ? (
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <p className="text-muted-foreground">
              No key in this browser. Everything else works without one.
            </p>
            <Button variant="outline" onClick={openAiSettings}>
              <KeyRound aria-hidden /> Add your key
            </Button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={start} disabled={busy}>
              {busy ? (
                <LoaderCircle className="animate-spin" aria-hidden />
              ) : (
                <Sparkles aria-hidden />
              )}
              {plan ? "Ask again" : "Ask for a proposal"}
            </Button>
            {busy ? (
              <>
                <span className="text-muted-foreground text-sm" role="status">
                  {phase.kind === "context"
                    ? "Building the context (schema, round 1, plans)…"
                    : `Waiting for ${phase.kind === "calling" ? phase.model : "the model"}…`}
                </span>
                <Button variant="ghost" onClick={cancel}>
                  Cancel
                </Button>
              </>
            ) : (
              <span className="text-muted-foreground font-mono text-xs">
                {modelFor(settings)} · one call, billed to your key
              </span>
            )}
          </div>
        )}

        {phase.kind === "error" ? (
          <div role="alert" className="border-coral/50 rounded-lg border p-3 text-sm">
            <p className="flex items-center gap-2 font-medium">
              <TriangleAlert className="text-coral size-4" aria-hidden /> The proposal failed
            </p>
            <p className="text-muted-foreground mt-1">{phase.message}</p>
            {phase.keyProblem ? (
              <Button variant="outline" className="mt-2" onClick={openAiSettings}>
                Open AI settings
              </Button>
            ) : null}
          </div>
        ) : null}

        {proposed ? (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <AiGeneratedLabel model={proposed.model} />
              <span className="text-muted-foreground font-mono">
                {formatMs(proposed.latencyMs)}
                {proposed.usage
                  ? ` · ${formatInt(proposed.usage.inputTokens)} in / ${formatInt(proposed.usage.outputTokens)} out tokens`
                  : ""}
                {proposed.fallbackUsed ? " · answered by the fallback model" : ""}
              </span>
            </div>
            {proposed.proposal.notes ? (
              <p className="text-muted-foreground text-sm">{proposed.proposal.notes}</p>
            ) : null}
            <fieldset>
              <legend className="kicker mb-1.5">
                Valid indexes ({proposed.validation.accepted.length} of{" "}
                {proposed.validation.proposed}) · untick any you do not want built
              </legend>
              {proposed.validation.accepted.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  None of the proposed indexes passed.
                </p>
              ) : (
                <ul className="grid gap-1.5">
                  {proposed.validation.accepted.map((a) => {
                    const id = indexId(a.index);
                    const on = selected.has(id);
                    return (
                      <li key={id}>
                        <label
                          className={cn(
                            "border-border hover:bg-surface-2/60 flex cursor-pointer items-start gap-2.5 rounded-md border px-3 py-2 text-sm",
                            !on && "opacity-60",
                          )}
                        >
                          <input
                            type="checkbox"
                            checked={on}
                            onChange={() =>
                              setSelected((s) => {
                                const n = new Set(s);
                                if (n.has(id)) n.delete(id);
                                else n.add(id);
                                return n;
                              })
                            }
                            className="mt-1 size-4 accent-[var(--mint)]"
                          />
                          <span className="min-w-0">
                            <span className="font-mono text-xs break-words">{id}</span>
                            <span className="text-muted-foreground ml-2 font-mono text-[11px]">
                              ~{formatBytes(a.bytes)}
                            </span>
                            <span className="text-muted-foreground block text-xs">
                              {a.rationale}
                            </span>
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              )}
            </fieldset>
            {proposed.validation.rejected.length ? (
              <div>
                <p className="kicker mb-1.5">Rejected by the validator</p>
                <ul className="grid gap-1 text-sm">
                  {proposed.validation.rejected.map((r, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <X className="text-coral mt-0.5 size-3.5 shrink-0" aria-hidden />
                      <span className="min-w-0">
                        <span className="font-mono text-xs break-words">
                          {r.table}({r.columns.join(", ")})
                        </span>
                        <span className="text-muted-foreground"> · {r.detail}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {!proposed.logged ? (
              <p role="alert" className="border-coral/50 rounded-lg border p-3 text-sm">
                <TriangleAlert className="text-coral mr-1.5 inline size-4" aria-hidden />
                This call could not be written to the audit log (this browser may block site
                storage), so it cannot be accepted. Nothing will be built from it.
              </p>
            ) : null}
            <p className="text-muted-foreground text-xs">
              Made for {describeRequest(proposed.request)}. Accepting returns the settings to these
              if you have changed them since.
            </p>
            <div className="border-border flex flex-wrap items-center gap-2 border-t pt-3">
              <Button
                onClick={() => decide(allChosen ? "accepted" : "edited")}
                disabled={selected.size === 0 || !proposed.logged}
              >
                <Check aria-hidden />
                {allChosen ? "Accept" : `Accept ${selected.size} (edited)`}
              </Button>
              <Button variant="outline" onClick={() => decide("rejected")}>
                Reject
              </Button>
              <span className="text-muted-foreground font-mono text-xs">
                {formatBytes(chosenBytes)} of the {formatBytes(proposed.budgetBytes)} budget ·
                recorded in the{" "}
                <Link href="/ai-log" className="text-foreground decoration-mint underline">
                  audit log
                </Link>
              </span>
            </div>
          </div>
        ) : null}
      </div>
    </Panel>
  );
}
