import { describe, it, expect } from "vitest";
import type { Gate, Guide, Requirement } from "./schema";
import { computePlan, formatClock, type Selection } from "./engine";
import { getGuide } from "./guides";
import { parseSelection, toSearchParams } from "./selection";

const g = (id: string, o: Partial<Gate> = {}): Gate => ({
  id, title: id, phase: "production", kind: "setup", owner: "you", effortHours: [0, 0], waitDays: [0, 0],
  dependsOn: [], requires: [], blockers: [], agentCan: "none", claimIds: [], ...o,
});
const r = (id: string, o: Partial<Requirement> = {}): Requirement => ({
  id, label: id, howToGet: [], acquireDays: [0, 0], acquireEffortHours: [0, 0], dependsOn: [],
  check: { kind: "self" }, claimIds: [], ...o,
});
const guide = (gates: Gate[], requirements: Requirement[] = []): Guide => ({
  slug: "x", name: "X", website: "https://x.com", updatedAt: "2026-01-01", origin: "reviewed",
  composio: { managed: false },
  toggles: [{ id: "t", label: "T", options: [{ id: "a", label: "A" }, { id: "b", label: "B" }], default: "a" }],
  gates, requirements, claims: [], summary: "",
});
const sel = (toggles: Record<string, string> = {}, have: string[] = []): Selection => ({ toggles, have: new Set(have) });

describe("engine", () => {
  it("sums effort and wait along the longest dependency path", () => {
    const p = computePlan(guide([g("A", { effortHours: [6, 6], waitDays: [2, 2] }), g("B", { dependsOn: ["A"], waitDays: [3, 4] })]), sel());
    expect(p.ideal).toEqual({ min: 6, max: 7, unknown: false });
  });
  it("parallel branches take the max, not the sum", () => {
    const p = computePlan(guide([g("A", { waitDays: [2, 5] }), g("B", { waitDays: [3, 4] })]), sel());
    expect(p.ideal).toEqual({ min: 3, max: 5, unknown: false });
  });
  it("unknown wait marks the clock unknown and keeps known minimum", () => {
    const p = computePlan(guide([g("A", { waitDays: [2, 2] }), g("B", { dependsOn: ["A"], waitDays: "unknown" })]), sel());
    expect(p.ideal).toEqual({ min: 2, max: 2, unknown: true });
  });
  it("unknown requirement acquireDays marks yours unknown", () => {
    const p = computePlan(guide([g("A", { requires: ["R"] })], [r("R", { acquireDays: "unknown" })]), sel());
    expect(p.yours.unknown).toBe(true);
    expect(p.ideal.unknown).toBe(false);
  });
  it("missing requirement adds its acquire time before the gate that requires it", () => {
    const gd = guide([g("A", { waitDays: [1, 1], requires: ["R"] })], [r("R", { acquireDays: [2, 3], acquireEffortHours: [6, 6] })]);
    const p = computePlan(gd, sel());
    expect(p.ideal).toEqual({ min: 1, max: 1, unknown: false });
    expect(p.yours).toEqual({ min: 4, max: 5, unknown: false });
    expect(p.missing.map((x) => x.id)).toEqual(["R"]);
    expect(computePlan(gd, sel({}, ["R"])).yours).toEqual(p.ideal);
  });
  it("requirement dependsOn is respected and pulled in as missing", () => {
    const gd = guide([g("A", { requires: ["R2"] })], [r("R1", { acquireDays: [2, 2] }), r("R2", { acquireDays: [1, 1], dependsOn: ["R1"] })]);
    const p = computePlan(gd, sel());
    expect(p.yours.max).toBe(3);
    expect(p.missing.map((x) => x.id).sort()).toEqual(["R1", "R2"]);
  });
  it("dev clock covers dev gates and their requirements only", () => {
    const gd = guide(
      [g("D", { phase: "dev", waitDays: [1, 1], requires: ["R"] }), g("P", { dependsOn: ["D"], waitDays: [10, 10] })],
      [r("R", { acquireDays: [2, 2] })],
    );
    const p = computePlan(gd, sel());
    expect(p.dev).toEqual({ min: 3, max: 3, unknown: false });
    expect(p.ideal.max).toBe(11);
  });
  it("appliesWhen filters gates by toggle", () => {
    const gd = guide([g("A", { waitDays: [5, 5], appliesWhen: { t: ["b"] } })]);
    expect(computePlan(gd, sel()).gates).toHaveLength(0);
    expect(computePlan(gd, sel({ t: "b" })).gates).toHaveLength(1);
  });
  it("skips dependencies that do not apply", () => {
    const gd = guide([g("A", { waitDays: [5, 5], appliesWhen: { t: ["b"] } }), g("B", { dependsOn: ["A"], waitDays: [1, 1] })]);
    const p = computePlan(gd, sel());
    expect(p.ideal.max).toBe(1);
    expect(p.order.map((o) => o.id)).toEqual(["B"]);
  });
  it("tier rules", () => {
    const t = (...gs: Gate[]) => computePlan(guide(gs), sel()).tier;
    expect(t(g("a", { kind: "partner" }))).toBe("gated");
    expect(t(g("a", { kind: "review" }))).toBe("review");
    expect(t(g("a"))).toBe("self-serve");
    expect(t(g("a", { kind: "unavailable" }), g("b", { kind: "partner" }))).toBe("blocked");
    expect(t(g("a", { kind: "review", waitDays: [10, 30] }))).toBe("gated");
  });
  it("topBlocker is largest max wait, unknown largest, ties by kind; null when no waits", () => {
    expect(computePlan(guide([g("a")]), sel()).topBlocker).toBeNull();
    const w = (id: string, kind: Gate["kind"], d: [number, number] | "unknown") => g(id, { kind, waitDays: d });
    expect(computePlan(guide([w("a", "review", [1, 5]), w("b", "legal", [1, 5]), w("c", "setup", [1, 2])]), sel()).topBlocker?.id).toBe("b");
    expect(computePlan(guide([w("a", "review", [1, 5]), w("b", "setup", "unknown")]), sel()).topBlocker?.id).toBe("b");
  });
  it("topBlocker prefers a known wait over 7 days to unknown waits", () => {
    const w = (id: string, kind: Gate["kind"], d: [number, number] | "unknown") => g(id, { kind, waitDays: d });
    expect(computePlan(guide([w("a", "review", [1, 30]), w("b", "setup", "unknown"), w("c", "review", [1, 10])]), sel()).topBlocker?.id).toBe("a");
    expect(computePlan(guide([w("a", "review", [1, 5]), w("b", "setup", "unknown")]), sel()).topBlocker?.id).toBe("b");
  });
  it("long-lead missing requirement is first in order with startDay1 true", () => {
    const gd = guide(
      [g("A", { requires: ["Short", "Long"] })],
      [r("Short", { acquireDays: [1, 2] }), r("Long", { acquireDays: [5, 10] })],
    );
    const o = computePlan(gd, sel()).order;
    expect(o[0]).toEqual({ id: "Long", kind: "requirement", startDay1: true });
    expect(o.find((x) => x.id === "Short")?.startDay1).toBe(false);
    expect(o[o.length - 1].id).toBe("A");
  });
  it("throws on dependency cycle", () => {
    expect(() => computePlan(guide([g("A", { dependsOn: ["B"] }), g("B", { dependsOn: ["A"] })]), sel())).toThrow(/cycle/i);
  });
  it("formatClock", () => {
    expect(formatClock({ min: 3, max: 7.2, unknown: false })).toBe("3–8 days");
    expect(formatClock({ min: 3, max: 3, unknown: false })).toBe("3 days");
    expect(formatClock({ min: 3, max: 3, unknown: true })).toBe("≥ 3 days + unknown");
    expect(formatClock({ min: 0, max: 0.5, unknown: false })).toBe("same day");
  });
});

describe("done gates", () => {
  const g = getGuide("docusign")!;
  const sel = (q: string) => parseSelection(g, new URLSearchParams(q));

  it("drop out of the order and the next step, while dependants still schedule", () => {
    const all = computePlan(g, sel(""));
    const after = computePlan(g, sel("done=dev_account"));
    expect(all.order[0].id).toBe("dev_account");
    expect(after.order.some((o) => o.id === "dev_account")).toBe(false);
    expect(after.order.some((o) => o.id === "integration_key")).toBe(true);
    expect(after.yours.max).toBeLessThanOrEqual(all.yours.max);
  });

  it("all done: empty order, no blocker, tier unchanged", () => {
    const ids = computePlan(g, sel("")).gates.map((x) => x.id).join(",");
    const p = computePlan(g, sel(`done=${ids}&have=paid_account`));
    expect(p.order).toEqual([]);
    expect(p.topBlocker).toBeNull();
    expect(p.tier).toBe(computePlan(g, sel("")).tier);
  });

  it("ignores unknown ids and round-trips through the URL", () => {
    const s = sel("done=dev_account,nope");
    expect([...s.done!]).toEqual(["dev_account"]);
    expect(toSearchParams(s)).toContain("done=dev_account");
  });
});
