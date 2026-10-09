import type { Metadata } from "next";
import Link from "next/link";
import { AuditLogView } from "@/components/ai/audit-log-view";

export const metadata: Metadata = {
  title: "AI audit log",
  description:
    "Every LLM index-advisor call made from this browser: the message sent, the provider and model, the proposal, the validator's verdict, latency, tokens, the human decision and the measured outcome. Stored locally, never the key.",
};

export default function AiLogPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <header className="mb-8 max-w-3xl space-y-3">
        <p className="kicker text-mint">Transparency</p>
        <h1 className="text-4xl font-semibold sm:text-5xl">AI audit log</h1>
        <div className="prose-lab">
          <p>
            Every call to a language model made from this browser, newest first: the message sent,
            which model answered, the indexes it proposed, what the validator accepted and rejected,
            how long it took, the tokens it used, what you decided and, once measured, how the
            configuration performed. The log lives only in this browser (IndexedDB). Export it as
            JSON or CSV. API keys are never written to it. See the{" "}
            <Link href="/methods#ai-use">AI use statement</Link>.
          </p>
        </div>
      </header>
      <AuditLogView />
    </div>
  );
}
