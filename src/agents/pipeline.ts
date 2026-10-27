import type { Guide } from "../lib/schema";
import { ROSTER } from "./roster";
import { makeRealAgents } from "./real";
import { makeStubs } from "./stubs";
import type { AgentEvent, AgentId, AgentImpls } from "./types";

import { toSlug } from "./slug";

/** Real agents when an Anthropic key is set, stubs otherwise (local dev, tests). Built per run: they share captured pages. */
export const makeAgents = (): AgentImpls => (process.env.ANTHROPIC_API_KEY ? makeRealAgents() : makeStubs());

export async function runGeneration(
  query: string,
  emit: (e: AgentEvent) => void,
  deps: AgentImpls = makeAgents(),
): Promise<Guide> {
  const slug = toSlug(query);
  const log = (agent: AgentId) => (message: string, costUsd?: number) =>
    emit({ agent, model: ROSTER[agent].model, message, at: Date.now(), ...(costUsd !== undefined && { costUsd }) });

  const { managed } = await deps.resolver(slug, log("resolver"));
  const { officialHosts } = await deps.scout(slug, log("scout"));
  const [setup, approval] = await Promise.all([
    deps.researcherSetup(slug, officialHosts, log("researcherSetup")),
    deps.researcherApproval(slug, officialHosts, log("researcherApproval")),
  ]);
  await deps.prober(slug, officialHosts, log("prober"));
  const guide = await deps.synthesizer({ query, slug, managed, findings: { setup, approval } }, log("synthesizer"));
  const verified = await deps.verifier(guide, log("verifier"));
  return { ...verified, origin: "generated" };
}
