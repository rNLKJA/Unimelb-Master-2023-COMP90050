"use client";

import { useCallback, useEffect, useRef } from "react";
import type { LabRequest, LabResponse } from "@/workers/protocol";

/** One lab Web Worker per component; `restart` terminates a running job. */
export function useLabWorker(onMessage: (msg: LabResponse) => void) {
  const worker = useRef<Worker | null>(null);
  const handler = useRef(onMessage);

  useEffect(() => {
    handler.current = onMessage;
  }, [onMessage]);

  const ensure = useCallback(() => {
    if (!worker.current) {
      const w = new Worker(new URL("../workers/lab.worker.ts", import.meta.url), {
        type: "module",
      });
      w.onmessage = (e: MessageEvent<LabResponse>) => handler.current(e.data);
      w.onerror = (e) =>
        handler.current({ type: "error", message: e.message || "The worker crashed." });
      worker.current = w;
    }
    return worker.current;
  }, []);

  const post = useCallback((req: LabRequest) => ensure().postMessage(req), [ensure]);

  /** Stop the current worker; messages it already queued are dropped. */
  const restart = useCallback(() => {
    const w = worker.current;
    if (w) {
      w.onmessage = null;
      w.onerror = null;
      w.terminate();
    }
    worker.current = null;
  }, []);

  useEffect(() => restart, [restart]);

  return { post, restart };
}
