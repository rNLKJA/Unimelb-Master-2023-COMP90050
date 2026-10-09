import { describe, expect, it } from "vitest";
import type { LabResponse } from "@/workers/protocol";
import { DEFAULT_CONFIG, INITIAL, reducer } from "./state";

const msg = (m: LabResponse) => ({ type: "msg" as const, msg: m });

describe("arena state", () => {
  it("stops for good: late worker messages cannot revive a stopped run", () => {
    let s = reducer(INITIAL, { type: "start", config: DEFAULT_CONFIG });
    expect(s.status).toBe("running");
    s = reducer(s, msg({ type: "status", phase: "Generating the database" }));
    s = reducer(s, { type: "stop" });
    expect(s.status).toBe("stopped");
    const after = reducer(s, msg({ type: "status", phase: "Loading SQLite" }));
    expect(after).toBe(s);
    expect(reducer(s, msg({ type: "arena:done", elapsedMs: 1870 }))).toBe(s);
    expect(reducer(s, msg({ type: "error", message: "late" }))).toBe(s);
  });

  it("a finished run ignores a stray stop", () => {
    let s = reducer(INITIAL, { type: "start", config: DEFAULT_CONFIG });
    s = reducer(s, msg({ type: "arena:done", elapsedMs: 10 }));
    expect(s.status).toBe("done");
    expect(reducer(s, { type: "stop" })).toBe(s);
  });
});
