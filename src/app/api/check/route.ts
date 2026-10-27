import { z } from "zod";
import { getGuide } from "@/lib/guides";
import { clientIp, rateLimit } from "@/lib/limits";
import { checkUrl } from "@/lib/readiness/safe-fetch";
import { runChecks } from "@/lib/readiness/checks";
import type { AutoCheckRule } from "@/lib/schema";

const Body = z.object({ slug: z.string(), homepage: z.string().max(2048) });

export async function POST(req: Request) {
  const body = Body.safeParse(await req.json().catch(() => null));
  if (!body.success) return Response.json({ error: "Invalid request body" }, { status: 400 });
  const guide = getGuide(body.data.slug);
  if (!guide) return Response.json({ error: "Unknown app" }, { status: 400 });
  if (!(await rateLimit("check", clientIp(req), 20, 3600)))
    return Response.json({ error: "Too many site checks this hour. Try again later." }, { status: 429 });
  const refused = await checkUrl(body.data.homepage);
  if (refused) return Response.json({ error: refused }, { status: 400 });
  const rules = guide.requirements.flatMap((r) =>
    r.check.kind === "auto" ? [{ reqId: r.id, rule: r.check.rule as AutoCheckRule }] : [],
  );
  return Response.json(await runChecks(body.data.homepage, rules));
}
