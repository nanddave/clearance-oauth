import { describe, expect, it } from "vitest";
import { getJob, getSavedGuide, isReusable, PIPELINE, startJob } from "./jobs";
import { makeStubs } from "../agents/stubs";

const stubs = makeStubs(async () => {});

describe("job reuse on retry", () => {
  it("reuses running jobs and jobs with a guide, replaces failed or guide-less ones", () => {
    expect(isReusable(undefined)).toBe(false);
    expect(isReusable({ status: "running", events: [] })).toBe(true);
    expect(isReusable({ status: "failed", events: [] })).toBe(false);
    expect(isReusable({ status: "done", events: [] })).toBe(false);
    const guide = { updatedAt: new Date().toISOString() } as never;
    expect(isReusable({ status: "done", events: [], guide, pipeline: PIPELINE })).toBe(true);
    expect(isReusable({ status: "done", events: [], guide })).toBe(false); // made by an older pipeline: redone
    const old = { updatedAt: "2020-01-01" } as never;
    expect(isReusable({ status: "done", events: [], guide: old, pipeline: PIPELINE })).toBe(false); // month-old research is redone
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
    const { releaseRun } = await import("./jobs");
    await releaseRun("lease-x");
    expect(await claimRun("lease-x")).toBe(true); // a retry after the run ended
  });

  it("a run that has been 'running' too long reads as failed, so it can be retried", async () => {
    const { kvSet } = await import("./kv");
    await kvSet("job:dead-run", { status: "running", events: [], startedAt: Date.now() - 10 * 60_000 }, 60);
    const job = await getJob("dead-run");
    expect(job?.status).toBe("failed");
    expect(isReusable(job)).toBe(false);
  });

  it("a failed refresh keeps the last finished guide reachable", async () => {
    await (await startJob("keep-me", "keep-me", stubs))();
    await (await startJob("keep-me", "keep-me", { ...stubs, scout: async () => { throw new Error("boom"); } }))();
    expect((await getJob("keep-me"))?.status).toBe("failed");
    expect((await getSavedGuide("keep-me"))?.slug).toBe("keep-me");
  });
});
