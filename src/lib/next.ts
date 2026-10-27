import { applies, computePlan, type Plan, type Selection } from "./engine";
import type { Gate, Guide, Requirement } from "./schema";
import { TIER_LABEL, clockLabel, isStub, waitLabel } from "./display";

export type Who = "do" | "draft" | "you";
export type NextAction = {
  kind: "gate" | "requirement";
  id: string;
  title: string;
  who: Who; // do = an agent performs it, draft = an agent prepares it, you = only you can
  owner: Gate["owner"];
  step: string;
  wait: string | null; // provider wait after this step, when there is one
  whatToAsk: string | null;
  startDay1: boolean;
  then: string[];
};

const WHO: Record<Gate["agentCan"], Who> = { do: "do", draft: "draft", none: "you" };

/** The single next thing to do: the head of the fastest order, plus the two steps after it. */
export function nextAction(guide: Guide, plan: Plan): NextAction | null {
  type Item = { o: Plan["order"][number]; title: string } & ({ g: Gate; r?: never } | { r: Requirement; g?: never });
  const items = plan.order.flatMap((o): Item[] => {
    if (o.kind === "gate") {
      const g = guide.gates.find((x) => x.id === o.id);
      return g ? [{ o, g, title: g.title }] : [];
    }
    const r = guide.requirements.find((x) => x.id === o.id);
    return r ? [{ o, r, title: `Get: ${r.label}` }] : [];
  });
  const head = items[0];
  if (!head) return null;
  const then = items.slice(1, 3).map((i) => i.title);
  if (head.g) {
    const g = head.g;
    return {
      kind: "gate",
      id: g.id,
      title: g.title,
      who: WHO[g.agentCan],
      owner: g.owner,
      step: g.nextStep ?? g.title,
      wait: g.waitDays === "unknown" ? "unknown" : g.waitDays[1] > 0 ? waitLabel(g.waitDays) : null,
      whatToAsk: g.whatToAsk ?? null,
      startDay1: Boolean(g.startDay1 || head.o.startDay1),
      then,
    };
  }
  const r = head.r;
  return {
    kind: "requirement",
    id: r.id,
    title: head.title,
    who: "you",
    owner: "you",
    step: r.howToGet.map((s) => s.replace(/\.?$/, ".")).join(" "),
    wait: null,
    whatToAsk: r.whatToAsk ?? null,
    startDay1: head.o.startDay1,
    then,
  };
}

/** Composio's answer for this selection: the first matching note, else null (callers fall back to managed). */
export function composioNote(guide: Guide, sel: Selection): string | null {
  return guide.composio.notes?.find((n) => applies(guide, sel, n.when))?.text ?? null;
}

export type Answer = { id: "build" | "launch" | "connect" | "action"; question: string; answer: string; detail: string };

/** What this guide can and cannot answer. The last two need the developer's own account data, so they stay unknown. */
export function answers(guide: Guide, plan: Plan): Answer[] {
  const build = plan.tier === "blocked" ? "no" : isStub(guide) ? "unknown" : "yes";
  const b = plan.topBlocker;
  return [
    {
      id: "build",
      question: "Can this integration be built?",
      answer: build,
      detail:
        build === "unknown"
          ? "Research has not confirmed OAuth support yet."
          : guide.composio.managed === true
            ? "Composio has a managed OAuth app for this toolkit."
            : build === "yes"
              ? "The provider supports OAuth apps; see the steps."
              : "Not available for this use case.",
    },
    {
      id: "launch",
      question: "Can my app launch to real users, and when?",
      answer: `${TIER_LABEL[plan.tier]} · ${clockLabel(plan.yours)}`,
      detail: b ? `#1 blocker: ${b.title} (wait ${waitLabel(b.waitDays)}).` : "No provider wait in your path.",
    },
    {
      id: "connect",
      question: "Can this user connect right now?",
      answer: "unknown",
      detail: "We can't see your Composio account. It's yes once your connected account shows ACTIVE.",
    },
    {
      id: "action",
      question: "Can the agent do this specific action?",
      answer: "unknown",
      detail: "Needs a test call of the tool with the scopes the user granted.",
    },
  ];
}

/** Everything an agent needs, as one versioned JSON object. */
export function agentView(guide: Guide, sel: Selection) {
  const plan = computePlan(guide, sel);
  const clock = (c: Plan["dev"]) => ({ ...c, label: clockLabel(c) });
  return {
    version: 1,
    slug: guide.slug,
    name: guide.name,
    origin: guide.origin,
    updatedAt: guide.updatedAt,
    selection: { toggles: sel.toggles, have: [...sel.have] },
    options: guide.toggles,
    answers: answers(guide, plan),
    verdict: {
      tier: plan.tier,
      clocks: { dev: clock(plan.dev), ideal: clock(plan.ideal), yours: clock(plan.yours) },
      topBlocker: plan.topBlocker && { id: plan.topBlocker.id, title: plan.topBlocker.title, waitDays: plan.topBlocker.waitDays },
    },
    composio: { managed: guide.composio.managed, note: composioNote(guide, sel), guideUrl: guide.composio.guideUrl ?? null },
    nextAction: nextAction(guide, plan),
    order: plan.order,
    gates: plan.gates,
    missing: plan.missing,
    claims: guide.claims,
  };
}
