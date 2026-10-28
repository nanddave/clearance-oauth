import { getGuide } from "@/lib/guides";
import { getJob, getSavedGuide } from "@/lib/jobs";
import { agentView } from "@/lib/next";
import { parseSelection } from "@/lib/selection";

/** Agent view: GET /api/guides/gmail?t.uses=send&have=privacy_policy */
export async function GET(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const job = await getJob(slug);
  const guide = getGuide(slug) ?? (job?.status === "done" ? job.guide : undefined) ?? (job ? await getSavedGuide(slug) : undefined); // same guide the page shows during a refresh
  if (!guide) return Response.json({ error: `No guide for '${slug}'. POST /api/generate to research it.` }, { status: 404 });
  return Response.json(agentView(guide, parseSelection(guide, new URL(req.url).searchParams)));
}
