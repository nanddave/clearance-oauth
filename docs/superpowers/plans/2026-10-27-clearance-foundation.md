# Clearance Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A working, no-API-key foundation of Clearance: schema, computation engine, six showcase guides, readiness check with code auto-checks, guide/home/corrections pages, and the live-generation flow wired to stubbed agents.

**Architecture:** Guides are typed JSON validated by Zod. A pure engine computes tier, three clocks, #1 blocker and fastest order from gates + requirements + the developer's selections. Pages read guides and render the engine's output; all state lives in the URL. Agents sit behind one interface with a routing table; v1 uses stubs that emit realistic events so the UI is complete before keys exist.

**Tech Stack:** Next.js (App Router, TypeScript), Tailwind, Zod, Vitest, pnpm, Node 20.

**Spec:** `docs/superpowers/specs/2026-10-27-clearance-design.md` (facts: `docs/research/2026-10-27-provider-facts.md`)

## Global Constraints

- No secrets in the repo; `.gitignore` covers `.env*`. No API key is needed for anything in this plan.
- Tier, clocks and blockers are computed in code; nothing an LLM writes is shown as a number without a claim.
- Evidence statuses exactly: `tested | official | reported | conflicting | unknown`.
- Working day = 6 focused hours. Tier rules: any `unavailable` → `blocked`; any `partner` gate or production max > 21 days → `gated`; any `review` → `review`; else `self-serve`. Long-lead requirement = acquire max > 7 days.
- Unknown waits render as "≥ N days + unknown", never a guessed number.
- Model IDs (for the routing table only): `claude-haiku-5-5`, `claude-sonnet-5-5`, `claude-opus-5-5`. No web tools on Haiku.
- Readiness auto-checks fetch only URLs the user typed, through the SSRF guard (https only; reject private/loopback/link-local/metadata IPs after DNS; no redirects to them; 5 s timeout; 1 MB cap).

## Review Focus

1. A shared URL with unknown toggle/requirement ids → ignored, page renders with defaults (test in Task 3: `parseSelection` drops unknown ids).
2. A toggle combination where some gates don't apply and a gate depends on a non-applicable gate → dependency skipped, no crash (Task 2 test `skips dependencies that do not apply`).
3. Homepage URL pointing at `localhost`, `10.x`, `169.254.169.254`, or redirecting there → refused with a clear message (Task 4 tests).
4. Homepage that times out or returns 4xx/5xx → that check `fail` with reason, other checks `unsure`, page still renders (Task 4 test).
5. Unknown app slug at `/g/[slug]` → offers live generation instead of 404 (Task 7 manual check).

---

### Task 1: Repo, scaffold, schema

**Files:**
- Create: Next.js app at repo root (`pnpm create next-app . --ts --tailwind --app --src-dir --eslint --use-pnpm --no-import-alias`), `.gitignore` (add `.env*`), `vitest.config.ts`
- Create: `src/lib/schema.ts`
- Test: `src/lib/schema.test.ts`

**Interfaces:**
- Produces: Zod schemas and inferred types `Guide, Toggle, Gate, Requirement, Claim, Source, AutoCheckRule, EvidenceStatus, Range = [number, number]`. Field names exactly as spec §6. `AutoCheckRule = { type: "homepage_loads" } | { type: "https" } | { type: "privacy_policy_found" } | { type: "phrase_present", page: "privacy" | "homepage", anyOf: string[] } | { type: "support_email_on_domain" }`.
- Produces: `parseGuide(json: unknown): Guide` (throws with path on invalid).

- [ ] **Step 1:** `git init`, scaffold, add vitest (`pnpm add -D vitest`), `zod`; commit docs + scaffold.
- [ ] **Step 2: failing tests** — `parses a minimal valid guide`; `rejects claim status "verified"`; `rejects waitDays [5, 2]` (min > max).
- [ ] **Step 3:** implement `schema.ts`; ranges refined so min ≤ max.
- [ ] **Step 4:** `pnpm vitest run src/lib/schema.test.ts` → PASS. `pnpm build` → success.
- [ ] **Step 5:** commit `feat: guide schema`.

### Task 2: Engine

**Files:** Create `src/lib/engine.ts`; Test `src/lib/engine.test.ts`

**Interfaces:**
- Consumes: types from Task 1.
- Produces:
  - `type Selection = { toggles: Record<string, string>; have: Set<string> }` (have = requirement ids in place)
  - `type Clock = { min: number; max: number; unknown: boolean }` (working days)
  - `computePlan(guide: Guide, sel: Selection): Plan` where `Plan = { tier: "self-serve"|"review"|"gated"|"blocked"; dev: Clock; ideal: Clock; yours: Clock; topBlocker: Gate | null; missing: Requirement[]; order: { id: string; kind: "gate"|"requirement"; startDay1: boolean }[]; gates: Gate[] }`
  - `formatClock(c: Clock): string` → e.g. `"3–8 days"`, `"≥ 3 days + unknown"`, `"same day"` when max < 1.

- [ ] **Step 1: failing tests** (tiny inline fixtures):
  - `sums effort and wait along the longest dependency path` (A 6h + 2d → B 0h + 3d ⇒ ideal {min:3,max:...} per fixture values)
  - `parallel branches take the max, not the sum`
  - `unknown wait marks the clock unknown and keeps known minimum`
  - `missing requirement adds its acquire time before the gate that requires it` (yours > ideal; ideal unchanged)
  - `appliesWhen filters gates by toggle` and `skips dependencies that do not apply`
  - `tier: partner → gated; review only → review; nothing → self-serve; unavailable → blocked; prod max 30 → gated`
  - `long-lead missing requirement is first in order with startDay1 true`
  - `throws on dependency cycle`
- [ ] **Step 2:** run → FAIL.
- [ ] **Step 3:** implement: filter applicable gates/requirements; node duration = effort/6 + wait (min and max separately); longest path by memoised DFS over `dependsOn` (+ missing requirements as predecessors); dev clock over `phase === "dev"` only.
- [ ] **Step 4:** run → PASS. Commit `feat: plan engine`.

### Task 3: Six showcase guides + loader

**Files:** Create `data/guides/{gmail,slack,docusign,xero,github,gusto}.json`, `src/lib/guides.ts`, `src/lib/selection.ts`; Test `src/lib/guides.test.ts`

**Interfaces:**
- Produces: `getGuide(slug: string): Guide | null`, `listGuides(): Guide[]`; `parseSelection(guide: Guide, params: URLSearchParams): Selection`, `toSearchParams(sel: Selection): string` (`?t.uses=read&have=privacy_policy,domain`).

- [ ] **Step 1: failing tests:** `all six guides parse`; `every claimId, requires and dependsOn reference an existing id`; `every claim has ≥1 source unless status is unknown`; `gmail read is gated and send is review` (Restricted vs Sensitive); `docusign has no 20-call gate` (regression guard on a corrected fact); `parseSelection drops unknown ids`.
- [ ] **Step 2:** write the JSONs from the research notes. Gmail toggles `uses: send|read`, `audience: internal|external`; requirements incl. domain + homepage, privacy policy with Limited Use phrase (auto), CASA letter (self, long-lead, restricted only). Slack toggle `distribution: internal|marketplace`, requirement `10 active installs` (self, long-lead). DocuSign requirement `paid production account` (self). Xero toggle `connections: ≤5|≤50|≤1000`. Gusto gate kind `partner`. GitHub minimal. Claims carry URL + quote + `checkedAt: "2026-10-27"`; conflicts recorded as `conflicting` with both sources.
- [ ] **Step 3:** run → PASS. Commit `feat: six showcase guides`.

### Task 4: Readiness auto-checks

**Files:** Create `src/lib/readiness/safe-fetch.ts`, `src/lib/readiness/checks.ts`, `src/app/api/check/route.ts`; Test `src/lib/readiness/*.test.ts`

**Interfaces:**
- Produces: `isBlockedAddress(ip: string): boolean`; `safeFetch(url: string): Promise<{ ok: boolean; status: number; finalUrl: string; html: string } | { error: string }>`; `runChecks(homepageUrl: string, rules: { reqId: string; rule: AutoCheckRule }[]): Promise<CheckResult[]>` with `CheckResult = { reqId; status: "pass"|"fail"|"unsure"; reason: string; evidenceUrl?: string }`; `POST /api/check { slug, homepage }` → `CheckResult[]`.
- Pure helpers `findPrivacyLink(html, baseUrl)`, `evaluateRule(rule, pages)` so tests need no network.

- [ ] **Step 1: failing tests:** `blocks 127.0.0.1, ::1, 10.0.0.5, 172.16.0.1, 192.168.1.1, 169.254.169.254, fd00::1`; `allows 8.8.8.8`; `rejects http:// urls`; `finds /privacy link on same domain`; `phrase_present passes on "Limited Use" (case-insensitive)`; `support_email_on_domain fails for gmail.com address`; `homepage error → that check fail, dependent checks unsure`.
- [ ] **Step 2:** implement with `dns.promises.lookup(host, { all: true })`, manual redirects (max 3, each re-checked), `AbortSignal.timeout(5000)`, stop reading past 1 MB.
- [ ] **Step 3:** run → PASS. Commit `feat: readiness auto-checks with SSRF guard`.

### Task 5: Agent seams (stubbed) + live generation flow

**Files:** Create `src/agents/roster.ts`, `src/agents/types.ts`, `src/agents/pipeline.ts`, `src/agents/stubs.ts`, `src/lib/jobs.ts`, `src/app/api/generate/route.ts`, `src/app/api/jobs/[slug]/route.ts`; Test `src/agents/pipeline.test.ts`

**Interfaces:**
- Produces: `ROSTER: Record<AgentId, { label: string; model: "code" | "claude-haiku-5-5" | "claude-sonnet-5-5" | "claude-opus-5-5"; tools: string[]; why: string }>` with ids `resolver, scout, researcherSetup, researcherApproval, prober, synthesizer, verifier` (values = spec §7 table).
- `type AgentEvent = { agent: AgentId; model: string; message: string; at: number }`
- `runGeneration(query: string, emit: (e: AgentEvent) => void, deps?: AgentImpls): Promise<Guide>`; `AgentImpls` defaults to stubs; researchers run via `Promise.all`; result passes `parseGuide` and is marked `origin: "generated"`.
- Job store `src/lib/jobs.ts`: `startJob(slug, query)`, `getJob(slug) → { status: "running"|"done"|"failed"; events: AgentEvent[]; guide?: Guide }`. *shortcut: in-memory Map, lost on cold start; upgrade to Upstash Redis when deploying.*
- `toSlug(query: string): string` (lowercase, strip protocol/www/TLD path, `[a-z0-9-]`).

- [ ] **Step 1: failing tests:** `emits at least one event from every roster agent`; `researchers start before either finishes` (parallel); `returns a schema-valid generated guide`; `toSlug("https://www.notion.so/") === "notion"`.
- [ ] **Step 2:** implement; stubs sleep 300–800 ms and return a plausible guide for the query with all claims `unknown` except Composio lookup marked as stub.
- [ ] **Step 3:** run → PASS. Commit `feat: agent roster, stub pipeline, jobs`.

### Task 6: Guide page

**Files:** Create `src/app/g/[slug]/page.tsx`, `src/components/{VerdictCard,Toggles,ReadinessChecklist,PathList,EvidenceBadge,ClaimList,LiveLog}.tsx`

**Interfaces:** Consumes `getGuide`, `parseSelection`, `toSearchParams`, `computePlan`, `formatClock`, `POST /api/check`, `getJob` via `GET /api/jobs/[slug]`.

- [ ] **Step 1:** server page loads guide (or job), client island holds selection and pushes it to the URL with `router.replace`.
- [ ] **Step 2:** render order per spec §4: verdict (tier, dev, *if you had everything*, *your plan*, #1 blocker, Composio managed + link) → toggles → readiness (auto items with homepage input + "Check" button, self items as checkboxes, each missing item expands to `howToGet` + time) → fastest order with "start day 1" chips → path (owner, effort, wait, agentCan) → evidence with badges, quotes, dates. Generated guides show "Agent-generated · not human-reviewed".
- [ ] **Step 3:** verify in browser: Gmail toggling `send`→`read` changes tier review→gated; unticking privacy policy raises *your plan*; copied URL reopens the same state. Commit `feat: guide page`.

### Task 7: Home, generate, corrections

**Files:** Create/modify `src/app/page.tsx`, `src/app/corrections/page.tsx`, `data/corrections.json`

- [ ] **Step 1:** home: search box (library match → `/g/slug`; else `POST /api/generate` → `/g/slug` showing `LiveLog` lines as `agent · model · message` until done); library grid with tier chip and both clocks.
- [ ] **Step 2:** corrections page from `data/corrections.json`: DocuSign 20 calls, Slack 5→10, Xero 25→tiers, Google sensitive 3–5 vs 10 days, Slack history rate limit; each with old claim, current fact, sources, date.
- [ ] **Step 3:** verify in browser: typing "Gmail" opens guide; typing "Notion" shows the stub log and a generated guide; unknown slug URL offers generation. `pnpm build` passes. Commit `feat: home, generation flow, corrections`.

---

**Next plan (needs keys):** real agent implementations behind `AgentImpls`, Upstash job store, deploy, README.
