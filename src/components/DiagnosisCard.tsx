import type { Guide } from "@/lib/schema";
import type { Plan } from "@/lib/engine";
import { clockLabel, waitLabel, weakestStatus } from "@/lib/display";
import type { routeStatus } from "@/lib/next";
import { NumberSource } from "./EvidenceBadge";

type Routes = ReturnType<typeof routeStatus>;

export function DiagnosisCard({ guide, plan, routes, lane }: { guide: Guide; plan: Plan; routes: Routes; lane: "managed" | "own" }) {
  const route = routes[lane];
  const uncertain = lane === "managed" && routes.managed.state === "scope_unconfirmed";
  const shortReason = uncertain ? `Composio has a ${guide.name} app, but support for the scopes this use needs has not been confirmed.` : route.reason;

  if (lane === "managed") return (
    <section aria-label="Why this route has this status" className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
      <p className="text-sm leading-6 text-amber-950"><span className="font-semibold">Why:</span> {shortReason}</p>
      {uncertain && <details className="mt-1 text-xs text-amber-950"><summary className="cursor-pointer underline underline-offset-2">Read the scope nuance</summary><p className="mt-2 max-w-2xl leading-5">{route.reason}</p></details>}
    </section>
  );

  return (
    <section aria-labelledby="diagnosis-title" className="mt-4 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
      <div className="p-5 sm:p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">Your answer · your own app</p>
        <h2 id="diagnosis-title" className="mt-2 text-2xl font-semibold tracking-tight text-zinc-950">{route.label}</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-700">{shortReason}</p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg bg-emerald-50 p-3">
              <p className="text-xs font-medium text-emerald-900">Build and test</p>
              <p className="mt-1 text-lg font-semibold tabular-nums text-emerald-950">{clockLabel(plan.dev)}</p>
            </div>
            <div className="rounded-lg bg-amber-50 p-3">
              <p className="text-xs font-medium text-amber-950">Launch with your app</p>
              <p className="mt-1 text-lg font-semibold tabular-nums text-amber-950">{clockLabel(plan.yours)}</p>
            </div>
        </div>
        {plan.topBlocker && (
          <p className="mt-4 text-sm text-zinc-800">
            <span className="font-semibold">Longest provider wait:</span> {plan.topBlocker.title} · {waitLabel(plan.topBlocker.waitDays)}{" "}
            {plan.topBlocker.waitDays !== "unknown" && plan.topBlocker.waitDays[1] > 0 && <NumberSource status={weakestStatus(guide, plan.topBlocker.claimIds)} />}
          </p>
        )}
      </div>
    </section>
  );
}
