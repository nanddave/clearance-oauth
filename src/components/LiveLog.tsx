"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ROSTER } from "@/agents/roster";
import type { AgentEvent } from "@/agents/types";
import type { Guide } from "@/lib/schema";
import { GuideView } from "./GuideView";

type Status = "none" | "running" | "done" | "failed";

/** Unknown slug: offer generation, then stream the agents' log and render the guide when done. */
export function LiveLog({ slug, initial, query }: { slug: string; initial: Status; query: string }) {
  const router = useRouter();
  const [status, setStatus] = useState<Status>(initial);
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [guide, setGuide] = useState<Guide | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (status !== "running") return;
    const id = setInterval(async () => {
      const res = await fetch(`/api/jobs/${encodeURIComponent(slug)}`).catch(() => null);
      if (!res?.ok) return;
      const job = await res.json();
      setEvents(job.events);
      if (job.status === "done" && job.guide) setGuide(job.guide);
      if (job.status !== "running") setStatus(job.status);
    }, 1000);
    return () => clearInterval(id);
  }, [slug, status]);

  async function generate() {
    setError("");
    const res = await fetch("/api/generate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ query: slug }) });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return setError(body.error ?? "Could not start research");
    if (body.slug !== slug || body.reviewed) return router.replace(`/g/${body.slug}`);
    setStatus(body.status === "done" ? "running" : body.status); // done: one poll fetches the guide
  }

  if (guide) return <GuideView guide={guide} query={query} />;

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-12 sm:px-6">
      {status === "none" ? (
        <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h1 className="text-xl font-semibold text-zinc-950">No guide for &lsquo;{slug}&rsquo; yet</h1>
          <p className="mt-2 text-sm text-zinc-700">Our agents can research its OAuth approval process now. The result is marked as agent-generated and not human-reviewed.</p>
          <button type="button" onClick={generate} className="mt-4 rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700">
            Research {slug} now
          </button>
          {error && (
            <p role="alert" className="mt-3 text-sm text-red-800">
              {error}
            </p>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h1 className="text-xl font-semibold text-zinc-950">{status === "failed" ? `Research for ‘${slug}’ failed` : `Researching ${slug}…`}</h1>
          {status === "failed" && <p className="mt-2 text-sm text-red-800">Generation failed. The log below shows how far it got.</p>}
          <ol aria-live="polite" className="mt-4 space-y-1 font-mono text-xs text-zinc-700">
            {events.map((e, i) => (
              <li key={i}>
                <span className="font-semibold text-zinc-900">{ROSTER[e.agent]?.label ?? e.agent}</span> · {e.model} · {e.message}
              </li>
            ))}
            {status === "running" && <li className="text-zinc-500">waiting…</li>}
          </ol>
        </div>
      )}
    </main>
  );
}
