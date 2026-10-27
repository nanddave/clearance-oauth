import { runGeneration } from "../agents/pipeline";
import type { AgentEvent, AgentImpls } from "../agents/types";
import { kvGet, kvSet } from "./kv";
import type { Guide } from "./schema";

export type Job = { status: "running" | "done" | "failed"; events: AgentEvent[]; guide?: Guide };

const TTL = 7 * 86400; // generated guides are kept a week
const key = (slug: string) => `job:${slug}`;

export const getJob = (slug: string) => kvGet<Job>(key(slug));

/** A running job or one that produced a guide is reused; a failed or guide-less job is replaced on retry. */
export const isReusable = (job: Job | undefined): job is Job => !!job && (job.status === "running" || (job.status === "done" && !!job.guide));

/**
 * Saves the running job, then returns the pipeline promise (never rejects).
 * Every event re-saves the job so a poll from another instance sees progress; writes are chained to keep order.
 */
export async function startJob(slug: string, query: string, deps?: AgentImpls): Promise<() => Promise<void>> {
  const job: Job = { status: "running", events: [] };
  let saving = kvSet(key(slug), job, TTL);
  await saving;
  const save = () => (saving = saving.then(() => kvSet(key(slug), job, TTL)).catch((e) => console.error("job save failed", slug, e)));
  return () =>
    runGeneration(query, (e) => (job.events.push(e), save()), deps)
      .then(
        (guide) => {
          job.guide = guide;
          job.status = "done";
        },
        (err) => {
          job.status = "failed";
          job.events.push({ agent: "verifier", model: "code", message: `Run failed: ${err instanceof Error ? err.message : "unknown error"}`, at: Date.now() });
          console.error("generation failed", slug, err);
        },
      )
      .then(() => save());
}
