import { z } from "zod";
import { getGuide } from "../lib/guides";
import { addSpend } from "../lib/limits";
import { safeFetch } from "../lib/readiness/safe-fetch";
import { GuideSchema, type Guide } from "../lib/schema";
import { unbackedReviews, validateGuide } from "../lib/validate";
import { callClaude, extractJson, type Captured } from "./llm";
import type { AgentImpls, Finding, Log } from "./types";
import { isOfficial, verify } from "./verify";

const RUN_DEADLINE_MS = 240_000; // Vercel Hobby functions stop at 300 s
const HOST = /^(?=.{1,253}$)([a-z0-9-]+\.)+[a-z]{2,}$/;
// Aggregators and integration vendors: useful leads, never the provider's own word.
const NOT_OFFICIAL = /(^|\.)(merge\.dev|apideck\.com|nango\.dev|composio\.dev|rapidapi\.com|pipedream\.com|zapier\.com|stackoverflow\.com|reddit\.com|medium\.com)$/;

const ScoutOut = z.object({ officialHosts: z.array(z.string()).max(8) });
const ResearchOut = z.object({
  findings: z.array(z.object({ claim: z.string().min(1).max(500), url: z.string().max(2000), quote: z.string().max(600) })).max(20),
});

const RESEARCH_SYSTEM = `You research how a developer registers their own OAuth app with one provider and gets it approved for production, so an AI agent (via Composio) can act for real users.
Use web_search and web_fetch. Prefer the provider's own documentation. Read the pages you cite with web_fetch.
Reply with JSON only: {"findings":[{"claim":"...","url":"...","quote":"..."}]}
- quote: copied exactly from the page at url, character for character, at most 200 characters.
- State numbers (days, installs, fees, user caps) only when a page states them.
- 4 to 10 findings. If something important cannot be found, add {"claim":"Unknown: <what is missing>","url":"","quote":""}.`;

const SYNTH_SYSTEM = `You turn research findings into a Clearance guide: the gate graph a developer walks to get their own OAuth app for this provider approved for production.
Reply with one JSON object only, matching the example's shape exactly (same keys and value types).
Rules:
- Use only the findings. Every claim's sources must be findings' url and quote, copied exactly, with checkedAt set to today. Never invent a URL.
- A number (waitDays, acquireDays, installs, fees) must come from a cited claim; otherwise use "unknown".
- Every gate has nextStep: the exact action, where to click, what to paste. Every gate or requirement with an unknown wait has whatToAsk: the question and whom to ask.
- Status per claim: "reported", or "conflicting" when findings disagree. Code sets the final status.
- toggles only when the use (scopes, audience, distribution) changes the gates; else []. At most two, and only when the answer changes which steps apply (e.g. read vs write access).
- A step the sources call optional or say "may be" required is never an always-required gate: put it behind a toggle whose default option skips it.
- Never add a review gate just to ask whether review exists. Require a finding that explicitly says the provider reviews or approves this app; otherwise put the uncertainty in whatToAsk on a relevant setup step.
- A prerequisite the developer already has or cannot buy (e.g. workspace owner rights) gets waitDays [0,0]; "unknown" only for real waits on the provider.
- Redirect URI: tell the developer to register https://backend.composio.dev/api/v3/toolkits/auth/callback.
- summary: two sentences, plain words, lead with the longest wait.
- Include one claim stating whether the provider offers OAuth apps to third-party developers, citing the finding that shows it. If no finding shows it, say "Unknown: no source shows OAuth support".
- Every id (gates, requirements, toggles, options) uses only lowercase letters, digits and _.
- dependsOn lists gate ids only; a requirement that can only happen after a step (installs after the app exists) uses afterGates with that gate id.`;

/** Real agents for one run: they share the pages the web tools returned and one deadline. */
export function makeRealAgents(): AgentImpls {
  const captured: Captured = new Map();
  let officialHosts: string[] = [];
  const signal = AbortSignal.timeout(RUN_DEADLINE_MS);
  const today = new Date().toISOString().slice(0, 10);

  async function ask(log: Log, opts: Parameters<typeof callClaude>[0], done: (text: string) => string) {
    const r = await callClaude({ ...opts, signal, captured });
    await addSpend(r.costUsd);
    log(done(r.text), r.costUsd);
    return r.text;
  }

  async function research(slug: string, hosts: string[], log: Log, focus: string): Promise<Finding[]> {
    log(`Searching ${focus}…`);
    const before = captured.size;
    const text = await ask(
      log,
      {
        model: "claude-sonnet-5-5",
        system: RESEARCH_SYSTEM,
        prompt: `Provider: ${slug}\nLikely official hosts: ${hosts.join(", ") || "unknown"}\nFocus: ${focus}`,
        maxTokens: 6000,
        effort: "medium",
        web: { maxUses: 4 },
      },
      () => `Read ${captured.size - before} new pages`,
    );
    const parsed = ResearchOut.safeParse(safeJson(text));
    const findings = parsed.success ? parsed.data.findings : [];
    log(`${findings.length} findings, ${findings.filter((f) => f.url && isOfficial(f.url, officialHosts)).length} from official hosts`);
    return findings;
  }

  return {
    async resolver(slug, log) {
      const key = process.env.COMPOSIO_API_KEY?.trim();
      if (!key) {
        log("No Composio key configured, so coverage is unknown");
        return { managed: "unknown" };
      }
      const misses: { s: string; status?: number; why: string }[] = [];
      for (const s of new Set([slug.replace(/-/g, ""), slug])) {
        const get = (header: string) =>
          fetch(`https://backend.composio.dev/api/v3.1/toolkits/${encodeURIComponent(s)}`, {
            headers: { [header]: key },
            signal: AbortSignal.timeout(8000),
          }).catch((e: unknown) => (e instanceof Error ? e.message : String(e)));
        // the endpoint takes a project key in x-api-key or a user key in x-user-api-key; try the other on a 401
        let res = await get("x-api-key");
        if (typeof res !== "string" && res.status === 401) res = await get("x-user-api-key");
        if (typeof res === "string") {
          misses.push({ s, why: res });
          continue;
        }
        if (!res.ok) {
          misses.push({ s, status: res.status, why: res.status === 401 || res.status === 403 ? authError(await res.text().catch(() => ""), key) : (await res.text().catch(() => "")).split(key).join("[key]").replace(/\s+/g, " ").slice(0, 120) }); // never echo the key
          continue;
        }
        const t = (await res.json().catch(() => ({}))) as { composio_managed_auth_schemes?: unknown };
        const schemes = t.composio_managed_auth_schemes;
        // managed only if Composio holds an OAuth app; a managed API-key scheme doesn't count (managed-auth directory)
        const managed = Array.isArray(schemes) ? schemes.some((x) => /^oauth/i.test(String(x))) : "unknown";
        log(`Composio toolkit '${s}': managed schemes [${Array.isArray(schemes) ? schemes.join(", ") : "not listed"}], so ${managed === true ? "Composio manages the OAuth app" : managed === false ? "bring your own OAuth app" : "coverage unknown"}`);
        return { managed };
      }
      if (misses.every((m) => m.status === 404)) log("Not found in Composio's toolkit catalog");
      else for (const m of misses) log(m.status ? `Composio API answered ${m.status} for '${m.s}': ${m.why}` : `Composio API unreachable for '${m.s}': ${m.why}`);
      return { managed: "unknown" };
    },

    async scout(slug, log) {
      const text = await ask(
        log,
        {
          model: "claude-haiku-5-5",
          system: 'You name the hostnames a SaaS provider owns for its developer docs, API reference and help center. Reply with JSON only: {"officialHosts":["developer.example.com"]}. Up to 5. Never third-party sites. If unsure, return [].',
          prompt: `Provider: ${slug}`,
          maxTokens: 500,
          effort: "low",
        },
        () => "Picked the provider's own docs hosts",
      );
      const parsed = ScoutOut.safeParse(safeJson(text));
      officialHosts = (parsed.success ? parsed.data.officialHosts : [])
        .map((h) => h.toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, ""))
        .filter((h) => HOST.test(h) && !NOT_OFFICIAL.test(h));
      log(officialHosts.length ? `Official hosts: ${officialHosts.join(", ")}` : "No official hosts known; every source will count as reported");
      return { officialHosts };
    },

    researcherSetup: (slug, hosts, log) =>
      research(slug, hosts, log, "registering an OAuth app: developer portal, redirect URI, scopes and which are sensitive, sandbox vs production, test-user limits"),
    researcherApproval: (slug, hosts, log) =>
      research(slug, hosts, log, "production approval: review or verification steps and timelines, partner programs, security assessments, paid plan requirements, limits for unapproved apps, policies on AI agents"),

    async prober(_slug, hosts, log) {
      if (!hosts.length) return log("No official host to check");
      const r = await safeFetch(`https://${hosts[0]}/`, undefined, undefined, AbortSignal.timeout(8000));
      log("error" in r ? `${hosts[0]} not reachable: ${r.error}` : `${hosts[0]} reachable (HTTP ${r.status}); this proves the site exists, not that you can connect`);
    },

    async synthesizer({ query, slug, managed, findings }, log) {
      const all = [...findings.setup, ...findings.approval].filter((f) => f.url);
      const example = getGuide("docusign")!;
      const prompt = `Today: ${today}\nApp: ${query} (slug: ${slug})\nComposio managed: ${managed}\n\nExample guide:\n${JSON.stringify(example)}\n\nFindings:\n${JSON.stringify(all)}`;
      const text = await ask(log, { model: "claude-opus-5-5", system: SYNTH_SYSTEM, prompt, maxTokens: 16000, effort: "medium" }, () => "Built the gate graph from findings");
      const fix = (g: Guide): Guide => ({ ...g, slug, origin: "generated", updatedAt: today, composio: { managed } }); // guideUrl/notes never from the model: it copied the example's
      // shape (zod) and usability (references, cycles, possible order) must both pass; one repair, then fail loudly
      const check = (raw: unknown): { guide?: Guide; errors: string[] } => {
        const parsed = GuideSchema.safeParse(raw);
        if (!parsed.success) return { errors: parsed.error.issues.slice(0, 15).map((i) => `${i.path.join(".")}: ${i.message}`) };
        const guide = fix(parsed.data);
        return { guide, errors: validateGuide(guide).slice(0, 15) };
      };
      const first = check(safeJson(text));
      if (first.guide && !first.errors.length) return first.guide;
      log(`Guide failed checks (${first.errors.length} problems); asking for one repair`);
      const repaired = await ask(
        log,
        { model: "claude-sonnet-5-5", system: "Fix the JSON so it passes every listed check. Change only what the errors name. Reply with the JSON object only.", prompt: `Errors:\n${first.errors.join("\n")}\n\nJSON:\n${text}`, maxTokens: 16000, effort: "low" },
        () => "Repaired the guide JSON",
      );
      const second = check(safeJson(repaired));
      if (second.guide && !second.errors.length) return second.guide;
      throw new Error(`guide still invalid after repair: ${second.errors.slice(0, 3).join("; ")}`);
    },

    async verifier(guide, log) {
      const { guide: out, stats } = verify(guide, captured, officialHosts);
      // a review step whose source didn't check out is dropped, not fatal: the run already cost money
      const drop = new Set(unbackedReviews(out, true));
      for (const id of drop) log(`Dropped review step '${id}': no checked provider quote says the provider reviews apps`);
      const kept: Guide = drop.size
        ? {
            ...out,
            gates: out.gates.filter((g) => !drop.has(g.id)).map((g) => ({ ...g, dependsOn: g.dependsOn.filter((d) => !drop.has(d)) })),
            requirements: out.requirements.map((r) => ({ ...r, afterGates: r.afterGates?.filter((d) => !drop.has(d)) })),
          }
        : out;
      const errors = validateGuide(kept);
      if (errors.length) throw new Error(`Guide failed checks after verification: ${errors.slice(0, 3).join("; ")}`);
      log(`Checked ${guide.claims.length} claims against ${captured.size} captured pages: ${stats.official} official, ${stats.reported} reported, ${stats.conflicting} conflicting, ${stats.unknown} unverified; ${stats.verbatim} quotes matched word for word, ${stats.droppedLinks} links dropped`);
      return kept;
    },
  };
}

/** Composio's canned auth error ("Auth_Unauthorized: Invalid API key format"): says what's wrong with the key without the raw body. */
export function authError(body: string, key: string): string {
  const e = (safeJson(body) as { error?: { slug?: unknown; message?: unknown } } | null)?.error;
  const msg = [e?.slug, e?.message].filter((x) => typeof x === "string").join(": ");
  const leaks = [...Array(Math.max(0, key.length - 3)).keys()].some((i) => msg.includes(key.slice(i, i + 4))); // no 4-character piece of the key
  return msg && key.length >= 4 && !leaks ? `rejected the API key (${msg.slice(0, 120)})` : "rejected the API key";
}

function safeJson(text: string): unknown {
  try {
    return extractJson(text);
  } catch {
    return null;
  }
}
