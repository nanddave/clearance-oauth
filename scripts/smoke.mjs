// Smoke test a running deployment: node scripts/smoke.mjs https://your-app.vercel.app
const base = (process.argv[2] ?? "http://localhost:3000").replace(/\/$/, "");
const checks = [
  ["home lists the library", async () => (await page("/")).includes("Gmail")],
  ["guide page renders the next step", async () => (await page("/g/docusign")).includes("Your next step")],
  ["corrections page", async () => (await page("/corrections")).length > 1000],
  ["agent JSON for Gmail send", async () => {
    const v = await json("/api/guides/gmail?t.uses=send&t.audience=external");
    return v.version === 3 && v.verdict.tier === "review" && v.decision.connection === "unknown" && v.decision.lane === "managed";
  }],
  ["unknown guide is a 404 with a hint", async () => (await fetch(`${base}/api/guides/not-an-app-xyz`)).status === 404],
  ["site check refuses private addresses", async () => {
    const r = await fetch(`${base}/api/check`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ slug: "gmail", homepage: "https://127.0.0.1" }) });
    return r.status === 400;
  }],
];
async function page(path) {
  const r = await fetch(base + path);
  if (!r.ok) throw new Error(`${path} → ${r.status}`);
  return r.text();
}
const json = async (path) => (await fetch(base + path)).json();

let failed = 0;
for (const [name, fn] of checks) {
  const ok = await fn().catch((e) => (console.error(`  ${e.message}`), false));
  if (!ok) failed++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
}
process.exit(failed ? 1 : 0);
