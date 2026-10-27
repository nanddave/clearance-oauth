import { describe, expect, it } from "vitest";
import { getJob, isReusable, startJob } from "./jobs";
import { makeStubs } from "../agents/stubs";

const stubs = makeStubs(async () => {});

describe("job reuse on retry", () => {
  it("reuses running jobs and jobs with a guide, replaces failed or guide-less ones", () => {
    expect(isReusable(undefined)).toBe(false);
    expect(isReusable({ status: "running", events: [] })).toBe(true);
    expect(isReusable({ status: "failed", events: [] })).toBe(false);
    expect(isReusable({ status: "done", events: [] })).toBe(false);
    const guide = {} as never;
    expect(isReusable({ status: "done", events: [], guide })).toBe(true);
  });

  it("is saved as running before the pipeline starts, and done after", async () => {
    const run = await startJob("persist-me", "persist-me", stubs);
    expect((await getJob("persist-me"))?.status).toBe("running");
    await run();
    const job = await getJob("persist-me");
    expect(job?.status).toBe("done");
    expect(job?.events.length).toBeGreaterThan(5);
  });

  it("a failing agent fails the job with a log line, and a retry replaces it", async () => {
    await (await startJob("retry-me", "retry-me", { ...stubs, scout: async () => { throw new Error("boom"); } }))();
    const failed = await getJob("retry-me");
    expect(failed?.status).toBe("failed");
    expect(failed?.events.at(-1)?.message).toBe("Run failed: boom");
    await (await startJob("retry-me", "retry-me", stubs))();
    expect(isReusable(await getJob("retry-me"))).toBe(true);
  });
});

describe("leases and stale runs", () => {
  it("only the first claim for an app wins", async () => {
    const { claimRun } = await import("./jobs");
    expect(await claimRun("lease-x")).toBe(true);
    expect(await claimRun("lease-x")).toBe(false);
  });

  it("a run that has been 'running' too long reads as failed, so it can be retried", async () => {
    const { kvSet } = await import("./kv");
    await kvSet("job:dead-run", { status: "running", events: [], startedAt: Date.now() - 10 * 60_000 }, 60);
    const job = await getJob("dead-run");
    expect(job?.status).toBe("failed");
    expect(isReusable(job)).toBe(false);
  });
});
