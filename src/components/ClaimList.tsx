import type { Claim } from "@/lib/schema";
import { safeHref } from "@/lib/display";
import { EvidenceBadge } from "./EvidenceBadge";

export function ClaimList({ claims }: { claims: Claim[] }) {
  return (
    <ul className="divide-y divide-zinc-200">
      {claims.map((c) => (
        <li key={c.id} id={`claim-${c.id}`} className="py-3">
          <div className="flex items-start gap-2">
            <EvidenceBadge status={c.status} />
            <p className="text-sm text-zinc-900">{c.text}</p>
          </div>
          {c.note && <p className="mt-1 pl-1 text-xs text-zinc-600">Note: {c.note}</p>}
          {c.sources.length === 0 && <p className="mt-1 text-xs text-zinc-500">No source captured.</p>}
          {c.sources.map((s, i) => {
            const href = safeHref(s.url);
            return (
              <div key={i} className="mt-2 border-l-2 border-zinc-200 pl-3 text-xs text-zinc-600">
                <p className="text-zinc-700">{s.verbatim ? <q>{s.quote}</q> : <>Summary: {s.quote}</>}</p>
                <p className="mt-0.5">
                  {href ? (
                    <a href={href} target="_blank" rel="noopener noreferrer" className="break-all underline underline-offset-2 hover:text-zinc-900">
                      {s.url}
                    </a>
                  ) : (
                    <span className="break-all">{s.url || "no URL"}</span>
                  )}{" "}
                  · checked {s.checkedAt}
                </p>
              </div>
            );
          })}
        </li>
      ))}
    </ul>
  );
}
