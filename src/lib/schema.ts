import { z } from "zod";

const Num = z.number().min(0);
export const RangeSchema = z
  .tuple([Num, Num])
  .refine(([min, max]) => min <= max, { message: "range min must be <= max" });
const Wait = z.union([RangeSchema, z.literal("unknown")]);

export const EvidenceStatusSchema = z.enum(["tested", "official", "reported", "conflicting", "unknown"]);

export const AutoCheckRuleSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("homepage_loads") }),
  z.object({ type: z.literal("https") }),
  z.object({ type: z.literal("privacy_policy_found") }),
  z.object({
    type: z.literal("phrase_present"),
    page: z.enum(["privacy", "homepage"]),
    anyOf: z.array(z.string()),
  }),
  z.object({ type: z.literal("support_email_on_domain") }),
]);

export const SourceSchema = z.object({ url: z.string(), quote: z.string(), checkedAt: z.string(), verbatim: z.boolean().optional() });

export const ClaimSchema = z.object({
  id: z.string(),
  text: z.string(),
  status: EvidenceStatusSchema,
  sources: z.array(SourceSchema),
  note: z.string().optional(),
});

export const ToggleSchema = z.object({
  id: z.string(),
  label: z.string(),
  options: z.array(z.object({ id: z.string(), label: z.string() })),
  default: z.string(),
});

const AppliesWhen = z.record(z.string(), z.array(z.string())).optional();

export const GateSchema = z.object({
  id: z.string(),
  title: z.string(),
  appliesWhen: AppliesWhen,
  phase: z.enum(["dev", "production"]),
  kind: z.enum(["setup", "review", "partner", "legal", "commercial", "unavailable"]),
  owner: z.enum(["agent", "you", "org", "provider"]),
  effortHours: RangeSchema,
  waitDays: Wait,
  dependsOn: z.array(z.string()),
  startDay1: z.boolean().optional(),
  requires: z.array(z.string()),
  blockers: z.array(z.object({ symptom: z.string(), fix: z.string() })),
  agentCan: z.enum(["do", "draft", "none"]),
  claimIds: z.array(z.string()),
  nextStep: z.string().optional(), // the exact action, shown on the next-action card
  whatToAsk: z.string().optional(), // for unknown waits: the question and whom to ask
});

export const RequirementSchema = z.object({
  id: z.string(),
  label: z.string(),
  appliesWhen: AppliesWhen,
  howToGet: z.array(z.string()),
  acquireDays: Wait,
  acquireEffortHours: RangeSchema,
  dependsOn: z.array(z.string()),
  check: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("auto"), rule: AutoCheckRuleSchema }),
    z.object({ kind: z.literal("self") }),
  ]),
  claimIds: z.array(z.string()),
  whatToAsk: z.string().optional(),
  afterGates: z.array(z.string()).optional(), // gates that must finish first (e.g. installs need the app to exist)
});

export const GuideSchema = z.object({
  slug: z.string(),
  name: z.string(),
  website: z.string(),
  updatedAt: z.string(),
  origin: z.enum(["reviewed", "generated"]),
  composio: z.object({
    managed: z.union([z.boolean(), z.literal("unknown")]),
    guideUrl: z.string().optional(),
    // the managed answer depends on what the agent does; first matching note wins
    notes: z.array(z.object({ when: z.record(z.string(), z.array(z.string())), text: z.string() })).optional(),
  }),
  toggles: z.array(ToggleSchema),
  gates: z.array(GateSchema),
  requirements: z.array(RequirementSchema),
  claims: z.array(ClaimSchema),
  summary: z.string(),
});

export type Range = [number, number];
export type EvidenceStatus = z.infer<typeof EvidenceStatusSchema>;
export type AutoCheckRule = z.infer<typeof AutoCheckRuleSchema>;
export type Source = z.infer<typeof SourceSchema>;
export type Claim = z.infer<typeof ClaimSchema>;
export type Toggle = z.infer<typeof ToggleSchema>;
export type Gate = z.infer<typeof GateSchema>;
export type Requirement = z.infer<typeof RequirementSchema>;
export type Guide = z.infer<typeof GuideSchema>;

export function parseGuide(json: unknown): Guide {
  const r = GuideSchema.safeParse(json);
  if (r.success) return r.data;
  throw new Error(r.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "));
}
