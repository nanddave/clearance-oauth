# Provider facts — research notes (checked 2026-10-27)

Labels: **[O]** official page fetched · **[R]** third-party/forum · **[C]** sources conflict · **[NF]** not found · **[O-u]** official, from prior knowledge, not fetched this session. Source of truth for the six showcase guides and `/corrections`.

## Composio context
- 258 OAuth toolkits are "Bring your own OAuth app" (DocuSign, Xero, Gusto, Shopify, Twitter, Spotify…). Gmail, Slack, GitHub, LinkedIn, Salesforce, HubSpot, Zoom are Composio-managed. [O] https://docs.composio.dev/toolkits/managed-auth
- Reasons to bring your own app: branding ("In production, users should see your app name, not 'Composio'"), scopes, dedicated rate limits, polling interval (managed min 15 min), custom instances. No mention of provider review timelines. [O] https://docs.composio.dev/docs/authentication/custom-app-vs-managed-app
- Composio guides exist for DocuSign and Xero; both stop before approval (DocuSign ends at "Go Live Status: Ready to Submit"; Xero never mentions tiers/certification). [O] https://composio.dev/auth/docusign · https://composio.dev/auth/xero
- API: `GET https://backend.composio.dev/api/v3.1/toolkits/{slug}` and `/toolkits` (list; `search`, `sort_by=usage`, `limit≤1000`), header `x-api-key`. Fields `auth_schemes`, `composio_managed_auth_schemes`. Exact values unverified. [O] https://docs.composio.dev/reference/api-reference/toolkits/getToolkits

## DocuSign
- **20-API-call Go-Live rule eliminated** — "eliminates the requirement to make 20 API calls" (newsletter Nov 3 2025) [O] https://developers.docusign.com/html/newsletter/202511.html ; community announcement Oct 3 2025 [O] https://community.docusign.com/go-live-70/no-more-20-api-calls-introducing-the-streamlined-integration-go-live-experience-in-apps-keys-25623
- New flow: pick integration type + production account in Apps & Keys → Approved instantly / Needs review / Not allowed. Reviews "typically completed within 48 hours or less". [O, same post]
- Needs a paid production account with admin/developer access. [O, via search snippet] https://developers.docusign.com/docs/esign-rest-api/go-live/
- Public integrations need Partner Program membership; embedded needs a special license; integration type can't change once in review. [O] https://community.docusign.com/go-live-70/no-more-20-api-calls-introducing-the-streamlined-integration-go-live-experience-in-apps-keys-25623
- After Go-Live, secrets and redirect URIs are not copied to production. [O, via snippet] https://developers.docusign.com/docs/esign-rest-api/go-live/
- [C] Older threads/integrator docs still cite 20 calls — superseded.

## Xero
- Tiers from 2 Mar 2026 [O] https://developer.xero.com/pricing : Starter 5 conns free · Core 50 A$35/mo · Plus 1,000 A$245 · Advanced 10,000 A$1,445 · Enterprise POA. Starter 1,000 calls/day/org, others 5,000. Payment method from Core [O, FAQ]. "Connections are capped at the tier maximums until you meet that tier's requirements." [O] https://developer.xero.com/faq/pricing-and-policy-updates
- Security assessment + use-case approval for Journals / Practice Manager / Bulk Connections (Advanced+). [O]
- [C] "25 uncertified connections" in Apideck/Fivetran docs — not in Xero's 2026 pages; treat as pre-Mar-2026. https://fivetran.com/docs/connectors/applications/xero
- [C] Certification beta-customer count: 10 (devblog title) vs 3 (older PDF).
- New developer terms ban using API data to train AI/ML models and bots that "simulate user actions" (from 4 Dec 2025 new devs / 2 Mar 2026 existing). [R] https://www.theregister.com/2025/12/04/xero_api_fees_change/

## Google (Gmail)
- `gmail.send` = Sensitive; `gmail.readonly`, `gmail.modify`, `gmail.compose`, `gmail.metadata`, `mail.google.com/` = Restricted. [O] https://developers.google.com/workspace/gmail/api/auth/scopes
- Brand verification 2–3 business days [O]. Sensitive verification [C]: 10 business days (https://support.google.com/cloud/answer/13463817) vs 3–5 (production-readiness page). Restricted ≈6 weeks [O]; "might require several months" https://support.google.com/cloud/answer/7454865
- CASA: required when restricted data passes a third-party server; empanelled assessor; AL1/AL2; annual full re-test. [O] https://support.google.com/cloud/answer/13465431 . Cost not published by Google; vendor estimate ~$3k–15k [R].
- Unverified apps: 100 new users lifetime, cannot be reset. [O] https://support.google.com/cloud/answer/7454865 · https://support.google.com/cloud/answer/13463817 . Internal Workspace apps, personal use and dev/test builds exempt from verification. [O, same pages; summarized by research agent, exact wording not captured]
- Brand verification "typically 2–3 business days" — research agent tagged [O] but did not record which Google page; treat as [R] until a URL is captured.
- Testing-mode refresh tokens expire after 7 days. [O-u]

## Slack
- Marketplace requires **10** active-workspace installs since Jul 2026, maintained during review (changelog Sep 1 2026). [O] https://docs.slack.dev/changelog/2026/09/01/slack-marketplace-install-requirement . "5" is stale [C].
- Preliminary review ≤10 business days; functional ≤10 weeks (new), ≤6 weeks (updates); no expedite; resubmitting during preliminary resets queue. Heavier review for `search:read`, `admin.*`, `identity.*`, legacy scopes. [O] https://docs.slack.dev/slack-marketplace/slack-marketplace-review-guide
- Non-Marketplace commercial apps: `conversations.history`/`.replies` → 1 req/min, limit max 15 (May 29 2025). [O] https://docs.slack.dev/changelog/2025/05/29/rate-limit-changes-for-non-marketplace-apps . [C] whether existing installs are affected. The `conversations.history` method reference page still shows only Tier 3 (50+ per minute). [O] https://docs.slack.dev/reference/methods/conversations.history

## GitHub
- GitHub Apps recommended over OAuth Apps (fine-grained, 1-hour tokens). No review to create/use outside Marketplace; org owners may need to approve. [O] https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/differences-between-github-apps-and-oauth-apps
- Paid Marketplace listing: verified publisher + 100 installs (GitHub App) / 200 users (OAuth App). [O] https://docs.github.com/en/apps/github-marketplace/creating-apps-for-github-marketplace/requirements-for-listing-an-app

## Gusto
- Dev portal → org → app → client ID; sandbox api.gusto-demo.com only. [O] https://docs.gusto.com/app-integrations/docs/introduction
- Production [O] https://docs.gusto.com/app-integrations/docs/introduction : Pre-Approval application (incl. security review) — "Production access is gated, and not all applications are approved" → Partner Checklist to developer@gusto.com → QA review → production keys. [O]
- Durations [NF] officially; security review ~1 week (Merge: https://help.merge.dev/en/articles/10354314-gusto-how-do-i-set-up-my-integration) vs 2–4 weeks (Finch: https://developer.tryfinch.com/implementation-guide/Deploy/Security-Reviews) [C][R].

## Not verifiable this session
DocuSign Go-Live page body (JS-rendered), Xero devblog (403), Gusto FAQ (403); dev-setup steps for Google/Slack/DocuSign from prior knowledge.
