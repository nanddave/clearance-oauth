import { describe, expect, it } from "vitest";
import { parseGuide } from "./schema";

const gate = {
  id: "g1", title: "Create app", phase: "dev", kind: "setup", owner: "you",
  effortHours: [1, 2], waitDays: [0, 0], dependsOn: [], requires: [],
  blockers: [], agentCan: "draft", claimIds: ["c1"],
};
const guide = () => ({
  slug: "x", name: "X", website: "https://x.com", updatedAt: "2026-10-27", origin: "reviewed",
  composio: { managed: "unknown" },
  toggles: [{ id: "t", label: "T", options: [{ id: "a", label: "A" }], default: "a" }],
  gates: [structuredClone(gate)],
  requirements: [{
    id: "r1", label: "Privacy policy", howToGet: ["write one"], acquireDays: "unknown",
    acquireEffortHours: [1, 3], dependsOn: [], check: { kind: "auto", rule: { type: "https" } }, claimIds: [],
  }],
  claims: [{ id: "c1", text: "t", status: "official", sources: [{ url: "https://x.com", quote: "q", checkedAt: "2026-10-27" }] }],
  summary: "s",
});

describe("parseGuide", () => {
  it("parses a minimal valid guide", () => {
    expect(parseGuide(guide()).slug).toBe("x");
  });
  it('rejects claim status "verified"', () => {
    const g = guide();
    g.claims[0].status = "verified";
    expect(() => parseGuide(g)).toThrow(/claims\.0\.status/);
  });
  it("rejects waitDays [5, 2]", () => {
    const g = guide();
    (g.gates[0] as { waitDays: unknown }).waitDays = [5, 2];
    expect(() => parseGuide(g)).toThrow(/gates\.0\.waitDays/);
  });
});
