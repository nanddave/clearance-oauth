import { describe, expect, it } from "vitest";
import { computePlan } from "./engine";
import { getGuide, listGuides } from "./guides";
import { agentView, answers, composioNote, nextAction } from "./next";
import { parseSelection } from "./selection";

const sel = (slug: string, q = "") => {
  const g = getGuide(slug)!;
  return { g, s: parseSelection(g, new URLSearchParams(q)) };
};

describe("nextAction", () => {
  it("is the head of the fastest order, with the next two steps", () => {
    const { g, s } = sel("docusign");
    const plan = computePlan(g, s);
    const n = nextAction(g, plan)!;
    expect(n.id).toBe(plan.order[0].id);
    expect(n.then).toHaveLength(2);
    expect(n.step.length).toBeGreaterThan(20);
  });

  it("moves on when a requirement is ticked as in place", () => {
    const { g } = sel("gmail");
    const before = nextAction(g, computePlan(g, parseSelection(g, new URLSearchParams("t.uses=read&t.audience=external"))))!;
    expect(before.kind).toBe("requirement"); // long-lead items start day 1
    expect(before.startDay1).toBe(true);
    const after = nextAction(g, computePlan(g, parseSelection(g, new URLSearchParams(`t.uses=read&t.audience=external&have=${before.id}`))))!;
    expect(after.id).not.toBe(before.id);
  });

  it("maps agentCan to who does it", () => {
    const { g, s } = sel("slack", "t.distribution=internal");
    expect(nextAction(g, computePlan(g, s))).toMatchObject({ id: "create_app", who: "do" });
  });
});

describe("composioNote", () => {
  it("changes with what the agent does", () => {
    const g = getGuide("gmail")!;
    const send = composioNote(g, parseSelection(g, new URLSearchParams("t.uses=send&t.audience=external")));
    const read = composioNote(g, parseSelection(g, new URLSearchParams("t.uses=read&t.audience=external")));
    expect(send).toMatch(/sensitive/);
    expect(read).toMatch(/restricted/);
  });

  it("is null when the guide has no notes", () => {
    const { g, s } = sel("xero");
    expect(composioNote(g, s)).toBeNull();
  });
});

describe("answers", () => {
  it("never claims connection or action state", () => {
    for (const g of listGuides()) {
      const a = answers(g, computePlan(g, parseSelection(g, new URLSearchParams())));
      expect(a.map((x) => x.id)).toEqual(["build", "launch", "connect", "action"]);
      expect(a[2].answer).toBe("unknown");
      expect(a[3].answer).toBe("unknown");
    }
  });
});

describe("agentView", () => {
  it("is plain JSON with the selection echoed", () => {
    const { g, s } = sel("gmail", "t.uses=send&have=privacy_policy");
    const v = JSON.parse(JSON.stringify(agentView(g, s)));
    expect(v.version).toBe(1);
    expect(v.selection).toEqual({ toggles: { uses: "send", audience: s.toggles.audience }, have: ["privacy_policy"], done: [] });
    expect(v.verdict.clocks.yours.label).toBeTypeOf("string");
    expect(v.nextAction.title).toBeTypeOf("string");
  });
});
