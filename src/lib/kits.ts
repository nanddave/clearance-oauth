import type { Guide } from "./schema";

/** Composio's callback for custom auth configs (docs.composio.dev, programmatic auth configs, checked 2026-10-28). */
export const COMPOSIO_REDIRECT = "https://backend.composio.dev/api/v3/toolkits/auth/callback";

export type Kit =
  | { kind: "slack-manifest" }
  | { kind: "github-manifest" }
  | { kind: "copy"; label: string; text: string; note?: string };

/** Slack's documented pre-fill link: opens app creation with the bot scopes and the Composio redirect already set. */
export function slackManifestUrl(appName: string, scopes = "chat:write"): string {
  const name = appName.trim().slice(0, 35) || "My agent";
  const bot = scopes.split(/[\s,]+/).map((x) => x.trim()).filter(Boolean);
  const manifest = {
    display_information: { name },
    features: { bot_user: { display_name: name, always_online: false } },
    oauth_config: { redirect_urls: [COMPOSIO_REDIRECT], scopes: { bot: bot.length ? bot : ["chat:write"] } },
  };
  return `https://api.slack.com/apps?new_app=1&manifest_json=${encodeURIComponent(JSON.stringify(manifest))}`;
}

/** GitHub App manifest. GitHub sends the browser back to `returnUrl` with a code we never exchange, so no secret reaches us. */
export function githubManifest(appName: string, homepage: string, returnUrl: string): string {
  return JSON.stringify({
    name: appName.trim().slice(0, 34) || "My agent",
    url: homepage,
    redirect_url: returnUrl,
    callback_urls: [COMPOSIO_REDIRECT],
    public: false,
    default_permissions: { metadata: "read" }, // the minimum; add what your tools need on GitHub's page before creating
  });
}

// A read-only tool to prove the connection works. Names we're fairly sure of; otherwise the developer picks one.
const TEST_TOOL: Record<string, string> = { gmail: "GMAIL_GET_PROFILE", github: "GITHUB_GET_THE_AUTHENTICATED_USER" };

function connectAndCheck(guide: Guide): string {
  const tool = TEST_TOOL[guide.slug];
  const base = `const request = await composio.connectedAccounts.link("test-user", authConfig.id);
console.log("Open this link and approve:", request.redirectUrl);
const account = await request.waitForConnection(120_000);
console.log("Connection:", account.status); // ACTIVE = this user can connect

// Connection check: ACTIVE doesn't prove a tool works, so run one read-only tool.
`;
  const run = (slug: string) => `const result = await composio.tools.execute(${slug}, {
  userId: "test-user",
  arguments: {},
  dangerouslySkipVersionCheck: true,
});
console.log("Tool check:", result.successful ? "OK" : \`failed: \${result.error}\`); // prints no account data
`;
  return tool
    ? base + `// ${tool} is our best guess; check the exact name in Composio's ${guide.name} tool list.\n` + run(`process.env.TEST_TOOL ?? "${tool}"`)
    : base +
        `// We don't know a safe read-only ${guide.name} tool: set TEST_TOOL to a GET or LIST tool from Composio's tool list.
if (process.env.TEST_TOOL) {
${run("process.env.TEST_TOOL")
  .split("\n")
  .map((l) => (l ? "  " + l : l))
  .join("\n")}} else console.log("Tool check: skipped (set TEST_TOOL to run one)");
`;
}

export function setupScript(guide: Guide): string {
  const env = guide.slug.toUpperCase().replace(/-/g, "_");
  return `// setup-composio.ts: run on your machine with \`npx tsx setup-composio.ts\`
// needs: npm i @composio/core, and COMPOSIO_API_KEY, ${env}_CLIENT_ID, ${env}_CLIENT_SECRET in your env
import { Composio } from "@composio/core";

const composio = new Composio();
// "${guide.slug}" is our name for it; check Composio's toolkit list if create fails
const authConfig = await composio.authConfigs.create("${guide.slug}", {
  type: "use_custom_auth",
  authScheme: "OAUTH2",
  name: "${guide.name} (own app)",
  credentials: {
    client_id: process.env.${env}_CLIENT_ID!,
    client_secret: process.env.${env}_CLIENT_SECRET!,
    // set explicitly: some toolkits default to an older callback if this is left out
    oauth_redirect_uri: "${COMPOSIO_REDIRECT}",
  },
});
console.log("Auth config:", authConfig.id);

${connectAndCheck(guide)}`;
}

export function managedScript(guide: Guide): string {
  return `// connect-managed.ts: run on your machine with \`npx tsx connect-managed.ts\`
// needs: npm i @composio/core, and COMPOSIO_API_KEY in your env
import { Composio } from "@composio/core";

const composio = new Composio();
const authConfig = await composio.authConfigs.create("${guide.slug}", {
  type: "use_composio_managed_auth",
  name: "${guide.name} (Composio app)",
});
console.log("Auth config:", authConfig.id);

${connectAndCheck(guide)}`;
}

// The step after which the developer has a client ID and secret to give Composio.
const SETUP_GATE: Record<string, string> = {
  gmail: "create_project",
  slack: "create_app",
  docusign: "integration_key",
  xero: "create_app",
  github: "create_app",
  gusto: "sandbox",
};

const COPY: Record<string, Kit[]> = {
  "gmail:limited_use": [
    {
      kind: "copy",
      label: "Limited Use statement for your privacy policy",
      text: "[Your app]'s use and transfer to any other app of information received from Google APIs will adhere to the Google API Services User Data Policy, including the Limited Use requirements.",
      note: "Replace [Your app] with the name on your consent screen, and link the policy name to Google's page.",
    },
  ],
  "gmail:sensitive": [
    {
      kind: "copy",
      label: "Justification for gmail.send",
      text: "[Your app] lets a user's AI assistant send emails they ask it to send, from their own Gmail account. We request only gmail.send because the app never reads the mailbox. Emails are sent only after the user asks; we store no message content.",
      note: "Edit it to match exactly what your app does; your demo video must show the same flow.",
    },
  ],
  "gmail:restricted": [
    {
      kind: "copy",
      label: "Justification for read scopes",
      text: "[Your app] lets a user's AI assistant read and summarise the emails the user asks about. We request [scope] because [the narrower scope cannot do X]. Message content is processed only to answer the user's request and is not used for advertising or to train models.",
      note: "Google rejects vague answers: name the exact feature, and why a narrower scope is not enough.",
    },
  ],
  "gusto:preapproval": [
    {
      kind: "copy",
      label: "Email to developer@gusto.com",
      text: "Subject: Production pre-approval: [Your app]\n\nHi Gusto team,\n\nWe're building [Your app], which [one line on what it does for Gusto customers]. Our sandbox app is working, and we'd like to apply for production access.\n\nCould you tell us the current timeline for pre-approval and the security review, and anything you need from us beyond the pre-approval application?\n\nThanks,\n[Name], [role], [company]",
    },
  ],
};

/** What we can do or prepare for one step (gate or requirement id). Empty means only the written step. */
export function kitsFor(guide: Guide, id: string): Kit[] {
  if (id === "managed_connect")
    return [
      {
        kind: "copy",
        label: "Connect and check it works (run on your machine)",
        text: managedScript(guide),
        note: "Uses your Composio key from your own environment; nothing is sent to us. Paste the last two lines it prints into “Got an error?” if something fails.",
      },
    ];
  const kits = [...(COPY[`${guide.slug}:${id}`] ?? [])];
  if (guide.slug === "slack" && id === "create_app") kits.unshift({ kind: "slack-manifest" });
  if (guide.slug === "github" && id === "create_app") kits.unshift({ kind: "github-manifest" });
  const setupGate = SETUP_GATE[guide.slug] ?? guide.gates.find((g) => g.phase === "dev")?.id;
  if (id === setupGate)
    kits.push({
      kind: "copy",
      label: "Connect it to Composio (run on your machine)",
      text: setupScript(guide),
      note: `Register ${COMPOSIO_REDIRECT} as the redirect URI in the provider's app first, and confirm it matches the callback Composio shows for your auth config. Your secrets stay on your machine.`,
    });
  return kits;
}
