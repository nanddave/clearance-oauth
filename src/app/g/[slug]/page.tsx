import { redirect } from "next/navigation";
import { Suspense } from "react";
import { toSlug } from "@/agents/slug";
import { GuideView } from "@/components/GuideView";
import { LiveLog } from "@/components/LiveLog";
import { getGuide } from "@/lib/guides";
import { getJob } from "@/lib/jobs";

async function Guide({ params, searchParams }: PageProps<"/g/[slug]">) {
  const { slug } = await params;
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(await searchParams)) for (const x of [v].flat()) if (x !== undefined) sp.append(k, x);
  const query = sp.toString();
  if (toSlug(slug) !== slug) redirect(`/g/${toSlug(slug)}${query ? `?${query}` : ""}`);
  const guide = getGuide(slug);
  if (guide) return <GuideView key={slug} guide={guide} query={query} />;
  const job = await getJob(slug);
  if (job?.status === "done" && job.guide) return <GuideView key={slug} guide={job.guide} query={query} />;
  return <LiveLog key={slug} slug={slug} initial={job?.status ?? "none"} query={query} />;
}

export default function Page(props: PageProps<"/g/[slug]">) {
  return (
    <Suspense fallback={<main className="mx-auto max-w-4xl px-4 py-8 text-sm text-zinc-600">Loading guide…</main>}>
      <Guide {...props} />
    </Suspense>
  );
}
