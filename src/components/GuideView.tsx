"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { computePlan, type Selection } from "@/lib/engine";
import type { Guide } from "@/lib/schema";
import { isStub, safeHref } from "@/lib/display";
import { parseSelection, toSearchParams } from "@/lib/selection";
import { answers, composioNote, nextAction } from "@/lib/next";
import { ClaimList } from "./ClaimList";
import { AnswersTable, NextActionCard } from "./NextActionCard";
import { FastestOrder, PathList } from "./PathList";
import { ReadinessChecklist } from "./ReadinessChecklist";
import { Toggles } from "./Toggles";
import { VerdictCard } from "./VerdictCard";

function Section({ id, title, children, hint }: { id: string; title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="mt-8">
      <h2 id={id} className="text-base font-semibold text-zinc-950">
        {title}
      </h2>
      {hint && <p className="mt-0.5 text-sm text-zinc-600">{hint}</p>}
      <div className="mt-3">{children}</div>
    </section>
  );
}

function CopyLink() {
  const [copied, setCopied] = useState("");
  return (
    <button
      type="button"
      onClick={() =>
        navigator.clipboard
          .writeText(location.href)
          .then(() => setCopied("Link copied"), () => setCopied("Copy failed"))
          .then(() => setTimeout(() => setCopied(""), 1500))
      }
      className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-800 hover:bg-zinc-50"
    >
      <span aria-live="polite">{copied || "Copy link to this plan"}</span>
    </button>
  );
}

/** Client island: the selection lives in state and is mirrored to the URL. */
export function GuideView({ guide, query }: { guide: Guide; query: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const [sel, setSel] = useState<Selection>(() => parseSelection(guide, new URLSearchParams(query)));
  const plan = computePlan(guide, sel);
  const relevant = computePlan(guide, { toggles: sel.toggles, have: new Set() }).missing;
  const stub = isStub(guide);
  const website = safeHref(guide.website);

  // Functional updates so async results (site check) never overwrite newer choices; the URL follows state.
  const dirty = useRef(false);
  const update = (fn: (s: Selection) => Selection) => {
    dirty.current = true;
    setSel(fn);
  };
  useEffect(() => {
    if (dirty.current) router.replace(pathname + toSearchParams(sel), { scroll: false });
  }, [sel, pathname, router]);
  const setHave = (ids: string[], on: boolean) =>
    update((s) => {
      const have = new Set(s.have);
      ids.forEach((id) => (on ? have.add(id) : have.delete(id)));
      return { ...s, have };
    });

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 text-sm text-zinc-600">
        <span>
          Updated {guide.updatedAt.slice(0, 10)}
          {website && (
            <>
              {" · "}
              <a href={website} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
                Provider docs
              </a>
            </>
          )}
        </span>
        <CopyLink />
      </div>

      {guide.origin === "generated" && (
        <div role="note" className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
          <p className="font-semibold">Agent-generated · not human-reviewed · checked {guide.updatedAt.slice(0, 10)}</p>
          {stub && <p className="mt-1">This is a placeholder from stub agents — no live research has run yet. Do not rely on its numbers.</p>}
        </div>
      )}

      <VerdictCard guide={guide} plan={plan} placeholder={stub} note={composioNote(guide, sel)} />
      <AnswersTable answers={answers(guide, plan)} />
      <NextActionCard action={nextAction(guide, plan)} />

      {guide.toggles.length > 0 && (
        <Section id="toggles" title="What does your agent need?" hint="Change these and the verdict updates.">
          <Toggles toggles={guide.toggles} value={sel.toggles} onChange={(id, opt) => update((s) => ({ ...s, toggles: { ...s.toggles, [id]: opt } }))} />
        </Section>
      )}

      <Section id="ready" title="Am I ready to submit?" hint="Tick what you already have; missing items are added to Your plan.">
        {relevant.length ? (
          <ReadinessChecklist guide={guide} reqs={relevant} have={sel.have} onToggle={(id, on) => setHave([id], on)} onPass={(ids) => setHave(ids, true)} />
        ) : (
          <p className="text-sm text-zinc-600">No prerequisites for this combination.</p>
        )}
      </Section>

      <Section id="order" title="Fastest order" hint="Items marked start day 1 have long lead times — begin them in parallel.">
        <FastestOrder guide={guide} plan={plan} />
        <p className="mt-3 text-xs text-zinc-500">
          For agents: the same plan as JSON at{" "}
          <a href={`/api/guides/${guide.slug}${toSearchParams(sel)}`} className="font-mono underline underline-offset-2">
            /api/guides/{guide.slug}
          </a>
        </p>
      </Section>

      <Section id="path" title="Path">
        <PathList guide={guide} plan={plan} />
      </Section>

      <Section id="evidence" title="Evidence" hint="Tested = we ran it · Official = provider docs · Reported = third-party reports · Conflicting = sources disagree · Unknown = not verified.">
        <ClaimList claims={guide.claims} />
      </Section>
    </main>
  );
}
