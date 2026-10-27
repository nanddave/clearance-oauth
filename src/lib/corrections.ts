import { z } from "zod";
import data from "../../data/corrections.json";

const entry = z.object({
  app: z.string().min(1),
  oldClaim: z.string().min(1),
  currentFact: z.string().min(1),
  sources: z.array(z.string().startsWith("https://")),
  changedOn: z.string().optional(),
  status: z.enum(["official", "conflicting", "reported", "unknown"]),
}).refine((e) => e.sources.length > 0 || e.status === "unknown", "entry needs a source unless status is unknown");

export const correctionsSchema = z.object({ entries: z.array(entry), unverified: z.array(z.string()) });
export type Correction = z.infer<typeof entry>;
export const corrections = correctionsSchema.parse(data);
