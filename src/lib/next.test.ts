import { describe, expect, it } from "vitest";
import { computePlan } from "./engine";
import { getGuide, listGuides } from "./guides";
import { agentView, answers, composioNote, nextAction, routeStatus } from "./next";
import { parseSelection, toSearchParams } from "./selection";

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

  it("moves on when the current step is done or held", () => {
    const { g } = sel("gmail");
    const q = "t.uses=read&t.audience=external";
    const before = nextAction(g, computePlan(g, parseSelection(g, new URLSearchParams(q))))!;
    expect(before.id).toBe("create_project"); // the CASA letter can't come before the assessment
    const key = before.kind === "gate" ? "done" : "have";
    const after = nextAction(g, computePlan(g, parseSelection(g, new URLSearchParams(`${q}&${key}=${before.id}`))))!;
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
      expect(a.map((x) => x.id)).toEqual(["managed", "build", "launch", "connect", "action"]);
      expect(a[3].answer).toBe("unknown");
      expect(a[4].answer).toBe("unknown");
    }
  });
});

describe("agentView", () => {
  it("is plain JSON with the selection echoed", () => {
    const { g, s } = sel("gmail", "t.uses=send&have=privacy_policy");
    const v = JSON.parse(JSON.stringify(agentView(g, s)));
    expect(v.version).toBe(3);
    expect(v.selection).toEqual({ toggles: { uses: "send", audience: s.toggles.audience }, have: ["privacy_policy"], done: [], lane: "managed" });
    expect(v.decision).toMatchObject({ lane: "managed", managedAvailable: true, connection: "unknown", provenance: { have: "user_reported" } });
    expect(v.nextAction.id).toBe("managed_connect");
    expect(v.verdict.clocks.yours.label).toBeTypeOf("string");
    expect(v.nextAction.title).toBeTypeOf("string");
  });
});

describe("lanes", () => {
  it("defaults to Composio's app when it manages the OAuth, and to your own app otherwise", () => {
    expect(sel("github").s.lane).toBe("managed");
    expect(sel("github", "lane=own").s.lane).toBe("own");
    expect(sel("docusign", "lane=managed").s.lane).toBeUndefined(); // no managed app: no lane to choose
    expect(toSearchParams(sel("docusign").s)).not.toContain("lane");
  });

  it("a generated guide without a verified OAuth claim answers unknown, not yes", () => {
    const g = structuredClone(getGuide("docusign")!);
    g.origin = "generated";
    g.claims = g.claims.map((c) => ({ ...c, status: "unknown" as const }));
    const a = answers(g, computePlan(g, parseSelection(g, new URLSearchParams())));
    expect(a.find((x) => x.id === "build")!.answer).toBe("unknown");
  });
});

describe("decision", () => {
  it("own-app next step stays the own-app step even on the managed lane", () => {
    const { g, s } = sel("gmail");
    const v = agentView(g, s);
    expect(v.decision.lane).toBe("managed");
    expect(v.decision.ownApp.nextStepId).not.toBe("managed_connect");
  });

  it("a placeholder guide is never launch-ready", () => {
    const g = structuredClone(getGuide("github")!);
    g.origin = "generated";
    g.claims = [{ id: "s", text: "Stub: live research not yet connected", status: "unknown", sources: [] }];
    g.gates = [];
    expect(agentView(g, parseSelection(g, new URLSearchParams())).decision.ownApp.status).toBe("unknown");
  });
});

describe("routeStatus", () => {
  const route = (slug: string, q = "") => {
    const { g, s } = sel(slug, q);
    return routeStatus(g, s, computePlan(g, s));
  };

  it("Gmail read on Composio's app is test-only until scopes are confirmed; send is testable", () => {
    expect(route("gmail", "t.uses=read&t.audience=external").managed.state).toBe("scope_unconfirmed");
    expect(route("gmail", "t.uses=read_send&t.audience=external").managed.state).toBe("scope_unconfirmed");
    expect(route("gmail", "t.uses=send&t.audience=external").managed.state).toBe("can_test");
    expect(route("docusign").managed.state).toBe("unavailable");
    expect(route("gmail", "t.uses=read&t.audience=internal").managed.state).toBe("scope_unconfirmed");
    expect(route("gmail", "t.uses=send&t.audience=internal").managed.state).toBe("can_test");
  });

  it("read and send needs the read approvals, without a second send review", () => {
    const { g, s } = sel("gmail", "t.uses=read_send&t.audience=external");
    const ids = computePlan(g, s).gates.map((x) => x.id);
    expect(ids).toEqual(expect.arrayContaining(["restricted", "casa"]));
    expect(ids).not.toContain("sensitive");
  });

  it("an empty plan with nothing ticked is not reported complete", () => {
    const g = structuredClone(getGuide("github")!);
    g.gates = [];
    g.requirements = [];
    const s = parseSelection(g, new URLSearchParams());
    expect(routeStatus(g, s, computePlan(g, s)).own.state).toBe("in_progress");
  });

  it("ticking every step is reported complete, never verified", () => {
    const g = getGuide("docusign")!;
    const q = `have=${g.requirements.map((r) => r.id).join(",")}&done=${g.gates.map((x) => x.id).join(",")}`;
    const v = agentView(g, parseSelection(g, new URLSearchParams(q)));
    expect(v.decision.ownApp).toMatchObject({ status: "reported_complete", verified: false });
  });
});

describe("share links", () => {
  it("round-trip the selection through the query string", () => {
    const { g, s } = sel("gmail", "t.uses=read_send&have=privacy_policy,homepage&done=brand&lane=own");
    const again = parseSelection(g, new URLSearchParams(toSearchParams(s)));
    expect(again).toEqual(s);
    expect(toSearchParams(s)).toContain("have=privacy_policy,homepage");
  });

  it("the schema rejects ids that would break the query string", async () => {
    const { GuideSchema } = await import("./schema");
    const g = structuredClone(getGuide("gmail")!);
    g.toggles[0].options[0].id = "a&b=c";
    expect(GuideSchema.safeParse(g).success).toBe(false);
  });
});
