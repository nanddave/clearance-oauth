import type { Plan } from "@/lib/engine";
import type { Gate, Guide } from "@/lib/schema";
import { hoursLabel, waitLabel, weakestStatus } from "@/lib/display";
import { EstimateBadge, NumberSource } from "./EvidenceBadge";

const OWNER: Record<Gate["owner"], string> = { agent: "agent", you: "you", org: "your org", provider: "provider" };
const AGENT_CAN: Record<Gate["agentCan"], string> = { do: "do it", draft: "draft it", none: "—" };

export function Day1Chip() {
  return <span className="rounded bg-violet-100 px-1.5 py-0.5 text-[11px] font-semibold text-violet-900">start day 1</span>;
}

/** Fastest order: engine order, with long-lead requirements and authored startDay1 gates flagged. */
export function FastestOrder({ guide, plan }: { guide: Guide; plan: Plan }) {
  const title = (o: Plan["order"][number]) => {
    if (o.kind === "gate") return guide.gates.find((g) => g.id === o.id)?.title;
    const label = guide.requirements.find((r) => r.id === o.id)?.label;
    return label && `Get: ${label}`;
  };
  return (
    <ol className="list-decimal space-y-1.5 pl-6 text-sm text-zinc-800">
      {plan.order.filter((o) => title(o)).map((o) => {
        const day1 = o.startDay1 || (o.kind === "gate" && guide.gates.find((g) => g.id === o.id)?.startDay1);
        return (
          <li key={o.kind + o.id}>
            <span className={o.kind === "requirement" ? "text-zinc-700" : ""}>{title(o)}</span> {day1 && <Day1Chip />}
          </li>
        );
      })}
    </ol>
  );
}

export function PathList({ guide, plan }: { guide: Guide; plan: Plan }) {
  const rank = new Map(plan.order.map((o, i) => [o.kind + o.id, i]));
  const gates = [...plan.gates].sort((a, b) => (rank.get("gate" + a.id) ?? 0) - (rank.get("gate" + b.id) ?? 0));
  const titleOf = (id: string) => guide.gates.find((g) => g.id === id)?.title ?? id;
  return (
    <ol className="space-y-3">
      {gates.map((g, i) => (
        <li key={g.id} className="rounded-lg border border-zinc-200 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs tabular-nums text-zinc-500">{i + 1}.</span>
            <h3 className="text-sm font-semibold text-zinc-950">{g.title}</h3>
            <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[11px] text-zinc-700">{g.phase === "dev" ? "dev" : "production"}</span>
            {g.startDay1 && <Day1Chip />}
          </div>
          <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs sm:grid-cols-4">
            <div>
              <dt className="text-zinc-500">Owner</dt>
              <dd className="text-zinc-900">{OWNER[g.owner]}</dd>
            </div>
            <div>
              <dt className="text-zinc-500">Your effort</dt>
              <dd className="flex flex-wrap items-center gap-1 text-zinc-900">
                {hoursLabel(g.effortHours)} <EstimateBadge />
              </dd>
            </div>
            <div>
              <dt className="text-zinc-500">Provider wait</dt>
              <dd className="flex flex-wrap items-center gap-1 text-zinc-900">
                {waitLabel(g.waitDays)} {g.waitDays !== "unknown" && g.waitDays[1] > 0 && <NumberSource status={weakestStatus(guide, g.claimIds)} />}
              </dd>
            </div>
            <div>
              <dt className="text-zinc-500">Agent can</dt>
              <dd className="text-zinc-900">{AGENT_CAN[g.agentCan]}</dd>
            </div>
          </dl>
          {g.dependsOn.length > 0 && <p className="mt-2 text-xs text-zinc-600">After: {g.dependsOn.map(titleOf).join(", ")}</p>}
          {g.blockers.length > 0 && (
            <ul className="mt-2 space-y-1 text-xs">
              {g.blockers.map((b, j) => (
                <li key={j} className="text-zinc-700">
                  <span className="font-medium text-zinc-900">If:</span> {b.symptom} <span className="font-medium text-zinc-900">Fix:</span> {b.fix}
                </li>
              ))}
            </ul>
          )}
          {g.claimIds.length > 0 && (
            <p className="mt-2 text-xs text-zinc-500">
              Evidence:{" "}
              {g.claimIds.map((c, j) => (
                <span key={c}>
                  {j > 0 && ", "}
                  <a href={`#claim-${c}`} className="underline underline-offset-2">
                    {c}
                  </a>
                </span>
              ))}
            </p>
          )}
        </li>
      ))}
    </ol>
  );
}
