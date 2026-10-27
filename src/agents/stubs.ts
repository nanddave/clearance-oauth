import { parseGuide } from "../lib/schema";
import type { AgentImpls } from "./types";

const defaultSleep = () => new Promise<void>((r) => setTimeout(r, 300 + Math.random() * 500));

/** Stub agents: no network, no model calls. Pass a fast `sleep` in tests. */
export function makeStubs(sleep: () => Promise<void> = defaultSleep): AgentImpls {
  return {
    async resolver(slug, log) {
      await sleep();
      log(`Looked up '${slug}' in Composio's toolkit catalog (stub)`);
      return { managed: "unknown" };
    },
    async scout(_slug, log) {
      await sleep();
      log("Picked official docs hosts from search hits, none found (stub)");
      return { officialHosts: [] };
    },
    async researcherSetup(_slug, _hosts, log) {
      log("Searching setup & scopes docs… (stub)");
      await sleep();
      log("Read setup & scopes pages, nothing captured (stub)");
      return [];
    },
    async researcherApproval(_slug, _hosts, log) {
      log("Searching approval & policy docs… (stub)");
      await sleep();
      log("Read approval & policy pages, nothing captured (stub)");
      return [];
    },
    async prober(_slug, hosts, log) {
      await sleep();
      log(`Probed ${hosts.length} official hosts with GET (stub)`);
    },
    async synthesizer({ query, slug, managed }, log) {
      await sleep();
      log("Built gate graph from findings (stub)");
      const now = new Date().toISOString();
      return parseGuide({
        slug,
        name: query.trim(),
        website: "",
        updatedAt: now,
        origin: "generated",
        composio: { managed },
        toggles: [],
        gates: [
          {
            id: "dev-register",
            title: "Register an OAuth app in the provider's developer portal",
            phase: "dev",
            kind: "setup",
            owner: "you",
            effortHours: [1, 2],
            waitDays: "unknown",
            dependsOn: [],
            requires: [],
            blockers: [],
            agentCan: "none",
            claimIds: ["stub-research"],
          },
          {
            id: "prod-review",
            title: "Provider review (if any)",
            phase: "production",
            kind: "review",
            owner: "provider",
            effortHours: [0, 0],
            waitDays: "unknown",
            dependsOn: ["dev-register"],
            requires: [],
            blockers: [],
            agentCan: "none",
            claimIds: ["stub-research"],
          },
        ],
        requirements: [],
        claims: [
          { id: "stub-research", text: "Stub: live research not yet connected", status: "unknown", sources: [] },
        ],
        summary: `Placeholder guide for ${query.trim()} produced by stub agents. No live research was done, so nothing here is a verified fact about the app.`,
      });
    },
    async verifier(guide, log) {
      await sleep();
      const n = guide.claims.reduce((s, c) => s + c.sources.length, 0);
      log(`Checked ${n} quotes against captured pages (stub)`);
    },
  };
}
