import { describe, expect, it } from "vitest";
import { getGuide } from "./guides";
import { COMPOSIO_REDIRECT, githubManifest, kitsFor, slackManifestUrl } from "./kits";

describe("kits", () => {
  it("Slack link round-trips an awkward name and carries the Composio redirect", () => {
    const url = new URL(slackManifestUrl('Ana\'s "bot" 🤖'));
    expect(url.searchParams.get("new_app")).toBe("1");
    const m = JSON.parse(url.searchParams.get("manifest_json")!);
    expect(m.display_information.name).toBe('Ana\'s "bot" 🤖');
    expect(m.oauth_config.redirect_urls).toEqual([COMPOSIO_REDIRECT]);
  });

  it("GitHub manifest is valid JSON with the callback and a return URL", () => {
    const m = JSON.parse(githubManifest("", "https://x.dev", "https://clearance.test/g/github?done=create_app"));
    expect(m.name).toBe("My agent");
    expect(m.callback_urls).toEqual([COMPOSIO_REDIRECT]);
    expect(m.redirect_url).toContain("done=create_app");
  });

  it("puts the setup script on the step that yields credentials, and drafts where we have them", () => {
    const gmail = getGuide("gmail")!;
    expect(kitsFor(gmail, "create_project").some((k) => k.kind === "copy" && k.text.includes('authConfigs.create("gmail"'))).toBe(true);
    expect(kitsFor(gmail, "limited_use")[0]).toMatchObject({ kind: "copy" });
    expect(kitsFor(getGuide("slack")!, "create_app")[0].kind).toBe("slack-manifest");
    expect(kitsFor(getGuide("xero")!, "terms")).toEqual([]);
  });
});

describe("setup scripts", () => {
  it("own-app script sets the redirect URI it tells you to register, and checks a tool", () => {
    const k = kitsFor(getGuide("docusign")!, "integration_key").find((x) => x.kind === "copy" && x.text.includes("use_custom_auth"));
    expect(k && k.kind === "copy" && k.text).toContain(`oauth_redirect_uri: "${COMPOSIO_REDIRECT}"`);
    expect(k && k.kind === "copy" && k.text).toContain("tools.execute");
  });

  it("managed lane gets a managed-auth script", () => {
    const [k] = kitsFor(getGuide("gmail")!, "managed_connect");
    expect(k.kind === "copy" && k.text).toContain('type: "use_composio_managed_auth"');
    expect(k.kind === "copy" && k.text).toContain("GMAIL_GET_PROFILE");
  });

  it("Slack link uses the scopes you typed", () => {
    const m = JSON.parse(new URL(slackManifestUrl("x", "chat:write, users:read")).searchParams.get("manifest_json")!);
    expect(m.oauth_config.scopes.bot).toEqual(["chat:write", "users:read"]);
  });
});
