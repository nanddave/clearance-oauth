import type { Guide } from "../lib/schema";
import { ROSTER } from "./roster";
import { makeStubs } from "./stubs";
import type { AgentEvent, AgentId, AgentImpls } from "./types";

/** "notion.so" / "https://www.notion.so/x?y" -> "notion"; "Google Calendar" -> "google-calendar". */
export function toSlug(query: string): string {
  let s = query.trim().toLowerCase().replace(/^[a-z][a-z0-9+.-]*:\/\//, "").replace(/^www\./, "");
  const host = s.split(/[/?#]/)[0];
  // shortcut: second-to-last label as the name, wrong for co.uk-style TLDs; upgrade with a public-suffix list.
  if (!/\s/.test(host) && host.includes(".")) s = host.split(".").slice(-2, -1)[0];
  return s.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60).replace(/-+$/, "");
}

export async function runGeneration(
  query: string,
  emit: (e: AgentEvent) => void,
  deps: AgentImpls = makeStubs(),
): Promise<Guide> {
  const slug = toSlug(query);
  const log = (agent: AgentId) => (message: string) =>
    emit({ agent, model: ROSTER[agent].model, message, at: Date.now() });

  const { managed } = await deps.resolver(slug, log("resolver"));
  const { officialHosts } = await deps.scout(slug, log("scout"));
  const [setup, approval] = await Promise.all([
    deps.researcherSetup(slug, officialHosts, log("researcherSetup")),
    deps.researcherApproval(slug, officialHosts, log("researcherApproval")),
  ]);
  await deps.prober(slug, officialHosts, log("prober"));
  const guide = await deps.synthesizer({ query, slug, managed, findings: { setup, approval } }, log("synthesizer"));
  await deps.verifier(guide, log("verifier"));
  return { ...guide, origin: "generated" };
}
