# Clearance

**Live:** https://clearance-oauth.vercel.app · **Repo:** https://github.com/nanddave/clearance-oauth

Composio's managed OAuth apps let developers test many connections without registering an app. Developers may still need their own provider app for branding, scopes, quota, or a toolkit without managed auth. That introduces provider-specific setup, reviews, security checks, and sometimes paid or partner requirements.

Clearance first answers the question most developers actually have: **can I just use Composio's app?** Then, for their own app, it tells them:
- **How hard it is**: Self-serve, Review, Gated or Blocked.
- **How long**: when they can build, and when real users can connect.
- **What blocks them**: the #1 blocker.
- **Where they are now**, and **the one next step**.

For that step it either **does it**, **prepares it**, or says **only you can**. Every fact carries how we know it.

## Review it in five minutes

1. Open the [live site](https://clearance-oauth.vercel.app) and choose Gmail. Select **Read and send** and **Anyone with a Google account**. Compare the managed route (test today, scopes unconfirmed) with your own app (restricted review and an unknown security-assessment wait).
2. Select **Your own app**. The two clocks show when you can test and when your own app may launch. Open a checkpoint in **Journey to launch**, tick a requirement, and watch the next action and share URL update. A tick is labelled as reported progress, never a verified connection.
3. Try [GitHub](https://clearance-oauth.vercel.app/g/github) for an easier route, [Gusto](https://clearance-oauth.vercel.app/g/gusto) for a partner gate, and [DocuSign](https://clearance-oauth.vercel.app/g/docusign) for provider review. Slack and GitHub include prefilled provider setup; the developer confirms the final creation.
4. Type an app outside the reviewed library. The agents research it live, show their work, and label the result **agent-generated, not human-reviewed**. This uses the live research budget, so a daily limit may temporarily stop new runs.
5. Open the [Gmail agent JSON](https://clearance-oauth.vercel.app/api/guides/gmail?t.uses=read_send&t.audience=external&lane=own). Its versioned `decision` distinguishes route availability, reported setup progress, and the still-unknown connection and tool result.

**A useful reviewer prompt for an agent:** “Read the JSON guide for Gmail read-and-send with external users. Can a real user perform both actions now? Name the evidence for your answer, what remains unknown, and the next test or provider step. Do not treat user-reported completion as verification.”

The guide is a decision aid. It cannot access a reviewer’s Composio account or prove their connection without a local test. The setup commands stay on the developer’s machine; paste a non-secret error into **Connection not working?** for known fixes.

## Key decisions

**1. Difficulty depends on the app *and* what your agent does with it.**
- Gmail send is a sensitive scope: about 10 working days of review.
- Gmail read is restricted: 30 or more working days, plus a yearly CASA security assessment.
- So guides have use-case choices, and the verdict is computed rather than written. An engine walks the gate graph (longest path) and computes three clocks, with the two most useful shown first:
  - **dev**: until you can build and test
  - **if you had everything**: the provider's own steps only
  - **your plan**: adds whatever you're still missing

**2. Evidence is the product.**
- Each claim is labelled Tested, Official, Reported, Conflicting or Unknown, with its source.
- The label is set by code, never by a model:
  - **Official** needs the claim's quote found word for word on a page a web tool fetched from the provider's own host.
  - A fetched page whose text doesn't contain the quote, or a third-party page, counts as **Reported**. A page seen only in search results never counts as Official.
  - No source means **Unknown**.
- A number (a wait, an acquire time) survives only if a cited claim's quote matched word for word; otherwise it becomes "unknown" with a **what to ask, and whom** line.
- A researched guide must also pass structural checks before it's saved: valid references, no dependency loops in any combination, and a sourced claim that the provider offers OAuth. Without that claim, "Can this be built?" says unknown.
- `/corrections` lists facts we got wrong at first, such as DocuSign's retired 20-call rule and Slack's install count moving from 5 to 10.

**3. Honest about what a guide can't know.**
- "Can this user connect right now?" and "Can the agent do this action?" need the developer's own Composio account, so the page always says "unknown" for them.
- The setup scripts help close that loop on the developer's machine. The managed script uses Composio's app without registering OAuth credentials; the own-app script creates a custom auth config with the redirect URI it tells you to register. Both print a connect link, wait for ACTIVE, then run one read-only tool, because ACTIVE alone doesn't prove a tool works.
- No secret ever reaches our server.

**4. Agents do only what providers allow, and say so.**

| App | Agent does it | Agent prepares it | Only you |
|---|---|---|---|
| Slack | Pre-filled manifest link with the scopes you choose; you click Create | | |
| GitHub | Pre-filled GitHub App registration URL with minimal permissions; you click Create | | |
| Gmail | | Limited Use statement, scope justifications | Console clicks: Google has no public API to create these OAuth clients |
| Gusto | | Pre-approval email | |
| DocuSign, Xero | | | Login, payment, legal, submit |

The "prepare it" drafts are templates, not model output. They're free, instant, and can't hallucinate.

**5. Model routing: the cheapest model that can do each job.**

| Agent | Runs on | Why |
|---|---|---|
| Resolver | code | Composio toolkit API lookup |
| Scout | Haiku 5.5 | Names the provider's own docs hosts |
| Researcher ×2 | Sonnet 5.5, in parallel | Setup/scopes and approval/policy, with web search and fetch (4 uses each) |
| Synthesizer | Opus 5.5, **one call** | Builds the gate graph; one Sonnet call repairs JSON if needed |
| Verifier | code | Checks URLs and quotes word for word |
| Prober | code | "Site reachable", never "Tested" |
| Readiness checker | code | Fetches your homepage behind an SSRF guard |
| Error decoder | code | Pattern table |

Every call is priced. The live log shows the cost of each step and the total, so the routing can be measured.

**6. Guardrails.**
- 3 researches per IP per hour, and 20 site checks per IP per hour.
- A daily spend cap (`DAILY_BUDGET_USD`, default $10). Each run reserves $0.75 when it starts, so parallel starts can't all slip under the cap.
- One run per app at a time (an atomic lease in Redis). A run still "running" after 6 minutes is treated as failed and can be retried.
- A 240-second run deadline (the route allows 300 s).
- User-supplied URLs are fetched only over HTTPS, with DNS checked against private, loopback, link-local and metadata ranges. The request then connects to the address we checked, so a second DNS answer can't redirect it. Every redirect is re-checked, with size and time caps.

## Setup
```bash
pnpm install
cp .env.example .env.local   # fill in what you have
pnpm dev
pnpm test
pnpm eval --only notion       # live accuracy check (needs ANTHROPIC_API_KEY); drop --only for all six apps
node scripts/smoke.mjs http://localhost:3000
```

- **No `ANTHROPIC_API_KEY`:** stub agents run. They're clearly labelled, and the generated guide shows a placeholder banner.
- **No `COMPOSIO_API_KEY`:** Composio coverage shows as unknown.
- **No Upstash:** jobs live in memory, which is fine locally. On Vercel, add the Upstash integration (it sets `KV_REST_API_URL` and `KV_REST_API_TOKEN`), so the instance running research and the one answering polls share state.

Stack: Next.js 16 (App Router), TypeScript, Zod, Vitest, `@anthropic-ai/sdk`, Upstash Redis over REST, Vercel.

## Accuracy check

**Live pilot (2026-10-28):** three apps outside the library, researched on production. Full write-up: [`docs/eval/2026-10-28-live-pilot.md`](docs/eval/2026-10-28-live-pilot.md).

| App | Time | Cost | Official claims | Unsupported waits | Next step usable |
|---|---|---|---|---|---|
| [Notion](https://clearance-oauth.vercel.app/g/notion) | 103 s | $0.49 | 7 of 7 | none | yes |
| [Calendly](https://clearance-oauth.vercel.app/g/calendly) | 69 s | $0.38 | 7 of 8 | none | yes |
| [HubSpot](https://clearance-oauth.vercel.app/g/hubspot) | 83 s | $0.54 | 6 of 6 | none | yes |

The failure was the Composio route: production's Composio key was rejected, so coverage read "unknown" for all three (a missed managed route, never a false green). Calendly may be over-cautious: it adds an unknown review step that no source confirms. `pnpm score:live <apps>` re-scores stored guides at no cost.

`pnpm eval` regenerates guides with the live agents and scores each one (`src/lib/evalScore.ts`):
- **False green:** says "Test today" on Composio's app when the reviewed guide says Composio has no app.
- **Tier match:** same difficulty tier as the human-reviewed guide.
- **Unsupported waits:** a known, non-zero wait with no word-for-word checked source behind it.
- **Next step usable:** there is a concrete next step.

It runs three reviewed apps (Xero, Gusto, Slack; DocuSign is left out because the synthesizer sees it as its example) and three it hasn't seen (Notion, Calendly, HubSpot), stops at `--budget` (default $20), and writes `docs/eval/results.md`.

## Limitations (known, chosen)
- **Six reviewed guides**, picked to cover the spread:
  - Gmail: scope-dependent
  - Slack: install catch-22
  - DocuSign: paid account, fast review
  - Xero: paid tiers, no queue
  - GitHub: the easy baseline
  - Gusto: partner-gated, may be denied
- **Researched guides are labelled agent-generated and not human-reviewed.** Quality depends on what the provider publishes.
- **Effort hours are our estimates**, and labelled so. Provider waits carry their own evidence.
- **Unchecked menu paths:** the console paths in the next steps ("Google Auth Platform → Branding") come from docs and haven't been clicked through in every console.
- **The error decoder** knows a short list of common errors and says so when it doesn't recognise one.
- **Slugs:** generated slugs use our naming, which may differ from Composio's toolkit slug. The setup script notes this.
- **Shortcuts are marked in code with `shortcut:`**:
  - The spend cap can be overshot by one running job.
  - Apex domains use a two-label rule, which is wrong for `co.uk`-style domains.
- **Not built yet:**
  - reading a screenshot of a provider console to set your stage
  - a Gemini cross-check of key numbers
  - calendar reminders for long waits

Design: `docs/superpowers/specs/2026-10-28-clearance-prd.md` · Research notes: `docs/research/2026-10-27-provider-facts.md`
