"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { computePlan, type Selection } from "@/lib/engine";
import type { Guide } from "@/lib/schema";
import { isStub, safeHref } from "@/lib/display";
import { parseSelection, toSearchParams } from "@/lib/selection";
import { answers, managedAction, nextAction, routeStatus } from "@/lib/next";
import { kitsFor } from "@/lib/kits";
import { ClaimList } from "./ClaimList";
import { DiagnosisCard } from "./DiagnosisCard";
import { ErrorDecoder, KitList } from "./Kits";
import { LaneChooser } from "./LaneChooser";
import { AnswersTable, NextActionCard } from "./NextActionCard";
import { PathList } from "./PathList";
import { ReadinessChecklist } from "./ReadinessChecklist";
import { Toggles } from "./Toggles";

function CopyLink() {
  const [copied, setCopied] = useState("");
  return <button type="button" onClick={() => navigator.clipboard.writeText(location.href).then(() => setCopied("Link copied"), () => setCopied("Copy failed")).then(() => setTimeout(() => setCopied(""), 1500))}
    className="min-h-10 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50"><span aria-live="polite">{copied || "Copy this plan"}</span></button>;
}

/** The use case and reported progress live in the URL, so the same plan can be shared. */
export function GuideView({ guide, query, refresh }: { guide: Guide; query: string; refresh?: "running" | "failed" }) {
  const router = useRouter();
  const pathname = usePathname();
  const [sel, setSel] = useState<Selection>(() => parseSelection(guide, new URLSearchParams(query)));
  const dirty = useRef(false);
  const update = (fn: (s: Selection) => Selection) => { dirty.current = true; setSel(fn); };
  // native replaceState updates the share link at once; router.replace waited 1-3 s for a server render the page doesn't need
  useEffect(() => { if (dirty.current) window.history.replaceState(null, "", pathname + toSearchParams(sel)); }, [sel, pathname]);

  const setHave = (ids: string[], on: boolean) => update((s) => {
    const have = new Set(s.have);
    ids.forEach((id) => on ? have.add(id) : have.delete(id));
    return { ...s, have };
  });
  const setDone = (id: string, on: boolean) => update((s) => {
    const done = new Set(s.done);
    if (on) done.add(id);
    else done.delete(id);
    return { ...s, done };
  });

  const plan = computePlan(guide, sel);
  const routes = routeStatus(guide, sel, plan);
  const relevant = computePlan(guide, { toggles: sel.toggles, have: new Set(), done: sel.done }).missing;
  const next = nextAction(guide, plan);
  const lane = sel.lane === "managed" ? "managed" : "own";
  const own = lane === "own";
  const website = safeHref(guide.website);
  const [reqOpen] = useState(() => next?.kind === "requirement"); // open once; a controlled open would snap shut as you tick
  useEffect(() => {
    if (refresh !== "running") return;
    const id = setInterval(() => router.refresh(), 5000); // picks up the new guide (or the failure) when the run ends
    return () => clearInterval(id);
  }, [refresh, router]);

  return (
    <main className="mx-auto w-full max-w-5xl px-4 pb-16 pt-8 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-zinc-600">
        <span>Updated {guide.updatedAt.slice(0, 10)}{website && <> · <a href={website} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">Provider docs</a></>}</span>
        <CopyLink />
      </div>
      <div className="mt-4 max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-800">Connection guide</p>
        <h1 className="mt-1 text-4xl font-semibold tracking-tight text-zinc-950">{guide.name}</h1>
      </div>

      {guide.origin === "generated" && <div role="note" className="mt-5 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
        <strong>Agent-generated · not human-reviewed · checked {guide.updatedAt.slice(0, 10)}</strong>
        {isStub(guide) && <p className="mt-1">Placeholder from stub agents. No live research has run; do not rely on its numbers.</p>}
        {refresh && <p className="mt-1">{refresh === "running" ? "Researching an update now; this is the last finished version." : "The latest update failed; this is the last finished version."} <a href={`/api/jobs/${guide.slug}`} className="underline underline-offset-2">Run log</a></p>}
      </div>}

      {guide.toggles.length > 0 && <section aria-labelledby="use-case" className="mt-5 rounded-xl border border-zinc-200 bg-white p-4">
        <h2 id="use-case" className="text-base font-semibold text-zinc-950">What does your agent need to do?</h2>
        <div className="mt-3"><Toggles toggles={guide.toggles} value={sel.toggles} onChange={(id, opt) => update((s) => ({ ...s, toggles: { ...s.toggles, [id]: opt } }))} /></div>
      </section>}

      <LaneChooser guide={guide} routes={routes} lane={lane} onChange={(nextLane) => update((s) => ({ ...s, lane: nextLane }))} />
      <DiagnosisCard guide={guide} plan={plan} routes={routes} lane={lane} />

      <section aria-label="What to do next" className="mt-4">
        <NextActionCard action={own ? next : managedAction(guide)} kits={own ? next ? kitsFor(guide, next.id) : [] : kitsFor(guide, "managed_connect")}
          onDone={own && next ? () => next.kind === "gate" ? setDone(next.id, true) : setHave([next.id], true) : null} own={own ? routes.own : undefined} />
      </section>

      {own && <>
        <section aria-labelledby="journey-title" className="mt-9">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="journey-title" className="text-lg font-semibold text-zinc-950">Journey to launch</h2>
            <p className="text-xs text-zinc-500">Open a checkpoint for its owner, wait and source</p>
          </div>
          <div className="mt-4"><PathList guide={guide} plan={plan} done={sel.done ?? new Set()} currentId={next?.kind === "gate" ? next.id : undefined} onDone={setDone}
            renderKits={(id) => kitsFor(guide, id).length ? <KitList kits={kitsFor(guide, id)} /> : null} /></div>
        </section>

        <details id="requirements" open={reqOpen || undefined} className="mt-6 rounded-xl border border-zinc-200 bg-white p-4 sm:p-5">
          <summary className="cursor-pointer text-base font-semibold text-zinc-950">Requirements · {plan.missing.length} still needed</summary>
          <p className="mt-2 text-sm text-zinc-600">Tick what you have. Ticks are your report; the site checker can verify some public pages.</p>
          <div className="mt-4">{relevant.length ? <ReadinessChecklist guide={guide} reqs={relevant} have={sel.have} onToggle={(id, on) => setHave([id], on)} onPass={(ids) => setHave(ids, true)} onFail={(ids) => setHave(ids, false)} /> : <p className="text-sm text-zinc-600">No prerequisites for this use case.</p>}</div>
        </details>
      </>}

      <div className="mt-9 grid gap-3 sm:grid-cols-2">
        <details className="rounded-xl border border-zinc-200 bg-white p-4">
          <summary className="cursor-pointer text-sm font-semibold text-zinc-900">Connection not working? Troubleshoot it</summary>
          <div className="mt-4"><ErrorDecoder slug={guide.slug} /></div>
        </details>
        <AnswersTable answers={answers(guide, plan, sel)} />
      </div>

      <details id="evidence-details" className="mt-6 rounded-xl border border-zinc-200 bg-white p-4 sm:p-5">
        <summary className="cursor-pointer text-sm font-semibold text-zinc-900">Sources and evidence · {guide.claims.length} claims</summary>
        <p className="mt-3 text-xs text-zinc-600">Tested = we ran it · Official = provider docs · Reported = third-party report · Conflicting = sources disagree · Unknown = not verified.</p>
        <ClaimList claims={guide.claims} />
      </details>
      <p className="mt-5 text-xs text-zinc-500">For agents: this decision is also available as <a href={`/api/guides/${guide.slug}${toSearchParams(sel)}`} className="font-mono underline underline-offset-2">structured JSON</a>.</p>
    </main>
  );
}
