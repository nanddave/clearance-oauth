import { after } from "next/server";
import { z } from "zod";
import { toSlug } from "@/agents/slug";
import { getGuide } from "@/lib/guides";
import { claimRun, getJob, isReusable, startJob } from "@/lib/jobs";
import { addSpend, clientIp, overBudget, rateLimit, RUN_RESERVE_USD } from "@/lib/limits";

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
  if (!(await rateLimit("generate", clientIp(req), 3, 3600)))
    return Response.json({ error: "You've started 3 researches this hour. Try again later." }, { status: 429 });
  if (await overBudget()) return Response.json({ error: "Today's research budget is used up. Try again tomorrow." }, { status: 429 });
  if (!(await claimRun(slug))) return Response.json({ slug, status: "running" }); // someone else just started it
  await addSpend(RUN_RESERVE_USD); // reserve now so parallel starts see it; the run's real costs are added as they happen
  const run = await startJob(slug, body.data.query);
  after(() => run().finally(() => addSpend(-RUN_RESERVE_USD)));
  return Response.json({ slug, status: "running" });
}
