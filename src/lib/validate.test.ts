import { describe, expect, it } from "vitest";
import { getGuide } from "./guides";
import type { Guide } from "./schema";
import { validateGuide } from "./validate";

const docusign = () => structuredClone(getGuide("docusign")!) as Guide;

describe("validateGuide", () => {
  it("reports a dependency on a step that doesn't exist", () => {
    const g = docusign();
    g.gates[1].dependsOn.push("ghost");
    expect(validateGuide(g)).toContain("gate integration_key: dependsOn ghost missing");
  });

  it("reports a cycle instead of crashing", () => {
    const g = docusign();
    g.gates[0].dependsOn.push(g.gates[1].id);
    expect(validateGuide(g).some((e) => e.includes("cycle"))).toBe(true);
  });

  it("reports a cycle that only exists through afterGates", () => {
    const g = structuredClone(getGuide("slack")!) as Guide;
    g.requirements.find((r) => r.id === "installs10")!.afterGates = ["preliminary"]; // installs after the review that needs them
    expect(validateGuide(g).some((e) => e.includes("cycle"))).toBe(true);
  });

  it("rejects an optional step that always applies", () => {
    const g = docusign();
    g.gates[0].title = "Optional: request extra scopes";
    delete g.gates[0].appliesWhen;
    expect(validateGuide(g).some((e) => e.startsWith(`gate ${g.gates[0].id}:`) && e.includes("toggle"))).toBe(true);
    g.gates[0].appliesWhen = { [g.toggles[0].id]: [g.toggles[0].options[0].id] };
    expect(validateGuide(g).some((e) => e.includes("optional"))).toBe(false);
  });

  it("a review step needs a cited claim that a review exists", () => {
    const g = structuredClone(getGuide("calendly") ?? getGuide("xero")!);
    g.gates.push({ ...g.gates[0], id: "guess_review", title: "Confirm whether the provider reviews apps", kind: "review", waitDays: "unknown", dependsOn: [], requires: [], claimIds: [g.claims.find((c) => !/review|approv|certif|verif|audit|assessment|vet/i.test(c.text))!.id] });
    expect(validateGuide(g).some((e) => e.includes("guess_review"))).toBe(true);
  });
});

