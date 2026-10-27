import type { Guide } from "../lib/schema";

export type AgentId =
  | "resolver"
  | "scout"
  | "researcherSetup"
  | "researcherApproval"
  | "prober"
  | "synthesizer"
  | "verifier"
  | "readiness";

export type AgentEvent = { agent: AgentId; model: string; message: string; at: number };

/** Each impl logs progress lines via `log`; the pipeline stamps agent, model and time. */
export type Log = (message: string) => void;
export type Findings = { setup: string[]; approval: string[] };

export type AgentImpls = {
  resolver(slug: string, log: Log): Promise<{ managed: boolean | "unknown" }>;
  scout(slug: string, log: Log): Promise<{ officialHosts: string[] }>;
  researcherSetup(slug: string, hosts: string[], log: Log): Promise<string[]>;
  researcherApproval(slug: string, hosts: string[], log: Log): Promise<string[]>;
  prober(slug: string, hosts: string[], log: Log): Promise<void>;
  synthesizer(
    input: { query: string; slug: string; managed: boolean | "unknown"; findings: Findings },
    log: Log,
  ): Promise<Guide>;
  verifier(guide: Guide, log: Log): Promise<void>;
};
