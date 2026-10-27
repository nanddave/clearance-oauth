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
});
