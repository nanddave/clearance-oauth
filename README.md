# Clearance

**Live:** _deployed URL goes here_ · **Repo:** this one

Composio's shared OAuth apps get an agent live on day one. Two things take a developer off that path: putting their own app's name on the consent screen, which Composio's docs recommend for production, or needing one of the 258 apps Composio doesn't manage. Either way they now face provider review queues, security audits, partner programs and paid tiers, and Composio's guides stop at "Ready to Submit".

Clearance tells a developer, for any app:
- **How hard it is**: Self-serve, Review, Gated or Blocked.
- **How long**: when they can build, and when real users can connect.
- **What blocks them**: the #1 blocker.
- **Where they are now**, and **the one next step**.

For that step it either **does it**, **prepares it**, or says **only you can**. Every fact carries how we know it.

## Try it
- Open a reviewed guide, for example `/g/gmail`. Switch "send" and "read" and watch the verdict move from Review (about 10 working days) to Gated (30 or more, plus a security audit).
- Tick what you already have, or mark steps done. The tracker, the next step and the clocks follow you, and the URL keeps your state so it can be shared.
- On `/g/slack`, type an app name and get a Slack app creation page pre-filled with scopes and Composio's redirect.
- On `/g/github`, a GitHub App manifest form does the same. GitHub sends you back with the step done; the code it returns is stripped from the URL before the page renders and is never exchanged.
- Paste an OAuth error into **Got an error?**
- Type an app we haven't reviewed (Notion, Calendly…) and the agents research it live.
- Agents can read the same answer as JSON: `GET /api/guides/gmail?t.uses=send&done=create_project`.

## Key decisions

**1. Difficulty depends on the app *and* what your agent does with it.**
- Gmail send is a sensitive scope: about 10 working days of review.
- Gmail read is restricted: 30 or more working days, plus a yearly CASA security assessment.
- So guides have toggles, and the verdict is computed rather than written. An engine walks the gate graph (longest path) and gives three clocks:
  - **dev**: until you can build and test
  - **if you had everything**: the provider's own steps only
  - **your plan**: adds whatever you're still missing

**2. Evidence is the product.**
- Each claim is labelled Tested, Official, Reported, Conflicting or Unknown, with its source.
- The label is set by code, never by a model:
  - **Official** needs a page a web tool actually fetched, on the provider's own host.
  - A page seen only in search results counts as **Reported**.
  - No source means **Unknown**.
- A wait whose evidence fails verification becomes "unknown". It then gets a **what to ask, and whom** line.
- `/corrections` lists facts we got wrong at first, such as DocuSign's retired 20-call rule and Slack's install count moving from 5 to 10.

**3. Honest about what a guide can't know.**
- "Can this user connect right now?" and "Can the agent do this action?" need the developer's own Composio account, so the page always says "unknown" for them.
- The Composio setup script closes that loop on the developer's machine: it creates the auth config, prints a connect link, and waits until the account is ACTIVE.
- No secret ever reaches our server.

**4. Agents do only what providers allow, and say so.**

| App | Agent does it | Agent prepares it | Only you |
|---|---|---|---|
| Slack | Pre-filled manifest link | | |
| GitHub | Manifest form | | |
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
- A daily spend cap (`DAILY_BUDGET_USD`, default $10).
- A 240-second run deadline (the route allows 300 s).
- User-supplied URLs are fetched only over HTTPS, with DNS checked against private, loopback, link-local and metadata ranges. Every redirect is re-checked, with size and time caps.

## Setup
```bash
pnpm install
cp .env.example .env.local   # fill in what you have
pnpm dev
pnpm test                    # 111 unit tests
node scripts/smoke.mjs http://localhost:3000
```

- **No `ANTHROPIC_API_KEY`:** stub agents run. They're clearly labelled, and the generated guide shows a placeholder banner.
- **No `COMPOSIO_API_KEY`:** Composio coverage shows as unknown.
- **No Upstash:** jobs live in memory, which is fine locally. On Vercel, add the Upstash integration (it sets `KV_REST_API_URL` and `KV_REST_API_TOKEN`), so the instance running research and the one answering polls share state.

Stack: Next.js 16 (App Router), TypeScript, Zod, Vitest, `@anthropic-ai/sdk`, Upstash Redis over REST, Vercel.

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
  - DNS rebinding isn't prevented between our check and the fetch.
  - The spend cap can be overshot by one running job.
  - Apex domains use a two-label rule, which is wrong for `co.uk`-style domains.
- **Not built yet:**
  - reading a screenshot of a provider console to set your stage
  - a Gemini cross-check of key numbers
  - calendar reminders for long waits
  - an accuracy eval across 6 reviewed plus 5 unfamiliar apps, scoring false "can connect" answers and unsupported definitive claims (planned spend ≤ $20)

Design: `docs/superpowers/specs/2026-10-28-clearance-prd.md` · Research notes: `docs/research/2026-10-27-provider-facts.md`
