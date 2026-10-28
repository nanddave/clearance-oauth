import { computePlan } from "./engine";
import { nextAction, routeStatus } from "./next";
import type { Guide } from "./schema";
import { parseSelection } from "./selection";

export type Score = {
  slug: string;
  reference: boolean;
  managed: string; // the managed route's state at the default use
  falseGreen: boolean | null; // says "Test today" on Composio's app where the reviewed guide says Composio has no app; null without a reference
  tier: string;
  tierMatch: boolean | null;
  unsupportedWaits: string[]; // gates with a known, non-zero wait and no checked source behind it
  nextActionUsable: boolean;
  claims: { official: number; reported: number; other: number };
};

/** Scores one generated guide, against the human-reviewed guide for the same app when there is one. */
export function score(generated: Guide, reference?: Guide | null): Score {
  const at = (g: Guide) => {
    const sel = parseSelection(g, new URLSearchParams());
    const plan = computePlan(g, sel);
    return { plan, route: routeStatus(g, sel, plan) };
  };
  const gen = at(generated);
  const ref = reference ? at(reference) : null;
  const backed = new Set(
    generated.claims.filter((c) => (c.status === "official" || c.status === "reported") && c.sources.some((s) => s.verbatim)).map((c) => c.id),
  );
  const next = nextAction(generated, gen.plan);
  return {
    slug: generated.slug,
    reference: !!reference,
    managed: gen.route.managed.state,
    falseGreen: reference ? gen.route.managed.state === "can_test" && reference.composio.managed !== true : null,
    tier: gen.plan.tier,
    tierMatch: ref ? gen.plan.tier === ref.plan.tier : null,
    unsupportedWaits: gen.plan.gates.filter((g) => g.waitDays !== "unknown" && g.waitDays[1] > 0 && !g.claimIds.some((id) => backed.has(id))).map((g) => g.id),
    nextActionUsable: !!next && next.step.length >= 30,
    claims: {
      official: generated.claims.filter((c) => c.status === "official").length,
      reported: generated.claims.filter((c) => c.status === "reported").length,
      other: generated.claims.filter((c) => c.status !== "official" && c.status !== "reported").length,
    },
  };
}
