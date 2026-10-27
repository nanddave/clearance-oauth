# Clearance PRD v2: from guide to co-pilot

Date: 2026-10-28 · Builds on: `2026-10-27-clearance-design.md` (foundation shipped, 84 tests)
Status: draft for Nand's approval

---

## 1. First principles

What a developer bringing their own OAuth app actually lacks is not information. Provider docs exist. They lack four things:

1. **Position.** Where am I in this provider's process right now?
2. **Next move.** What is the one thing to do next, and who on my team owns it?
3. **Time.** How long until real users can connect, and what should start on day 1 because it is slow?
4. **Hands.** Who does the busywork: forms, manifests, policy text, scripts, emails?

v1 answers 3 well and 2 partly. v2 adds 1 and 4. That is the shift from a guide you read to a co-pilot that says **"you are here, this is next, and I've done the part I'm allowed to do."**

Honesty rule carried over from v1: we say what we know, label how we know it, and say "unknown" otherwise. An agent never claims it did something it can't prove.

## 2. The problem in one paragraph

Composio's shared OAuth apps get an agent builder live on day one for 124 apps. Production branding ("users should see your app name, not 'Composio'") and the 258 apps Composio does not manage push the developer onto their own OAuth app. That path has review queues, audits, partner programs and paid tiers. It takes weeks to months, and Composio's guides stop at "Ready to Submit". Clearance covers the part after that: position, next move, time, and the hands to do the busywork.

## 3. What we answer, and what we don't

| Question | v2 answer | Evidence |
|---|---|---|
| Can this integration be built? | Yes / No / Unknown | Composio toolkit API + provider docs |
| Can **my app** launch to real users, and when? | Verdict + clocks + #1 blocker | Reviewed guide or live research, labeled |
| Where am **I** in that process? | Stage tracker | The developer's answers, an optional screenshot, site checks |
| Can **this user** connect right now? | Only after the developer runs our local setup kit | Composio connected-account status, read on their machine |
| Can the agent do **this action**? | Out of scope; shown as "unknown" | Would need tool execution logs |

We never ask for provider secrets or a Composio key in the browser. Anything that needs a secret runs on the developer's machine.

## 4. The experience (frontend stays simple)

**One input:** "Which app, and what will your agent do with it?" Examples: "Gmail, send emails", or any app name.

**One page, three blocks, top to bottom:**

1. **Verdict.** Tier, the two clocks, and the #1 blocker. Same as v1.
2. **You are here.** A horizontal stage tracker generated from the gate graph (Create app → Configure → Connect in test → Submit → In review → Live). It starts at "not started". Three optional ways to move the pin, all one click:
   - *Answer 2–4 quick questions.* These are specific to each app; see §6.
   - *Drop a screenshot* of the provider console's status page. A vision model reads the status, and the screenshot is not stored.
   - *Paste an error message* you got while connecting. The error decoder maps it to a stage and a fix.
3. **Next action.** One card, never a list. Its button shows who does the work:
   - 🤖 **Do it for me.** We perform the step, or open a pre-filled page so you click once.
   - 🪄 **Prepare it.** We generate the artifact: text, script, manifest or email draft. You paste or send it.
   - 🙋 **You do this.** Login, payment, legal signature, final submit. We say exactly where to click and why only you can.

Everything else (full gate list, evidence, readiness checks, clocks breakdown) sits under "Show the full plan" for people who want it.

**Side features (cheap, high value):**
- **Add day-1 items to calendar.** An `.ics` file with reminders on the dates a slow gate should come back. For example: "Google sensitive review: check status, day 10."
- **Owner tags.** Each step is tagged *you*, *legal*, *founder/finance* or *Composio*. "Copy tasks for legal" gives a plain-text handoff.
- **Hand to your coding agent.** Copies a `SETUP.md` task file (steps, commands, links) that Claude Code or Cursor can execute in the developer's repo.
- **Agent view.** `GET /api/guides/{slug}?t.uses=send` returns the guide and the computed plan as JSON, so other agents can consume the same answer.

## 5. What agents can actually do per app (verified 2026-10-28)

Providers rarely let software create OAuth apps on someone's behalf. We are honest about that, and it is what makes the 🤖 steps credible.

| App | 🤖 Do it for me | 🪄 Prepare it | 🙋 Only you |
|---|---|---|---|
| **GitHub** | **One-click app creation** via the GitHub App manifest flow: we POST a manifest to `github.com/settings/apps/new`, the user clicks Create, and we exchange the returned code at `/app-manifests/{code}/conversions` for credentials. The credentials are shown once and never stored. [O] [docs](https://docs.github.com/en/apps/sharing-github-apps/registering-a-github-app-from-a-manifest) | Composio setup kit; Marketplace listing copy | Click Create; publisher verification for paid listing |
| **Slack** | **Pre-filled app creation link** `api.slack.com/apps?new_app=1&manifest_json=…` with scopes and the Composio redirect already set. [O] [docs](https://docs.slack.dev/app-manifests/configuring-apps-with-app-manifests) | Marketplace listing text; install tracker (10 installs); scope justifications | Install to workspaces; submit for review |
| **Gmail** | Nothing safe to automate. Google has no public API for creating standard OAuth clients or external consent screens. [R] [thread](https://discuss.google.dev/t/oauth-consent-screen-and-oauth-client-automation-limitations/134485) | `gcloud` commands (create project, enable Gmail API); consent-screen field values; Limited Use disclosure; scope justification; demo video shot list; site fixes from the readiness check | Console clicks for consent screen and client; domain verification; submit; CASA if restricted |
| **DocuSign** | – | Integration-type decision helper (private vs public: **can't change once in review**); Go-Live checklist | Buy production plan; create integration key; submit Go-Live |
| **Xero** | – | Tier and cost calculator from expected connections; a note on the AI terms ([R] ban on training with API data) | Add payment method; meet tier requirements |
| **Gusto** | – | Draft pre-approval answers and the email to developer@gusto.com | Send the application; QA review |
| **All apps** | **Composio setup kit.** A generated script the developer runs locally with their own `COMPOSIO_API_KEY`: it creates the auth config with their client ID and secret (`authConfigs.create`, `use_custom_auth`), prints a connect link, then polls connected-account status. ACTIVE moves the tracker to "Connected in test". [O] [docs](https://docs.composio.dev/docs/auth-configuration/programmatic-auth-configs) | Redirect URI to paste (Composio callback; check the version per docs) | – |

Unknown apps (live generation) get the 🪄 tier only, plus "what to ask, and whom" for every unknown.

## 6. Stage detection inputs (no secrets)

| App | Quick questions (each moves the pin) | Screenshot that works | Auto-checks |
|---|---|---|---|
| Gmail | Cloud project + consent screen made? Testing or In production? Internal or External? Which scopes? Submitted for verification? | Google Auth Platform → Verification Center | Homepage: privacy policy, Limited Use wording, support email |
| Slack | App created? Distribution activated? How many workspaces installed? Marketplace submitted? | App settings → Manage Distribution | Privacy policy, support page |
| GitHub | GitHub App or OAuth App? Owned by org? Planning a paid Marketplace listing? Installs so far? | App settings → Advanced / Marketplace | – |
| DocuSign | Developer account + integration key? Paid production plan? Private or public integration? Go-Live status? | Apps & Keys → Go-Live status | – |
| Xero | App created? Expected connections? Payment method added? Need Journals or Bulk? | My Apps → app tier | – |
| Gusto | Dev portal app + sandbox working? Pre-approval submitted? Partner checklist sent? | – (email-based) | Privacy policy, security page |

**Error decoder seed list:** `Error 403: access_denied` (Gmail test user missing), `This app is blocked` (restricted scope unverified), `invalid_redirect_uri` (any provider, wrong Composio callback), Slack `invalid_scope`, DocuSign `consent_required`, and Xero connection-limit errors. Each maps to a stage, a fix, and its evidence label.

## 7. Agents (backend can be complex; each role earns its place)

| Agent | Model | Job | Why |
|---|---|---|---|
| Resolver | code | Composio toolkit lookup: managed or not, auth schemes | Exact and free |
| Scout | Haiku 5.5 | Find the developer portal and docs; plan searches | Cheap triage |
| Reader | code + Jina Reader | Fetch JS-rendered docs. The DocuSign Go-Live page failed with plain fetch in research. | Fixes a real gap |
| Researcher ×2 | Sonnet 5.5, parallel | Setup and scopes / approval and policy | Judgment over long pages |
| Synthesizer | Opus 5.5, once | Gate graph, conflicts, next actions, "what to ask" for unknowns | The one hard reasoning step |
| Cross-checker | Gemini Flash + Google Search, optional | Independent second answer on the **top 3 numeric claims** only. Disagreement means "Conflicting". | Agreement between providers is real evidence. Runs only if a key is present. |
| Verifier | code | Claim → source, status from source host | Models don't grade their own evidence |
| Prober | code | Auth URL exists. It is labeled "endpoint reachable", **never "Tested"**. | Honest scope |
| Stage reader | Sonnet 5.5 vision | Screenshot → stage + confidence; low confidence asks one question | Turns a picture into position |
| Error decoder | code lookup first, Haiku fallback | Error text → stage + fix | Most errors are known strings |
| Drafter | Sonnet 5.5 | 🪄 artifacts: policy text, justifications, emails, manifests | Writing quality matters, but not Opus-level |

The live log shows each agent's line **and its cost** ("Synthesizer · Opus · $0.21"), and the total per guide. Routing becomes visible and measurable.

**Rejected:** OpenAI. No step needs it, and adding a third provider buys nothing measurable. Browser-automation agents for provider consoles: logins, CAPTCHAs and consent are steps only the user may do, so these stay 🙋.

## 8. Media: text, video or animation?

- **No per-app videos.** Provider consoles change monthly, so a recorded video is wrong within a quarter and can't be regenerated per app. That conflicts with "evidence is the product".
- **Yes to data-driven animation.** The stage tracker and an animated critical-path timeline are rendered from the gate graph, so they never go stale. The longest wait visibly dominates, which is the whole point.
- **Optional, v1.1:** one 60–90 s concept explainer on the home page, made in Remotion: shared badge vs own badge, two clocks. It is evergreen because it shows the concept, not the console.
- Text stays the primary medium for steps: short, numbered, with the exact field values to paste.

## 9. Persona reviews of the draft (issues → resolution)

| Persona | Top concern | Resolution in this PRD |
|---|---|---|
| **Product designer** | Three blocks + side features risk the "simple frontend" promise. | One input, one next-action card; everything else is collapsed. Side features live in a single "⋯ More" menu. |
| **CTO** | Scope: 11 agent roles plus vision plus GitHub flow is too much for tonight. | Phased cut lines in §11. P1 ships without Gemini, screenshots or GitHub manifest. |
| **Senior backend dev** | GitHub conversion returns a private key and secret on our server. | Exchange happens in a route that streams the credentials once to the user and never logs or stores them, with a test asserting no persistence. If time is short, ship the manifest pre-fill and let the user copy the credentials from GitHub. |
| **Security reviewer** | Screenshots may contain emails or IDs; the setup kit handles secrets. | Screenshots are processed in memory and never stored or logged; the UI warns before upload. The setup kit runs locally and reads keys from env only. Rate limit is in place before deploy. |
| **Composio Integrations PM (the grader)** | "Is this just docs with a chatbot?" | 🤖 steps that really happen (Slack, GitHub, Composio auth config), honest 🙋 boundaries, cost-per-guide shown, plus a JSON agent view, which ties directly to Composio's agent-first product. |
| **Target developer (solo agent builder)** | "Tell me the one thing to do now and let me go." | The next-action card with owner and time; calendar reminders for waits. |
| **Skeptic (other-LLM review)** | Don't claim connection state from docs. | §3 table; "unknown" until the local kit reports ACTIVE. The Prober's "Tested" is removed. |

Concerns we accepted but deferred: diagnosing runtime connection failures beyond setup errors, and per-action permission checks. Both are in the README as future work.

## 10. Standout elements (ranked by value per hour)

1. **Next-action card with 🤖 / 🪄 / 🙋.** The honest division of labour is itself the insight.
2. **Slack pre-filled manifest link + GitHub manifest one-click.** Real "agent did it" moments in a deployed demo, with no reviewer credentials needed.
3. **Composio setup kit.** Closes the loop to an actual connected account, on the developer's machine.
4. **Error decoder.** Paste an error, get your stage and the fix. Instantly useful.
5. **Cost per guide in the live log.** Makes model routing provable.
6. **JSON agent view + "hand to your coding agent".**
7. **Screenshot → stage.**
8. **Calendar reminders, owner handoffs.**
9. **Cross-provider check.**

## 11. Phases and cut lines

| Phase | Ships | Needs from Nand | Est. |
|---|---|---|---|
| **P1 Honesty + agent view** | §3 table on page; Prober relabel; managed answer depends on toggles; "what to ask" on unknowns; JSON endpoint; next-action card with owner tags (data-driven from existing gates) | nothing | 2–3 h |
| **P2 Real agents** | Scout/Researchers/Synthesizer/Verifier live; Jina Reader; cost in log; $20 cap; Upstash job store; rate limit | Anthropic key, Composio key, Upstash, all in local `.env` | 3–4 h |
| **P3 Do it / Prepare it** | Stage questions + tracker for 6 apps; Slack pre-filled link; Composio setup kit; error decoder; Drafter for Gmail + Gusto | – | 3–4 h |
| **P4 Deploy + README** | Vercel deploy, Playwright smoke on the live URL, README (setup, decisions, limits) | Vercel login (have), GitHub remote OK | 1–2 h |
| **Stretch** | GitHub manifest one-click; screenshot stage reader; Gemini cross-check; calendar `.ics`; Remotion explainer | Gemini key (optional) | each 1–2 h |

**Cut rule:** if time runs short, P1 → P2 → P4 is the shippable spine. P3 is the standout and goes next.

## 12. Evaluation

- 6 reviewed + 5 unfamiliar apps (e.g. Notion, Zoom, Calendly, QuickBooks, Shopify). Total spend ≤ $20.
- Score:
  - false "can connect" answers (target 0)
  - definitive claims without an official source (target 0)
  - #1 blocker matches a human check (target ≥ 9/11)
  - next action is followable without asking (target 11/11)
- Results go in the README.

## 13. Build tooling

- **Already in use:** Vercel CLI, gh, pnpm, Vitest, Playwright (cached), `claude-api` skill.
- **Add:**
  - Jina Reader (no key for low volume), for JS pages.
  - Upstash Redis (free tier).
  - Gemini API key (optional, cross-check only).
- **Not needed:** extra MCP connectors; the failed GitHub MCP is replaced by `gh`.

## 14. Open decisions for Nand

1. Approve P1 → P4 order with P3 as the standout?
2. GitHub one-click: build in P3, or keep as stretch?
3. Gemini cross-check: worth adding a second provider key?
