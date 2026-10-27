import { Suspense } from "react";
import { GuideView } from "@/components/GuideView";
import { LiveLog } from "@/components/LiveLog";
import { getGuide } from "@/lib/guides";
import { getJob } from "@/lib/jobs";

async function Guide({ params, searchParams }: PageProps<"/g/[slug]">) {
  const { slug } = await params;
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(await searchParams)) for (const x of [v].flat()) if (x !== undefined) sp.append(k, x);
  const query = sp.toString();
  const guide = getGuide(slug);
  if (guide) return <GuideView guide={guide} query={query} />;
  const job = getJob(slug);
  if (job?.status === "done" && job.guide) return <GuideView guide={job.guide} query={query} />;
  return <LiveLog slug={slug} initial={job?.status ?? "none"} query={query} />;
}

export default function Page(props: PageProps<"/g/[slug]">) {
  return (
    <Suspense fallback={<main className="mx-auto max-w-4xl px-4 py-8 text-sm text-zinc-600">Loading guide…</main>}>
      <Guide {...props} />
    </Suspense>
  );
}
