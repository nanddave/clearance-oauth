import { describe, expect, it } from "vitest";
import { getJob, isReusable, startJob } from "./jobs";
import { makeStubs } from "../agents/stubs";

describe("jobs map bound", () => {
  it("evicts the oldest job past 500", async () => {
    const stubs = makeStubs(async () => {});
    for (let i = 0; i < 502; i++) await startJob(`bound-${i}`, `bound-${i}`, stubs);
    expect(getJob("bound-0")).toBeUndefined();
    expect(getJob("bound-501")).toBeDefined();
  });
});

describe("job reuse on retry", () => {
  it("reuses running jobs and jobs with a guide, replaces failed or guide-less ones", () => {
    expect(isReusable(undefined)).toBe(false);
    expect(isReusable({ status: "running", events: [] })).toBe(true);
    expect(isReusable({ status: "failed", events: [] })).toBe(false);
    expect(isReusable({ status: "done", events: [] })).toBe(false);
    const guide = {} as never;
    expect(isReusable({ status: "done", events: [], guide })).toBe(true);
  });

  it("startJob replaces a failed job with a fresh running one", async () => {
    const stubs = makeStubs(async () => {});
    await startJob("retry-me", "retry-me", { ...stubs, scout: async () => { throw new Error("boom"); } });
    expect(getJob("retry-me")?.status).toBe("failed");
    expect(isReusable(getJob("retry-me"))).toBe(false);
    const run = startJob("retry-me", "retry-me", stubs);
    expect(getJob("retry-me")?.status).toBe("running");
    await run;
    expect(getJob("retry-me")?.status).toBe("done");
    expect(isReusable(getJob("retry-me"))).toBe(true);
  });
});
