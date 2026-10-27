import { after } from "next/server";
import { z } from "zod";
import { toSlug } from "@/agents/slug";
import { getGuide } from "@/lib/guides";
import { claimRun, getJob, isReusable, releaseRun, startJob } from "@/lib/jobs";
import { addSpend, clientIp, overBudget, rateLimit, reserveSpend, RUN_RESERVE_USD } from "@/lib/limits";

export const maxDuration = 300; // research runs in after(), inside this limit

const Body = z.object({ query: z.string().trim().min(1).max(100) });

export async function POST(req: Request) {
  const body = Body.safeParse(await req.json().catch(() => null));
  if (!body.success) return Response.json({ error: "Invalid request body" }, { status: 400 });
  const slug = toSlug(body.data.query);
  if (!slug) return Response.json({ error: "Could not make a name from that" }, { status: 400 });
  if (getGuide(slug)) return Response.json({ slug, status: "done", reviewed: true });
  const existing = await getJob(slug);
  if (isReusable(existing)) return Response.json({ slug, status: existing.status });
  if (await overBudget()) return Response.json({ error: "Today's research budget is used up. Try again tomorrow." }, { status: 429 });
  // claim before spending a rate-limit token: a click that loses the race costs the user nothing
  if (!(await claimRun(slug))) return Response.json({ slug, status: (await getJob(slug))?.status ?? "running" });
  if (!(await rateLimit("generate", clientIp(req), 3, 3600))) {
    await releaseRun(slug);
    return Response.json({ error: "You've started 3 researches this hour. Try again later." }, { status: 429 });
  }
  // reserve now so parallel starts see it; released when the run ends (the 240 s run deadline ends it before the 300 s kill)
  const day = await reserveSpend(RUN_RESERVE_USD);
  const release = () => Promise.all([addSpend(-RUN_RESERVE_USD, day), releaseRun(slug)]);
  let run: () => Promise<void>;
  try {
    run = await startJob(slug, body.data.query);
  } catch (e) {
    await release();
    throw e;
  }
  after(() => run().finally(release));
  return Response.json({ slug, status: "running" });
}
