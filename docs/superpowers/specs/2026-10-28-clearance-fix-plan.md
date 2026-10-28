# Clearance pass 3: fix plan (2026-10-28)

Merged from two audits (UX/truth audit and the live Notion run audit), checked against commit e1f7c42.

## Corrections to the audits
- `getJob` stays as is (generate route reuse/lease needs the job first); the page reads `guide:${slug}` itself.
- `fix()` builds `composio` in code: no model `guideUrl` or notes.
- After deploy, delete `guide:notion` / `job:notion` and rerun.
- No "connection tested" system state: Clearance can't see the account. Top state is "reported complete, connection unverified".
- IDs restricted to `[a-z0-9_]` in the schema (fixes `&`, `=` and commas), plus `URLSearchParams`.
- Managed "session first" and the slow-load cause are verified before building.

## Phase 0: truth and safety
1. `routeStatus()` in `src/lib/next.ts`: `can_test | scope_unconfirmed | blocked | unknown` + reason + next proof; notes get `scope: confirmed|unconfirmed`. Used by home cards, LaneChooser, `answers()`, `decision()`. JSON version 3.
2. `decision()`: `launch_ready` → `reported_complete` with `verified: false`; completion copy says "connection unverified".
3. Gmail `read_send` option on read gates and note (not the send-only gate); test.
4. GitHub: URL-parameter prefill, no callback, no `done=create_app`; fix "never receive your keys".
5. `fix()`: composio from code only.
6. Resolver: trim key, log HTTP status and body snippet.
7. Optional steps: prompt puts them behind an off toggle; validator rejects required steps titled "optional".
8. Deploy, delete Notion keys, rerun.

## Phase 1: researched-guide quality
9. Quote matching normalises curly quotes/dashes; quotes ≤200 chars.
10. At most two toggles, only when use changes a step.
11. Prerequisites you have or can't buy: 0 days.
12. Script type-check test against `@composio/core`.

## Phase 2: reliability
13. Refresh shows the stored guide with a "researching an update" banner.
14. Share links: schema ID regex + `URLSearchParams`, odd-ID test.
15. Load time: measure first, then pre-build reviewed guides if render-bound.
16. Scout cost "under $0.001"; restore Composio guide link.

## Design (option B: diagnosis first)
- Header: toggles, two route rows (status word + reason), why (with source), now (with owner).
- One journey component replacing tracker, fastest order, path and checklist; requirements inside their stage; only the current stage open.
- Two clocks: test connection, launch.
- Managed lane: connect a test user, run one tool check; script behind "Show commands".
- Home cards show both routes from `routeStatus`; evidence and answers in closed sections.

## Phase 3: proof
17. Eval script calling `runGeneration`: 2–3 reviewed apps vs human versions + ~3 unseen; pilot one, cap $20.
18. README: test count, managed count, eval results.

## Deferred
Stuck-point counter, recently researched, sentence intake, MCP server, chat.
