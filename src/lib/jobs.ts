import { runGeneration } from "../agents/pipeline";
import type { AgentEvent, AgentImpls } from "../agents/types";
import { kvDel, kvGet, kvSet, kvSetNx } from "./kv";
import type { Guide } from "./schema";

export type Job = { status: "running" | "done" | "failed"; events: AgentEvent[]; guide?: Guide; query?: string; startedAt?: number; pipeline?: number };

/** Bump when research changes enough that older guides should be redone (4: rerun after the Composio key fix). */
export const PIPELINE = 4;

const LOG_TTL = 7 * 86400; // run logs are kept a week
const GUIDE_TTL = 180 * 86400; // finished guides are kept so share links keep working
export const STALE_MS = 6 * 60_000; // longer than any run (240 s deadline): a "running" job this old died
const key = (slug: string) => `job:${slug}`;

/** A job whose function died mid-run would read "running" forever; past STALE_MS it reads as failed. */
export async function getJob(slug: string): Promise<Job | undefined> {
  const job = (await kvGet<Job>(key(slug))) ?? (await kvGet<Job>(`guide:${slug}`));
  if (job?.status === "running" && Date.now() - (job.startedAt ?? 0) > STALE_MS)
    return { ...job, status: "failed", events: [...job.events, { agent: "verifier", model: "code", message: "Run stopped without finishing", at: Date.now() }] };
  return job;
}

/** The last finished guide, kept apart from the job so a refresh in progress (or failed) never hides it. */
export const getSavedGuide = async (slug: string) => (await kvGet<Job>(`guide:${slug}`))?.guide;

const REFRESH_MS = 30 * 86400_000; // research older than this is redone on the next request; the old link keeps working until then

/** A running job or a recent guide from this pipeline is reused; a failed, guide-less, month-old or older-pipeline job is replaced on request. */
export const isReusable = (job: Job | undefined): job is Job =>
  !!job &&
  (job.status === "running" ||
    (job.status === "done" && !!job.guide && job.pipeline === PIPELINE && Date.now() - Date.parse(job.guide.updatedAt) < REFRESH_MS));

/** Only one research run per app at a time, across instances. */
export const claimRun = (slug: string) => kvSetNx(`lease:${slug}`, 1, Math.ceil(STALE_MS / 1000));
/** Released when a run ends, so a retry after a failure can start at once; the TTL covers runs that die. */
export const releaseRun = (slug: string) => kvDel(`lease:${slug}`);

/**
 * Saves the running job, then returns the pipeline promise (never rejects).
 * Every event re-saves the job so a poll from another instance sees progress; writes are chained to keep order.
 */
export async function startJob(slug: string, query: string, deps?: AgentImpls): Promise<() => Promise<void>> {
  const job: Job = { status: "running", events: [], query, startedAt: Date.now(), pipeline: PIPELINE };
  let saving = kvSet(key(slug), job, LOG_TTL);
  await saving;
  const save = () =>
    (saving = saving
      .then(() => kvSet(key(slug), job, LOG_TTL))
      .then(() => (job.status === "done" ? kvSet(`guide:${slug}`, job, GUIDE_TTL) : undefined))
      .catch((e) => console.error("job save failed", slug, e)));
  return () =>
    runGeneration(query, (e) => (job.events.push(e), save()), deps)
      .then(
        (guide) => {
          job.guide = guide;
          job.status = "done";
        },
        (err) => {
          job.status = "failed";
          const last = job.events.at(-1);
          job.events.push({ agent: last?.agent ?? "resolver", model: last?.model ?? "code", message: `Run failed: ${err instanceof Error ? err.message : "unknown error"}`, at: Date.now() });
          console.error("generation failed", slug, err);
        },
      )
      .then(() => save());
}
