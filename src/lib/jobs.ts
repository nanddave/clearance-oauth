import { runGeneration } from "../agents/pipeline";
import type { AgentEvent, AgentImpls } from "../agents/types";
import type { Guide } from "./schema";

export type Job = { status: "running" | "done" | "failed"; events: AgentEvent[]; guide?: Guide };

// shortcut: in-memory Map, lost on cold start; upgrade to Upstash Redis when deploying.
const g = globalThis as unknown as { __clearanceJobs?: Map<string, Job> };
const jobs = (g.__clearanceJobs ??= new Map<string, Job>());

export const getJob = (slug: string): Job | undefined => jobs.get(slug);

/** A running job or one that produced a guide is reused; a failed or guide-less job is replaced on retry. */
export const isReusable = (job: Job | undefined): job is Job => !!job && (job.status === "running" || (job.status === "done" && !!job.guide));

/** Registers the job synchronously and returns the running pipeline promise (never rejects). */
export function startJob(slug: string, query: string, deps?: AgentImpls): Promise<void> {
  const job: Job = { status: "running", events: [] };
  if (jobs.size > 500) jobs.delete(jobs.keys().next().value!); // shortcut: oldest-inserted eviction, not LRU
  jobs.set(slug, job);
  return runGeneration(query, (e) => job.events.push(e), deps).then(
    (guide) => {
      job.guide = guide;
      job.status = "done";
    },
    (err) => {
      job.status = "failed";
      console.error("generation failed", slug, err);
    },
  );
}
