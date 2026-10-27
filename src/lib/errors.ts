/** Known OAuth setup errors. Matching is plain text; no model guesses. `gate` is the step the error points back to. */
export type KnownError = { id: string; apps: string[] | "any"; match: RegExp; meaning: string; fix: string; gate?: string };

export const KNOWN_ERRORS: KnownError[] = [
  {
    id: "redirect_mismatch",
    apps: "any",
    match: /redirect_uri_mismatch|bad_redirect_uri|redirect[_ ]uri.{0,40}(mismatch|not match|invalid|not registered)|invalid_redirect_uri/i,
    meaning: "The redirect URI in the provider's app does not exactly match the one Composio sends.",
    fix: "Add https://backend.composio.dev/api/v3/toolkits/auth/callback to the app's redirect URIs, exactly, with no trailing slash.",
  },
  {
    id: "google_not_test_user",
    apps: ["gmail"],
    match: /access_denied|has not completed the Google verification process|not been verified by Google/i,
    meaning: "Your Google app is in Testing and this account is not on its test-user list, or the app isn't verified for these scopes.",
    fix: "Add the account under Google Auth Platform → Audience → Test users (100 at most), or finish verification.",
    gate: "create_project",
  },
  {
    id: "google_app_blocked",
    apps: ["gmail"],
    match: /this app is blocked|app is blocked/i,
    meaning: "Google is blocking an unverified app that asks for sensitive or restricted scopes.",
    fix: "Request fewer scopes for testing, or complete scope verification in Verification Center.",
  },
  {
    id: "google_token_expired",
    apps: ["gmail"],
    match: /invalid_grant|token has been expired or revoked/i,
    meaning: "The refresh token stopped working. In Testing mode Google expires refresh tokens after 7 days.",
    fix: "Reconnect the account. For tokens that last, move the app to In production (and verify if your scopes need it).",
  },
  {
    id: "invalid_client",
    apps: "any",
    match: /invalid_client|unauthorized_client|client authentication failed/i,
    meaning: "The client ID or secret Composio holds doesn't match the provider's app.",
    fix: "Copy the client ID and secret again into your Composio auth config; check you used the production keys if the app went live.",
  },
  {
    id: "invalid_scope",
    apps: "any",
    match: /invalid_scope|scope.{0,30}(not allowed|invalid|not authorized)/i,
    meaning: "The app asks for a scope it hasn't been granted or that doesn't exist.",
    fix: "Add the scope in the provider's app settings, or remove it from the Composio auth config's scopes.",
  },
  {
    id: "slack_ratelimited",
    apps: ["slack"],
    match: /ratelimited|rate_limited/i,
    meaning: "Slack is rate-limiting this app. Commercial apps outside the Marketplace get 1 conversations.history request a minute.",
    fix: "Slow down history calls, or list the app in the Slack Marketplace.",
    gate: "nonmarketplace_limits",
  },
  {
    id: "docusign_consent_required",
    apps: ["docusign"],
    match: /consent_required/i,
    meaning: "The DocuSign user hasn't granted your integration key consent yet.",
    fix: "Send the user through the consent (authorization) URL once, then retry.",
  },
];

export function decodeError(text: string, slug?: string): KnownError[] {
  const t = text.slice(0, 5000);
  return KNOWN_ERRORS.filter((e) => (e.apps === "any" || !slug || e.apps.includes(slug)) && e.match.test(t));
}
