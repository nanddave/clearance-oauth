"use client";

import { useState } from "react";
import type { CheckResult } from "@/lib/readiness/checks";
import type { Guide, Requirement } from "@/lib/schema";
import { hoursLabel, waitLabel, weakestStatus } from "@/lib/display";
import { EstimateBadge, NumberSource } from "./EvidenceBadge";

const RESULT_STYLE = { pass: "text-emerald-700", fail: "text-red-700", unsure: "text-amber-800" } as const;

type Props = {
  guide: Guide;
  reqs: Requirement[]; // every requirement that applies to the current toggles
  have: Set<string>;
  onToggle: (id: string, on: boolean) => void;
  onPass: (ids: string[]) => void;
};

export function ReadinessChecklist({ guide, reqs, have, onToggle, onPass }: Props) {
  const [homepage, setHomepage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [results, setResults] = useState<Record<string, CheckResult>>({});
  const hasAuto = guide.origin !== "generated" && reqs.some((r) => r.check.kind === "auto"); // /api/check only knows reviewed guides

  async function check(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/check", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ slug: guide.slug, homepage }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? `Check failed (${res.status})`);
      const shown = new Set(reqs.map((r) => r.id));
      const list = (body as CheckResult[]).filter((r) => shown.has(r.reqId));
      setResults(Object.fromEntries(list.map((r) => [r.reqId, r])));
      onPass(list.filter((r) => r.status === "pass").map((r) => r.reqId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Check failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      {hasAuto && (
        <form onSubmit={check} className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end">
          <label className="flex-1 text-sm text-zinc-700">
            Your homepage
            <input
              type="url"
              required
              placeholder="https://yourapp.com"
              value={homepage}
              onChange={(e) => setHomepage(e.target.value)}
              className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:outline-2 focus:outline-blue-600"
            />
          </label>
          <button type="submit" disabled={busy} className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-60">
            {busy ? "Checking…" : "Check my site"}
          </button>
        </form>
      )}
      {error && (
        <p role="alert" className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      )}
      <ul className="divide-y divide-zinc-200 rounded-lg border border-zinc-200">
        {reqs.map((r) => {
          const on = have.has(r.id);
          const res = results[r.id];
          return (
            <li key={r.id} className="p-3">
              <div className="flex items-start gap-3">
                <input id={`have-${r.id}`} type="checkbox" checked={on} onChange={(e) => {
                    // a manual tick or untick replaces the agent's result, so provenance stays honest
                    setResults((prev) => {
                      const next = { ...prev };
                      delete next[r.id];
                      return next;
                    });
                    onToggle(r.id, e.target.checked);
                  }} className="mt-1 size-4 accent-zinc-900" />
                <div className="min-w-0 flex-1">
                  <label htmlFor={`have-${r.id}`} className="text-sm font-medium text-zinc-900">
                    {r.label}
                  </label>
                  <p className="text-xs text-zinc-500">
                    {r.check.kind === "auto" ? "Auto-checkable from your homepage" : "Tick if you have it"}
                    {on && <> · {res?.status === "pass" ? "checked by agent" : "you said"}</>}
                  </p>
                  {res && (
                    <p className={`mt-1 text-xs ${RESULT_STYLE[res.status]}`}>
                      <span className="font-semibold uppercase">{res.status}</span> — {res.reason}
                    </p>
                  )}
                  {!on && (
                    <details className="mt-1 text-sm">
                      <summary className="cursor-pointer text-xs text-zinc-700">
                        <span className="underline underline-offset-2">How to get it · {waitLabel(r.acquireDays)}</span>{" "}
                        {r.acquireDays !== "unknown" && r.acquireDays[1] > 0 && <NumberSource status={weakestStatus(guide, r.claimIds)} />}
                      </summary>
                      <ol className="mt-2 list-decimal space-y-1 pl-5 text-zinc-700">
                        {r.howToGet.map((s, i) => (
                          <li key={i}>{s}</li>
                        ))}
                      </ol>
                      {r.whatToAsk && <p className="mt-2 rounded bg-amber-50 px-2 py-1 text-xs text-amber-950">Time unknown — {r.whatToAsk}</p>}
                      <p className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-zinc-600">
                        Your effort: {hoursLabel(r.acquireEffortHours)} <EstimateBadge />
                      </p>
                    </details>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
