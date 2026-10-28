import type { Plan } from "@/lib/engine";
import type { Gate, Guide } from "@/lib/schema";
import { hoursLabel, waitLabel, weakestStatus } from "@/lib/display";
import { EstimateBadge, NumberSource } from "./EvidenceBadge";

const OWNER: Record<Gate["owner"], string> = { agent: "Agent", you: "You", org: "Your team", provider: "Provider" };
const AGENT_CAN: Record<Gate["agentCan"], string> = { do: "Agent can prepare it", draft: "Agent can draft it", none: "You take over" };

export function Day1Chip() {
  return <span className="rounded bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-900">Start early</span>;
}

export function PathList({ guide, plan, done, currentId, onDone, renderKits }: { guide: Guide; plan: Plan; done: Set<string>; currentId?: string; onDone: (id: string, on: boolean) => void; renderKits?: (id: string) => React.ReactNode }) {
  const rank = new Map(plan.order.map((o, i) => [o.kind + o.id, i]));
  const gates = [...plan.gates].sort((a, b) => (rank.get("gate" + a.id) ?? -1) - (rank.get("gate" + b.id) ?? -1));
  const titleOf = (id: string) => guide.gates.find((g) => g.id === id)?.title ?? id;

  return (
    <ol className="space-y-3">
      {gates.map((g, i) => {
        const complete = done.has(g.id);
        const current = g.id === currentId;
        return (
          <li key={`${g.id}-${current}`} className={`relative rounded-xl border bg-white ${current ? "border-zinc-900 shadow-sm" : "border-zinc-200"}`}>
            <details open={current || undefined}>
              <summary className="flex cursor-pointer list-none flex-wrap items-center gap-2 p-4 marker:hidden [&::-webkit-details-marker]:hidden">
                <span aria-hidden="true" className={`flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${complete ? "bg-emerald-700 text-white" : current ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-700"}`}>
                  {complete ? "✓" : i + 1}
                </span>
                <span className="min-w-0 flex-1 text-sm font-semibold text-zinc-950">{g.title}</span>
                {current && <span className="rounded-full bg-zinc-900 px-2 py-0.5 text-xs font-medium text-white">Now</span>}
                {complete && <span className="text-xs font-medium text-emerald-800">Reported done</span>}
                {g.startDay1 && !complete && <Day1Chip />}
                <span aria-hidden="true" className="text-zinc-400">⌄</span>
              </summary>
              <div className="border-t border-zinc-100 px-4 pb-4 pt-3 sm:pl-14">
                <p className="text-sm leading-6 text-zinc-700">{g.nextStep ?? g.title}</p>
                <dl className="mt-3 grid gap-2 text-xs text-zinc-700 sm:grid-cols-3">
                  <div><dt className="text-zinc-500">Owner</dt><dd className="mt-0.5 font-medium text-zinc-900">{OWNER[g.owner]}</dd></div>
                  <div><dt className="text-zinc-500">Your effort</dt><dd className="mt-0.5 font-medium text-zinc-900">{hoursLabel(g.effortHours)} <EstimateBadge /></dd></div>
                  <div><dt className="text-zinc-500">Provider wait</dt><dd className="mt-0.5 font-medium text-zinc-900">{waitLabel(g.waitDays)} {g.waitDays !== "unknown" && g.waitDays[1] > 0 && <NumberSource status={weakestStatus(guide, g.claimIds)} />}</dd></div>
                </dl>
                <p className="mt-3 text-xs text-zinc-600">{AGENT_CAN[g.agentCan]}</p>
                {g.whatToAsk && <p className="mt-3 rounded-md bg-amber-50 p-3 text-sm text-amber-950">Wait unknown · {g.whatToAsk}</p>}
                {g.dependsOn.length > 0 && <p className="mt-2 text-xs text-zinc-600">After: {g.dependsOn.map(titleOf).join(", ")}</p>}
                {g.blockers.length > 0 && <ul className="mt-3 space-y-2">{g.blockers.map((b, j) => <li key={j} className="text-xs text-zinc-700"><strong>If:</strong> {b.symptom} <strong>Fix:</strong> {b.fix}</li>)}</ul>}
                {renderKits?.(g.id) && <details className="mt-3"><summary className="cursor-pointer text-xs font-medium text-zinc-800 underline underline-offset-2">Prepared material for this step</summary>{renderKits(g.id)}</details>}
                <div className="mt-4 flex flex-wrap items-center gap-4">
                  <button type="button" onClick={() => onDone(g.id, !complete)} className="min-h-10 rounded-md border border-zinc-300 px-3 py-2 text-xs font-medium text-zinc-900 hover:bg-zinc-50">{complete ? "Undo reported completion" : "Mark done"}</button>
                  {g.claimIds.length > 0 && <span className="text-xs text-zinc-500">Sources: {g.claimIds.map((id, j) => <span key={id}>{j > 0 && ", "}<a href={`#claim-${id}`} className="underline underline-offset-2">{id}</a></span>)}</span>}
                </div>
              </div>
            </details>
          </li>
        );
      })}
    </ol>
  );
}
