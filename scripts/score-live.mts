// Scores guides already researched on a deployment, without re-running (no keys, no spend).
// Run: pnpm score:live notion calendly hubspot [--base https://clearance-oauth.vercel.app]
import { score } from "../src/lib/evalScore";
import { getGuide } from "../src/lib/guides";
import { GuideSchema } from "../src/lib/schema";

const i = process.argv.indexOf("--base");
const base = i > 0 ? process.argv[i + 1] : "https://clearance-oauth.vercel.app";
const slugs = process.argv.slice(2).filter((a, j, all) => a !== "--base" && all[j - 1] !== "--base");

for (const slug of slugs) {
  const job = (await fetch(`${base}/api/jobs/${slug}`).then((r) => r.json())) as {
    status: string;
    guide?: unknown;
    events: { agent: string; message: string; costUsd?: number; at: number }[];
  };
  const cost = job.events.reduce((s, e) => s + (e.costUsd ?? 0), 0);
  const secs = job.events.length ? (job.events.at(-1)!.at - job.events[0].at) / 1000 : 0;
  console.log(`\n## ${slug}: ${job.status}, $${cost.toFixed(2)}, ${secs.toFixed(0)} s`);
  for (const e of job.events.filter((e) => e.agent === "resolver" || e.agent === "verifier")) console.log(`- ${e.agent}: ${e.message}`);
  const parsed = GuideSchema.safeParse(job.guide);
  if (!parsed.success) continue;
  console.log(JSON.stringify(score(parsed.data, getGuide(slug)), null, 2));
}
