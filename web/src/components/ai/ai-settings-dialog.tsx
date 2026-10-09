"use client";

import { KeyRound, ShieldCheck, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useAiSettings } from "@/hooks/use-ai-settings";
import {
  applyRemember,
  forgetKeys,
  getKey,
  keyLooksWrong,
  maskKey,
  saveSettings,
  setKey,
} from "@/lib/ai/settings";
import {
  ANTHROPIC_MODELS,
  DEFAULT_OPENAI_MODEL,
  type AiSettings,
  type Provider,
} from "@/lib/ai/types";
import { cn } from "@/lib/utils";

const OPEN_EVENT = "sddb:open-ai-settings";

/** Open the AI settings dialog from anywhere on the page. */
export function openAiSettings() {
  window.dispatchEvent(new Event(OPEN_EVENT));
}

const field =
  "border-input bg-surface focus-visible:ring-ring/40 h-9 w-full rounded-md border px-3 font-mono text-sm focus-visible:ring-2 focus-visible:outline-none";

const option = (on: boolean) =>
  cn(
    "border-border hover:border-mint/60 flex cursor-pointer items-start gap-2 rounded-md border px-3 py-2 text-sm",
    on && "border-mint bg-mint-soft/40",
  );

/** Header button and dialog. Mounted once, in the site header. */
export function AiSettingsDialog() {
  const { settings, hasKey } = useAiSettings();
  const [open, setOpen] = useState(false);
  // the control that opened the dialog from elsewhere on the page ("Add your key")
  const opener = useRef<HTMLElement | null>(null);
  const pathname = usePathname();
  const [shownOn, setShownOn] = useState(pathname);

  // following a link inside the dialog (or any navigation) closes it
  if (pathname !== shownOn) {
    setShownOn(pathname);
    if (open) setOpen(false);
  }

  useEffect(() => {
    const onOpen = () => {
      opener.current =
        document.activeElement instanceof HTMLElement ? document.activeElement : null;
      setOpen(true);
    };
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_EVENT, onOpen);
  }, []);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <button
            type="button"
            className="text-muted-foreground hover:border-border hover:bg-surface-2 hover:text-foreground relative inline-flex h-9 items-center justify-center gap-1.5 rounded-md border border-transparent px-2 text-sm transition-colors"
            aria-label={
              hasKey
                ? "AI settings (your key is set)"
                : "AI settings (optional, bring your own key)"
            }
            title="AI settings"
          />
        }
      >
        <KeyRound className="size-4" aria-hidden />
        <span className="hidden font-mono text-xs sm:inline">AI</span>
        {hasKey ? (
          <span className="bg-mint absolute top-1.5 right-1 size-1.5 rounded-full" aria-hidden />
        ) : null}
      </DialogTrigger>
      {open ? (
        <SettingsBody
          initial={settings}
          onDone={() => setOpen(false)}
          finalFocus={() => {
            const el = opener.current;
            opener.current = null;
            return el && el.isConnected ? el : true;
          }}
        />
      ) : null}
    </Dialog>
  );
}

function SettingsBody({
  initial,
  onDone,
  finalFocus,
}: {
  initial: AiSettings;
  onDone: () => void;
  finalFocus: () => HTMLElement | boolean;
}) {
  const ids = { key: useId(), model: useId(), remember: useId(), fallback: useId(), help: useId() };
  const [draft, setDraft] = useState<AiSettings>(initial);
  const [keyDraft, setKeyDraft] = useState("");
  // only ever rendered in the browser, after the dialog opens
  const [stored, setStored] = useState<Record<Provider, string | null>>(() => ({
    anthropic: getKey("anthropic"),
    openai: getKey("openai"),
  }));
  const [status, setStatus] = useState<string | null>(null);
  const current = stored[draft.provider];
  const wrongProvider = keyLooksWrong(draft.provider, keyDraft);

  const save = () => {
    const next = { ...draft, openaiModel: draft.openaiModel.trim() || DEFAULT_OPENAI_MODEL };
    saveSettings(next);
    if (keyDraft.trim()) setKey(next.provider, keyDraft, next.remember);
    applyRemember(next.remember); // re-file every provider's key under the new "remember" choice
    setKeyDraft("");
    setStored({ anthropic: getKey("anthropic"), openai: getKey("openai") });
    onDone();
  };

  const forget = () => {
    forgetKeys();
    setStored({ anthropic: null, openai: null });
    setKeyDraft("");
    setStatus("Keys removed from this browser.");
  };

  return (
    <DialogContent
      className="bg-surface max-h-[92dvh] overflow-y-auto sm:max-w-lg"
      aria-describedby={ids.help}
      finalFocus={finalFocus}
    >
      <DialogHeader>
        <p className="kicker text-mint">Optional · bring your own key</p>
        <DialogTitle className="font-display text-2xl font-semibold">AI settings</DialogTitle>
        <DialogDescription id={ids.help}>
          The LLM index advisor uses your own API key. It stays in this browser and is sent only to
          the provider you pick, directly from your browser. This site has no server that could
          receive it, and everything else on the site works without a key.
        </DialogDescription>
      </DialogHeader>

      <fieldset className="space-y-2">
        <legend className="mb-2 text-sm font-medium">Provider</legend>
        <div className="grid grid-cols-2 gap-2">
          {(["anthropic", "openai"] as const).map((p) => (
            <label key={p} className={cn(option(draft.provider === p), "items-center")}>
              <input
                type="radio"
                name="provider"
                value={p}
                checked={draft.provider === p}
                onChange={() => setDraft({ ...draft, provider: p })}
                className="accent-[var(--mint)]"
              />
              {p === "anthropic" ? "Anthropic (default)" : "OpenAI"}
            </label>
          ))}
        </div>
      </fieldset>

      {draft.provider === "anthropic" ? (
        <fieldset className="space-y-2">
          <legend className="mb-2 text-sm font-medium">Model</legend>
          {ANTHROPIC_MODELS.map((m) => (
            <label key={m.id} className={option(draft.anthropicModel === m.id)}>
              <input
                type="radio"
                name="anthropic-model"
                value={m.id}
                checked={draft.anthropicModel === m.id}
                onChange={() => setDraft({ ...draft, anthropicModel: m.id })}
                className="mt-1 accent-[var(--mint)]"
              />
              <span>
                <span className="font-medium">{m.label}</span>{" "}
                <span className="text-muted-foreground font-mono text-xs">{m.id}</span>
                <span className="text-muted-foreground block text-xs">{m.note}</span>
              </span>
            </label>
          ))}
          {draft.anthropicModel === "claude-sonnet-5-5" ? (
            <label htmlFor={ids.fallback} className="flex items-start gap-2 pt-1 text-sm">
              <input
                id={ids.fallback}
                type="checkbox"
                checked={draft.allowFallback}
                onChange={(e) => setDraft({ ...draft, allowFallback: e.target.checked })}
                className="mt-0.5 size-4 accent-[var(--mint)]"
              />
              <span>
                Allow Anthropic&apos;s refusal fallback
                <span className="text-muted-foreground block text-xs">
                  If Sonnet declines on safety grounds, Anthropic may re-run the request on another
                  Claude model, which can cost more. The audit log and the evaluation record which
                  model answered.
                </span>
              </span>
            </label>
          ) : null}
        </fieldset>
      ) : (
        <div className="space-y-1.5">
          <label htmlFor={ids.model} className="text-sm font-medium">
            Model id
          </label>
          <input
            id={ids.model}
            value={draft.openaiModel}
            onChange={(e) => setDraft({ ...draft, openaiModel: e.target.value })}
            spellCheck={false}
            autoComplete="off"
            className={field}
          />
          <p className="text-muted-foreground text-xs">
            Any chat model your key can use that supports structured outputs (default{" "}
            <code className="font-mono">{DEFAULT_OPENAI_MODEL}</code>).
          </p>
        </div>
      )}

      <div className="space-y-1.5">
        <label htmlFor={ids.key} className="text-sm font-medium">
          {draft.provider === "anthropic" ? "Anthropic" : "OpenAI"} API key
        </label>
        <input
          id={ids.key}
          type="password"
          value={keyDraft}
          onChange={(e) => setKeyDraft(e.target.value)}
          placeholder={
            current
              ? `Stored: ${maskKey(current)}`
              : draft.provider === "anthropic"
                ? "sk-ant-…"
                : "sk-…"
          }
          autoComplete="off"
          spellCheck={false}
          data-1p-ignore
          data-lpignore="true"
          aria-invalid={wrongProvider || undefined}
          className={field}
        />
        {wrongProvider ? (
          <p className="text-destructive flex items-center gap-1.5 text-xs" role="alert">
            <TriangleAlert className="size-3.5" aria-hidden /> This looks like a key for the other
            provider.
          </p>
        ) : null}
        <label htmlFor={ids.remember} className="flex items-start gap-2 pt-1 text-sm">
          <input
            id={ids.remember}
            type="checkbox"
            checked={draft.remember}
            onChange={(e) => setDraft({ ...draft, remember: e.target.checked })}
            className="mt-0.5 size-4 accent-[var(--mint)]"
          />
          <span>
            Remember on this device
            <span className="text-muted-foreground block text-xs">
              Off: kept for this tab only (sessionStorage). On: kept in this browser profile
              (localStorage) until you forget it.
            </span>
          </span>
        </label>
      </div>

      <div className="border-border bg-surface-2/60 flex gap-2 rounded-md border p-3 text-xs leading-relaxed">
        <ShieldCheck className="text-mint mt-0.5 size-4 shrink-0" aria-hidden />
        <p className="text-muted-foreground [&_a]:text-foreground [&_a]:decoration-mint [&_a]:underline [&_a]:underline-offset-2">
          The provider bills calls to your key, and one proposal is one call. Every call is recorded
          in an{" "}
          <Link href="/ai-log" onClick={onDone}>
            audit log
          </Link>{" "}
          kept only in this browser, without the key. Read the{" "}
          <Link href="/methods#ai-use" onClick={onDone}>
            AI use statement
          </Link>
          .
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button
          variant="destructive"
          onClick={forget}
          disabled={!stored.anthropic && !stored.openai}
        >
          Forget key
        </Button>
        <div className="flex items-center gap-3">
          {status ? (
            <span role="status" className="text-muted-foreground text-xs">
              {status}
            </span>
          ) : null}
          <Button onClick={save} disabled={wrongProvider}>
            Save
          </Button>
        </div>
      </div>
    </DialogContent>
  );
}
