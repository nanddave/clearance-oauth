import { after } from "next/server";
import { z } from "zod";
import { toSlug } from "@/agents/pipeline";
import { getGuide } from "@/lib/guides";
import { getJob, isReusable, startJob } from "@/lib/jobs";

const Body = z.object({ query: z.string().trim().min(1).max(100) });

export async function POST(req: Request) {
  const body = Body.safeParse(await req.json().catch(() => null));
  if (!body.success) return Response.json({ error: "Invalid request body" }, { status: 400 });
  const slug = toSlug(body.data.query);
  if (!slug) return Response.json({ error: "Could not make a name from that" }, { status: 400 });
  if (getGuide(slug)) return Response.json({ slug, status: "done", reviewed: true });
  const existing = getJob(slug);
  if (isReusable(existing)) return Response.json({ slug, status: existing.status });
  const run = startJob(slug, body.data.query);
  after(() => run);
  return Response.json({ slug, status: "running" });
}
