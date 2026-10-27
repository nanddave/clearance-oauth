# Clearance — design (one-pager)

*Composio APM Integrations take-home. Date: 2026-10-27. Status: draft for Nand's approval.*

## 1. The problem, in one paragraph

A developer building an agent on Composio wants their users to connect an app. For 258 OAuth toolkits (148 apps + 110 MCP variants; 124 are managed) Composio has **no managed OAuth app**, so the developer must register their own ([managed-auth page](https://docs.composio.dev/toolkits/managed-auth)). For the rest, Composio's own docs still say *"In production, users should see your app name, not Composio"* — so serious teams bring their own app eventually too. Composio's per-app guides (e.g. [DocuSign](https://composio.dev/auth/docusign), [Xero](https://composio.dev/auth/xero)) stop at "you have a client ID" / *"Go Live Status: Ready to Submit"* — exactly where the real uncertainty begins: review gates, waits, caps, fees, paperwork. The developer can't tell if launch is an hour or two months away, or what will block them.

## 2. What we learned (drives every decision)

1. **Difficulty is not a property of the app.** It's app × what the agent does × who it's for. Gmail *send* is a Sensitive scope (≈1–2 weeks: brand check 2–3 days + sensitive review, which Google itself quotes as 3–5 *or* 10 business days); Gmail *read* is Restricted (≈6 weeks to months + annual CASA security assessment). Same app, very different answer.
2. **There are two clocks.** "First working token in dev" (minutes) vs "production-ready for real users" (days → months, sometimes never). Developers conflate them; guides only cover the first.
3. **This knowledge rots fast, so evidence is the product.** Researching just six apps, three widely-cited facts were already stale: DocuSign dropped its "20 API calls" Go-Live rule (Oct 2025); Slack Marketplace went 5 → **10** installs (Jul 2026); Xero's "25 uncertified connections" was replaced by paid tiers (Mar 2026). A guide without sources and dates is a liability.
4. **Some blockers aren't technical at all**: Xero's new developer terms reportedly ban training AI models on API data and bots that "simulate user actions" (*Reported* — The Register; confirm on Xero's terms page before stating as fact); Slack cuts `conversations.history` to 1 req/min for non-Marketplace commercial apps. For *agent* builders these matter more than the setup steps.

## 3. Goals / non-goals / anti-goals

**Goals:** (a) look up an app → a shareable guide that answers in 5 seconds *how hard, how long, what blocks you, what the agent can do vs you*; (b) submit any app name/URL → an agent investigates and produces the same kind of guide live; (c) every number traceable to a source or test, with uncertainty shown honestly.

**Non-goals (tonight):** all 100 guides, user accounts, MCP server, auto-drafting submission documents, re-verify/diff, video walkthroughs, custom domain.

**v1 — foundation first (no API key needed):** repo + schema + engine (tier, three clocks, #1 blocker) with tests; six guides from the research notes; guide page with toggles, readiness checklist and code auto-checks; home; static `/corrections`; live-generation UI wired to stubbed agents (fixed outputs) so the flow and log work end to end.
**v1 — then (needs keys):** real agents, Redis, deploy, README.
**v1.1:** Haiku fuzzy readiness checks, Drafter agent (Sonnet) that writes the missing documents, cold-run accuracy eval, more hands-on receipts, WAF rule.

**Anti-goals (failure even if it "works"):** confident numbers with no source; a wall of prose; a live demo that hangs or crashes in front of a reviewer; secrets in the repo; guides that look hand-wavy next to Composio's own.

## 4. The product

**Guide page** (`/g/[slug]?uses=read,send`), top to bottom:
1. **Verdict card** — tier (*Self-serve · Review · Gated · Blocked*), **Dev clock**, **Production clock** (ranges; "unknown" shown as unknown), **#1 blocker**, **Composio managed auth: yes/no** with link to Composio's own guide, and the line *"Start today on Composio's app; you need your own when…"* where applicable.
2. **"What does your agent need?" toggles** — per-app use-case switches (e.g. Gmail: read / send; Slack: read history / post; audience: internal / public). Toggling re-computes tier and clocks instantly. *This is the demo moment.*
3. **Path** — ordered gates (each: owner `agent | you | your org | provider`, your effort, provider wait, depends-on, "start on day 1" flag for long-lead items, blockers with fixes, `agent can: do | draft | —`).
4. **Evidence** — every claim badged `Tested · Official · Reported · Conflicting · Unknown`, with source link, exact quote, checked-date. Conflicts show both sides and which we trust and why.
5. **Share** — URL encodes the toggles; copy button; JSON at `/api/guides/[slug]` (agents can read guides too).

**Readiness check — "Am I ready to submit?"** *(Nand's idea; the main differentiator)*. Every provider asks for the same kinds of things before it approves: a public homepage on your own domain, a privacy policy with specific disclosures, a support contact, a legal entity, a paid production account, N active installs, a demo video, a security-assessment letter. The guide lists these as **requirements**. The developer:
1. pastes their homepage URL → **code auto-checks** what it can (loads without login, HTTPS, privacy policy found on same domain and linked, required phrases present such as Google's "Limited Use" disclosure, support email on the domain), each marked *checked by agent*;
2. ticks the rest (*you said*): legal entity, paid account, installs…
3. gets **three numbers**: *If you had everything* (gates only) · *Your plan* (missing requirements inserted as prerequisite steps on the critical path) · *Fastest order* (long-lead items flagged "start day 1", run in parallel) — plus, for each missing item, exactly how to get it and how long it takes.
Readiness state lives in the URL with the toggles, so the shared link is *their* launch plan, not a generic article.

**Home** — search box ("any app name or URL") + library grid of six showcase guides, each showing its verdict chips. Unknown app → live generation.

**Corrections page** (`/corrections`) — "What we found that contradicts common sources", with before/after and sources. Directly answers "show what you learned, corrected, or could not verify".

## 5. Showcase set (6 apps, three groups)

| Group | Apps | Why |
|---|---|---|
| Composio's guide stops at "Ready to Submit" (bring-your-own, no fallback) | **DocuSign, Xero** | Direct before/after on Composio's own docs; both carry corrected stale facts |
| Managed on Composio — until you outgrow it | **Gmail, Slack** | Use-case toggles change the answer by weeks; Slack's 10-install chicken-and-egg + rate-limit penalty |
| Extremes | **GitHub** (easy control), **Gusto** (partner-gated; no Composio guide; *"not all applications are approved"*) | Calibrates the tiers; shows the honest "Gated" verdict |

**Verification depth (stated in README):** hands-on in real accounts — Gmail (Google Cloud consent screen) and DocuSign (developer account → Apps & Keys) at minimum; Slack, Xero, Gusto portal walk-throughs if time allows; the rest source-verified. Screenshots saved as receipts and linked from `Tested` claims.

## 6. Data model (the heart)

```ts
Guide  { slug, name, website, updatedAt, origin: "reviewed" | "generated",
         composio: { managed: boolean | "unknown", guideUrl?: string },
         toggles: Toggle[], gates: Gate[], claims: Claim[], summary: string }
Toggle { id, label, options: {id, label}[], default }
Gate   { id, title, appliesWhen?: Record<toggleId, optionId[]>,
         phase: "dev"|"production",
         kind: "setup"|"review"|"partner"|"legal"|"commercial"|"unavailable",
         owner: "agent"|"you"|"org"|"provider", effortHours: [min,max],
         waitDays: [min,max] | "unknown", dependsOn: string[], startDay1?: boolean,
         requires: string[],   // Requirement ids that must be in place before this gate
         blockers: {symptom, fix}[], agentCan: "do"|"draft"|"none", claimIds: string[] }
Requirement { id, label, appliesWhen?, howToGet: string[], acquireDays: [min,max] | "unknown",
         acquireEffortHours: [min,max], dependsOn: string[],
         check: { kind: "auto", rule: AutoCheckRule } | { kind: "self" }, claimIds: string[] }
Claim  { id, text, status: "tested"|"official"|"reported"|"conflicting"|"unknown",
         sources: {url, quote, checkedAt}[], note?: string }
```
Tier and clocks are **computed in code** from the applicable gates, never written by the LLM *(my calls, marked)*:
- **Gate duration** = `effortHours / 6` working days (6 focused hours/day) + `waitDays`; min and max computed separately.
- **Dev clock** = longest `dependsOn` path through `phase: "dev"` gates. **Production clock** = longest path through all applicable gates. Any `"unknown"` wait on the path renders as "≥ N days + unknown wait" — never a guessed number.
- **Tier**: any `unavailable` → Blocked; any `partner` gate or production max > 21 days → Gated; any `review` → Review; else Self-serve.
- **Readiness**: a missing requirement becomes a prerequisite node (duration = `acquireEffortHours/6 + acquireDays`) in front of every gate that `requires` it. *Your plan* = longest path with missing nodes; *If you had everything* = without them; *Fastest order* = topological order with long-lead nodes (acquire max > 7 days) first and marked "start day 1".
- **#1 blocker** = if any applicable gate has a known max wait over 7 working days, the one with the largest known max; otherwise the gate with the largest max wait (unknown counts as largest); ties → `unavailable` > `partner` > `legal` > `review`.

Showcase guides are JSON files in the repo (`/data/guides/*.json`), written from `docs/research/2026-10-27-provider-facts.md`, validated by Zod at build time.

## 7. Live generation (agent architecture)

```
POST /api/generate {query}
  → normalize → slug; if cached in Redis → return slug
  → Redis SET NX lock (dedupe concurrent requests) → start job in after() → return slug
Job (code-enforced deadline ~240 s, inside Vercel Hobby's 300 s kill; lock is SET NX EX 300
     so a crashed run never leaves a slug stuck "in progress"):
  1 Resolve   Composio API GET /api/v3.1/toolkits?search=… → managed? (code, no LLM)
  2 Research  Claude call #1: web_search + web_fetch (capped uses), free-text findings.
              Code keeps every web_fetch_tool_result document (the evidence corpus).
              Untrusted pages = data only.
  3 Probe     code fetches the discovered authorize / .well-known endpoints → Tested claims
  4 Structure Claude call #2: no tools, structured output (Zod schema), told to quote verbatim
              from the corpus. (Two calls, not one: avoids the citations-vs-structured-output
              conflict and keeps the evidence corpus explicit. Test one-call once; keep two if unsure.)
  5 Verify    code matches each claim's quote against the captured corpus — never re-fetches
              (DocuSign/Xero/Gusto pages are JS-rendered or 403 to plain fetch).
              Quote not found in its source → "unknown", number stripped.
              Source never readable (search-snippet only) → capped at "reported".
              Conflicts kept, not hidden.
  6 Save      Redis guide:{slug}; progress events appended to job:{slug} throughout;
              on deadline → save partial guide with unknowns
Client: /g/[slug] polls job:{slug} each ~1 s → live log ("Fetched Slack review guide…
        Found conflicting install threshold, flagging…") → renders guide when done.
```
Generated guides are badged **"Agent-generated · not human-reviewed · checked <date>"**. Timeout or failure → save what's known with unknowns, never a blank page.

**Agent roster and model routing** *(my calls — routed by how much judgment each step needs; most steps use no model at all)*:

| Agent | Runs on | Tools / permissions | Why this model |
|---|---|---|---|
| Resolver | code | Composio API (read) | lookup, no judgment |
| Scout | Claude Haiku 5.5 | none — classifies search hits code already has | cheap: pick the official dev-portal hosts and docs URLs |
| Researcher A — setup & scopes | Claude Sonnet 5.5 | web_search + web_fetch, capped `max_uses` | reading docs well, fast; runs **in parallel** with B |
| Researcher B — approval & policy | Claude Sonnet 5.5 | web_search + web_fetch, capped `max_uses` | same; parallelism keeps us under the 240 s deadline |
| Prober | code | GET only, official hosts only | deterministic "Tested" evidence |
| Synthesizer | Claude Opus 5.5, **one call** | none; structured output | the only hard judgment: build the gate/requirement graph, weigh conflicting sources |
| Verifier | code | none | quotes must match captured pages; evidence status set by code |
| Readiness checker | code (v1); Haiku 5.5 for fuzzy criteria (v1.1) | fetch **only URLs the user typed** | most checks are string/HTTP facts |

*(Web search/fetch `_20260209` tools are documented for Opus/Sonnet only, so no web tools on Haiku.)* Each progress line in the live log shows **agent · model · what it did**, so the routing is visible in the demo.

**Evidence status is set by code, not by any model**: a claim is *Official* only if its quoted source's host is on the Scout's official-host list for that provider; any other host caps it at *Reported*; a quote not found in the captured page → *Unknown*.

**SSRF guard for the readiness checker** (it fetches user-supplied URLs): https only; resolve DNS and reject private, loopback, link-local and metadata IPs; no redirects to such hosts; 5 s timeout; 1 MB cap.

**Safety & cost (backend review):** API keys only in Vercel env; per-IP daily cap via `@upstash/ratelimit` + Vercel WAF burst rule; hard monthly spend cap set in the Anthropic console; cache by slug so repeat lookups cost nothing; the agent has read-only tools only, so a malicious page can at worst produce a bad guide, which the verifier and schema constrain.

## 8. Stack

Next.js (App Router, TypeScript) on Vercel Hobby · Tailwind · Zod · `@anthropic-ai/sdk` (Claude Opus 5.5, server web search + web fetch, structured outputs) · Upstash Redis via Vercel Marketplace (results, job log, lock, rate limit) · Composio API key for managed-auth lookup. No database beyond Redis; no auth.

## 9. How the six reviewed guides get made (and the built-in eval)

**Build order (my call, de-risks tonight):** (1) hand-write the six guide JSONs from the research notes, so the library works even if live generation slips; (2) build the pipeline; (3) run the pipeline *cold* on the six apps and diff against the reviewed JSON. Each mismatch is logged (agent said X, reviewed truth is Y, source). That log *is* the eval: README reports "agent matched N/M checked facts; K stale, J unsupported; verifier caught L". Same review loop is how the library scales to 100.

**Hands-on testing:** Nand signs in to each provider in Chrome; Claude observes and captures screenshots via Claude in Chrome (Claude never enters credentials). Screenshots go to `/public/receipts/<app>/NN-<step>.png` and are referenced from `Tested` claims. Untested items stay `Official`/`Reported`, and the README says which apps got hands-on testing.

**Submission:** deployed Vercel URL + public GitHub repo + README (setup, key decisions, what was tested, limitations, eval result). No video. Reviewers will try the live link alone, including live generation on an app of their choosing.

**Fallback if the Composio search API lacks a usable managed flag:** a static list of the 258 bring-your-own slugs from the managed-auth page, committed to the repo.

## 10. After the MVP (in order, only if time)

1. **Agent drafts your submission** for `agentCan: "draft"` gates (Google scope justification + demo-video shot list, Gusto pre-approval answers, partner email).
2. **Coverage page**: Composio's bring-your-own OAuth toolkits ranked by usage (from Composio's list-toolkits API) = how we'd pick the first 100.
3. Re-verify button with diff; MCP tool wrapping the JSON endpoint.

## 11. Decided vs left to the builder

**Decided:** everything in §3–§9, the six apps, Redis over Blob, polling over long-held SSE, tier/clocks computed in code, evidence statuses as listed.
**Left to the builder:** visual design details, exact prompt wording, search/fetch caps per run, polling interval, tier thresholds (proposed: Self-serve = no provider wait; Review = provider review ≤ 3 weeks; Gated = partner/application approval or > 3 weeks; Blocked = not available to most developers).
**Hypothesis to test, not claim:** if Composio's managed Slack app is Marketplace-listed, a developer who "outgrows" it into their own *unlisted* app drops `conversations.history` to 1 req/min. Not verified (no listing found in search) — check slack.com/marketplace during hands-on.
**Open, Nand's call:** the monthly API spend cap; veto on any row of the routing table.
