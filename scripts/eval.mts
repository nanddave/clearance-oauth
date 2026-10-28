// Accuracy check for live research: regenerates guides and scores them (src/lib/evalScore.ts).
// Run: ANTHROPIC_API_KEY=… COMPOSIO_API_KEY=… pnpm eval [--only notion] [--budget 20]
// Reviewed apps are regenerated and compared with the human version; unseen apps get the checks that need no reference.
// DocuSign is left out: the synthesizer sees it as its example.
import { mkdirSync, writeFileSync } from "node:fs";
import { runGeneration } from "../src/agents/pipeline";
import { score, type Score } from "../src/lib/evalScore";
import { getGuide } from "../src/lib/guides";

const APPS = ["xero", "gusto", "slack", "notion", "calendly", "hubspot"];

const arg = (name: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : undefined;
};
const apps = arg("only")?.split(",") ?? APPS;
const budget = Number(arg("budget") ?? 20);
if (!process.env.ANTHROPIC_API_KEY) throw new Error("Set ANTHROPIC_API_KEY: without it the pipeline runs stub agents");
if (!process.env.COMPOSIO_API_KEY) throw new Error("Set COMPOSIO_API_KEY: without it coverage is unknown and false greens can't show up");
if (!(budget > 0)) throw new Error("--budget must be a positive number of USD");

const rows: (Score & { costUsd: number; seconds: number; error?: string })[] = [];
let spent = 0;
for (const app of apps) {
  if (spent >= budget) {
    console.log(`Budget $${budget} reached; skipping ${app} and the rest`);
    break;
  }
  const t0 = Date.now();
  let cost = 0;
  try {
    const guide = await runGeneration(app, (e) => {
      cost += e.costUsd ?? 0;
      console.log(`[${app}] ${e.agent}: ${e.message}`);
    });
    rows.push({ ...score(guide, getGuide(app)), costUsd: cost, seconds: (Date.now() - t0) / 1000 });
  } catch (e) {
    rows.push({ ...({ slug: app } as Score), costUsd: cost, seconds: (Date.now() - t0) / 1000, error: e instanceof Error ? e.message : String(e) });
  }
  spent += cost;
}

const yes = (b: boolean | null) => (b === null ? "–" : b ? "yes" : "no");
const md = [
  `# Live research eval (${new Date().toISOString().slice(0, 10)})`,
  "",
  "| App | Reference | Composio route | False green | Tier (match) | Unsupported waits | Next step usable | Official / reported / other | Cost | Time |",
  "|---|---|---|---|---|---|---|---|---|---|",
  ...rows.map((r) =>
    r.error
      ? `| ${r.slug} | | failed: ${r.error} | | | | | | $${r.costUsd.toFixed(2)} | ${r.seconds.toFixed(0)} s |`
      : `| ${r.slug} | ${yes(r.reference)} | ${r.managed} | ${yes(r.falseGreen)} | ${r.tier} (${yes(r.tierMatch)}) | ${r.unsupportedWaits.join(", ") || "none"} | ${yes(r.nextActionUsable)} | ${r.claims.official} / ${r.claims.reported} / ${r.claims.other} | $${r.costUsd.toFixed(2)} | ${r.seconds.toFixed(0)} s |`,
  ),
  "",
  `Total: $${spent.toFixed(2)} for ${rows.length} runs.`,
].join("\n");
mkdirSync("docs/eval", { recursive: true });
writeFileSync("docs/eval/results.json", JSON.stringify(rows, null, 2));
writeFileSync("docs/eval/results.md", md + "\n");
console.log("\n" + md);
