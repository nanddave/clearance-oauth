import type { AutoCheckRule } from "../schema";
import { describe, it, expect } from "vitest";
import { isBlockedAddress, checkUrl, safeFetch } from "./safe-fetch";
import { findPrivacyLink, evaluateRule, runChecks } from "./checks";

describe("isBlockedAddress", () => {
  it.each(["127.0.0.1", "::1", "10.0.0.5", "172.16.0.1", "192.168.1.1", "169.254.169.254", "fd00::1",
    "0.0.0.0", "100.64.0.1", "::ffff:127.0.0.1", "::ffff:7f00:1", "fe80::1", "fec0::1", "::ffff:0:127.0.0.1", "::ffff:0:a00:1", "::", "garbage"])("blocks %s", (ip) => {
    expect(isBlockedAddress(ip)).toBe(true);
  });
  it.each(["8.8.8.8", "2606:4700:4700::1111", "::ffff:8.8.8.8"])("allows %s", (ip) => {
    expect(isBlockedAddress(ip)).toBe(false);
  });
});

const pub = async () => ["8.8.8.8"];
describe("checkUrl / safeFetch guard", () => {
  it("rejects http:// urls", async () => expect(await checkUrl("http://example.com", pub)).toMatch(/https/));
  it("rejects localhost and private IP literals", async () => {
    for (const u of ["https://localhost", "https://10.0.0.1", "https://169.254.169.254/x", "https://[::1]/"])
      expect(await checkUrl(u, pub)).not.toBeNull();
  });
  it("rejects hosts resolving to private addresses", async () =>
    expect(await checkUrl("https://evil.test", async () => ["8.8.8.8", "10.0.0.1"])).not.toBeNull());
  it("refuses redirect to an internal address", async () => {
    const f = (async () => new Response(null, { status: 302, headers: { location: "https://169.254.169.254/" } })) as unknown as typeof fetch;
    expect(await safeFetch("https://example.com", pub, f)).toEqual({ error: expect.stringMatching(/not allowed/) });
  });
  it("stops after 3 redirects", async () => {
    const f = (async () => new Response(null, { status: 302, headers: { location: "https://example.com/" } })) as unknown as typeof fetch;
    expect(await safeFetch("https://example.com", pub, f)).toEqual({ error: "Too many redirects" });
  });
  it("caps body at 1 MB", async () => {
    const f = (async () => new Response("a".repeat(3 * 1024 * 1024))) as unknown as typeof fetch;
    const r = await safeFetch("https://example.com", pub, f);
    expect("html" in r && r.html.length).toBe(1024 * 1024);
  });
});

describe("pure helpers", () => {
  it("finds /privacy link on same domain only", () => {
    expect(findPrivacyLink('<a href="/privacy">Privacy Policy</a>', "https://www.acme.com/")).toBe("https://www.acme.com/privacy");
    expect(findPrivacyLink('<a href="https://other.com/privacy">Privacy</a>', "https://acme.com/")).toBeNull();
  });
  const page = (html: string) => ({ url: "https://acme.com/", status: 200, html });
  it("phrase_present passes on Limited Use case-insensitively", () => {
    const r = evaluateRule({ type: "phrase_present", page: "privacy", anyOf: ["Limited Use"] }, { homepage: page(""), privacy: page("<p>we follow limited use rules</p>") });
    expect(r.status).toBe("pass");
  });
  it("support_email_on_domain fails for gmail address", () => {
    expect(evaluateRule({ type: "support_email_on_domain" }, { homepage: page("mailto:me@gmail.com"), privacy: null }).status).toBe("fail");
    expect(evaluateRule({ type: "support_email_on_domain" }, { homepage: page("help@mail.acme.com"), privacy: null }).status).toBe("pass");
  });
  it("homepage error → fail, dependents unsure", async () => {
    const res = await runChecks("https://localhost", [
      { reqId: "a", rule: { type: "homepage_loads" } },
      { reqId: "b", rule: { type: "privacy_policy_found" } },
    ]);
    expect(res.map((r) => r.status)).toEqual(["fail", "unsure"]);
  });
  it("no privacy page → found fails, phrase unsure", () => {
    const pages = { homepage: page("<p>hi</p>"), privacy: null };
    expect(evaluateRule({ type: "privacy_policy_found" }, pages).status).toBe("fail");
    expect(evaluateRule({ type: "phrase_present", page: "privacy", anyOf: ["x"] }, pages).status).toBe("unsure");
  });

  const ms = (f: () => unknown) => { const t = performance.now(); f(); return performance.now() - t; };
  const MB = 1024 * 1024;
  const pg = (html: string) => ({ url: "https://acme.com/", status: 200, html });
  it("email check is not ReDoS-able", () => {
    for (const h of ["a".repeat(MB), "a@".repeat(MB / 2)])
      expect(ms(() => evaluateRule({ type: "support_email_on_domain" }, { homepage: pg(h), privacy: null }))).toBeLessThan(500);
  });
  it("findPrivacyLink and text stripping are linear on adversarial input", () => {
    expect(ms(() => findPrivacyLink('<a href="p">'.repeat(MB / 12), "https://acme.com/"))).toBeLessThan(500);
    expect(ms(() => findPrivacyLink("<a ".repeat(MB / 3), "https://acme.com/"))).toBeLessThan(500);
    for (const h of ["<script>".repeat(MB / 8), "<".repeat(MB), "<style>x".repeat(MB / 8), "<script></script>".repeat(MB / 17), "<style></style>".repeat(MB / 15), "<script></style>".repeat(MB / 16) + "</script>"])
      expect(ms(() => evaluateRule({ type: "phrase_present", page: "homepage", anyOf: ["x"] }, { homepage: pg(h), privacy: null }))).toBeLessThan(500);
  });
  it("non-2xx homepage: dependents unsure, homepage_loads fails", () => {
    const pages = { homepage: { url: "https://acme.com/", status: 500, html: "<a href='/privacy'>privacy</a> a@acme.com" }, privacy: null };
    expect(evaluateRule({ type: "homepage_loads" }, pages).status).toBe("fail");
    for (const rule of [{ type: "privacy_policy_found" }, { type: "support_email_on_domain" }, { type: "phrase_present", page: "homepage", anyOf: ["x"] }] satisfies AutoCheckRule[])
      expect(evaluateRule(rule, pages).status).toBe("unsure");
  });
  it("500 homepage triggers no privacy fetch", async () => {
    let calls = 0;
    const f = (async () => { calls++; return new Response("<a href='/privacy'>privacy</a>", { status: 500 }); }) as unknown as typeof fetch;
    const res = await runChecks("https://acme.com", [{ reqId: "p", rule: { type: "privacy_policy_found" } }], pub, f);
    expect(calls).toBe(1);
    expect(res[0].status).toBe("unsure");
  });
});
