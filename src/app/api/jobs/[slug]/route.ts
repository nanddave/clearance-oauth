import { getJob } from "@/lib/jobs";

export async function GET(_req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const job = getJob((await ctx.params).slug);
  return job ? Response.json(job) : Response.json({ error: "No such job" }, { status: 404 });
}
