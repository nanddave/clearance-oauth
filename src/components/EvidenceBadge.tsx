import type { EvidenceStatus } from "@/lib/schema";

const STYLE: Record<EvidenceStatus, string> = {
  tested: "bg-emerald-50 text-emerald-800 ring-emerald-600/30",
  official: "bg-blue-50 text-blue-800 ring-blue-600/30",
  reported: "bg-amber-50 text-amber-900 ring-amber-600/30",
  conflicting: "bg-red-50 text-red-800 ring-red-600/30",
  unknown: "bg-zinc-100 text-zinc-700 ring-zinc-500/30",
};

const chip = "inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-medium ring-1 ring-inset whitespace-nowrap";

export function EvidenceBadge({ status }: { status: EvidenceStatus }) {
  return <span className={`${chip} ${STYLE[status]}`}>{status[0].toUpperCase() + status.slice(1)}</span>;
}

export function EstimateBadge() {
  return <span className={`${chip} bg-white text-zinc-600 ring-zinc-300 italic`}>our estimate</span>;
}

/** Badge for a number: the cited claims' weakest status, or "our estimate" when nothing is cited. */
export function NumberSource({ status }: { status: EvidenceStatus | null }) {
  return status ? <EvidenceBadge status={status} /> : <EstimateBadge />;
}
