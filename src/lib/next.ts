import { applies, computePlan, type Plan, type Selection } from "./engine";
import type { Gate, Guide, Requirement } from "./schema";
import { TIER_LABEL, clockLabel, isStub, waitLabel } from "./display";

export type Who = "do" | "draft" | "you";
export type NextAction = {
  kind: "gate" | "requirement" | "managed";
  id: string;
  title: string;
  who: Who; // do = pre-filled, you confirm; draft = prepared for you to paste or run; you = only you can
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

/** Managed lane: no provider app to register, so the one step is connecting a test user through Composio. */
export function managedAction(guide: Guide): NextAction {
  return {
    kind: "managed",
    id: "managed_connect",
    title: `Connect a test user with Composio's ${guide.name} app`,
    who: "draft",
    owner: "you",
    step: `In Composio, create a ${guide.name} auth config with Composio managed auth, connect one test account, and run one read-only tool to prove it works. Users will see Composio's name on the consent screen.`,
    wait: null,
    whatToAsk: null,
    startDay1: false,
    then: ["Need your name on the consent screen, your own scopes or rate limits? Switch to “Your own app”."],
  };
}

/** A generated guide must show, with a verified source, that the provider offers OAuth before we say "yes". */
export const oauthProven = (guide: Guide) =>
  guide.origin === "reviewed" || guide.claims.some((c) => /oauth/i.test(c.text) && (c.status === "official" || c.status === "reported"));

/** Composio's answer for this selection: the first matching note, else null (callers fall back to managed). */
export function composioNote(guide: Guide, sel: Selection): string | null {
  return guide.composio.notes?.find((n) => applies(guide, sel, n.when))?.text ?? null;
}

export type Answer = { id: "managed" | "build" | "launch" | "connect" | "action"; question: string; answer: string; detail: string };

/** What this guide can and cannot answer. The last two need the developer's own account data, so they stay unknown. */
export function answers(guide: Guide, plan: Plan, sel?: Selection): Answer[] {
  const build = plan.tier === "blocked" ? "no" : isStub(guide) || !oauthProven(guide) ? "unknown" : "yes";
  const b = plan.topBlocker;
  const m = guide.composio.managed;
  return [
    {
      id: "managed",
      question: "Can I use Composio's app for this?",
      answer: m === true ? "yes" : m === false ? "no" : "unknown",
      detail:
        (sel && composioNote(guide, sel)) ??
        (m === true ? "Composio manages this app's OAuth; users see Composio's name." : m === false ? "You need your own OAuth app." : "Composio coverage not confirmed."),
    },
    {
      id: "build",
      question: "Can this integration be built?",
      answer: build,
      detail:
        build === "unknown"
          ? "No verified source shows this provider offers OAuth apps yet."
          : guide.composio.managed === true
            ? "Composio has a managed OAuth app for this toolkit."
            : build === "yes"
              ? "The provider supports OAuth apps; see the steps."
              : "Not available for this use case.",
    },
    {
      id: "launch",
      question: "Can your own app launch to real users, and when?",
      answer: `${TIER_LABEL[plan.tier]} · ${clockLabel(plan.yours)}`,
      detail:
        (b ? `#1 blocker: ${b.title} (wait ${waitLabel(b.waitDays)}).` : "No provider wait in your path.") +
        (plan.unknownWaits.length ? ` Also unknown: ${plan.unknownWaits.map((g) => g.title).join(", ")}.` : ""),
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
/**
 * The typed answer an agent should act on. Progress (have/done) is what the user told us, never checked by us;
 * connection and action state need the developer's own Composio account, so they stay "unknown".
 */
export function decision(guide: Guide, sel: Selection, plan: Plan) {
  const next = sel.lane === "managed" ? managedAction(guide) : nextAction(guide, plan);
  const status =
    plan.tier === "blocked" ? "blocked" : !oauthProven(guide) ? "unknown" : plan.order.length === 0 ? "launch_ready" : "in_progress";
  return {
    lane: sel.lane ?? "own",
    managedAvailable: guide.composio.managed,
    ownApp: {
      status,
      tier: plan.tier,
      nextStepId: next?.id ?? null,
      blockers: [plan.topBlocker, ...plan.unknownWaits].filter((g): g is Gate => !!g).map((g) => ({
        id: g.id,
        code: g.kind,
        waitDays: g.waitDays,
        evidence: g.claimIds,
      })),
    },
    connection: "unknown" as const,
    action: "unknown" as const,
    provenance: { have: "user_reported" as const, done: "user_reported" as const },
  };
}

export function agentView(guide: Guide, sel: Selection) {
  const plan = computePlan(guide, sel);
  const clock = (c: Plan["dev"]) => ({ ...c, label: clockLabel(c) });
  return {
    version: 2,
    decision: decision(guide, sel, plan),
    slug: guide.slug,
    name: guide.name,
    origin: guide.origin,
    updatedAt: guide.updatedAt,
    selection: { toggles: sel.toggles, have: [...sel.have], done: [...(sel.done ?? [])], lane: sel.lane ?? "own" },
    options: guide.toggles,
    answers: answers(guide, plan, sel),
    verdict: {
      tier: plan.tier,
      clocks: { dev: clock(plan.dev), ideal: clock(plan.ideal), yours: clock(plan.yours) },
      topBlocker: plan.topBlocker && { id: plan.topBlocker.id, title: plan.topBlocker.title, waitDays: plan.topBlocker.waitDays },
    },
    composio: { managed: guide.composio.managed, note: composioNote(guide, sel), guideUrl: guide.composio.guideUrl ?? null },
    nextAction: sel.lane === "managed" ? managedAction(guide) : nextAction(guide, plan),
    order: plan.order,
    gates: plan.gates,
    missing: plan.missing,
    claims: guide.claims,
  };
}
