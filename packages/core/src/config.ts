import { z } from "zod";
import type { MatchConfig } from "./match";
import type { Policy } from "./types";

export interface RunConfig {
  readonly policy: Policy;
  readonly match: MatchConfig;
}

export class ConfigError extends Error {
  override readonly name = "ConfigError";
}

const threshold = z.number().min(0).max(1);

const conditionSchema = z.discriminatedUnion("op", [
  z.object({ field: z.string().min(1), op: z.literal("in"), values: z.array(z.string()).min(1) }),
  z.object({ field: z.string().min(1), op: z.literal("notEmpty") }),
]);

const tagSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("origin") }),
  z.object({ kind: z.literal("current") }),
  z.object({
    kind: z.literal("channel"),
    channel: z.string().min(1),
    pick: z.enum(["earliest", "latest"]),
  }),
  z.object({ kind: z.literal("strongest"), ranking: z.array(z.string()) }),
  z.object({ kind: z.literal("combine") }),
]);

const policySchema = z
  .object({
    channels: z.array(z.object({ name: z.string().min(1), when: z.array(conditionSchema).min(1) })),
    fields: z.record(z.string(), tagSchema),
  })
  .superRefine((policy, ctx) => {
    const known = new Set(policy.channels.map((c) => c.name));
    for (const [field, tag] of Object.entries(policy.fields)) {
      if (tag.kind === "channel" && !known.has(tag.channel)) {
        ctx.addIssue({
          code: "custom",
          path: ["fields", field],
          message: `unknown channel "${tag.channel}" (define it under policy.channels)`,
        });
      }
    }
  });

const matchSchema = z.object({
  entity: z.enum(["person", "company"]),
  fields: z.object({
    email: z.string().optional(),
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    fullName: z.string().optional(),
    phone: z.string().optional(),
    company: z.string().optional(),
    website: z.string().optional(),
  }),
  thresholds: z
    .object({ auto: threshold, review: threshold })
    .refine((t) => t.review <= t.auto, "review threshold must not be higher than auto"),
  defaultCountry: z.string().length(2).optional(),
});

const runConfigSchema = z.object({ policy: policySchema, match: matchSchema });

/** Validates untrusted JSON (a file, an API body) and explains every problem at once. */
export function parseRunConfig(input: unknown): RunConfig {
  const result = runConfigSchema.safeParse(input);
  if (result.success) return result.data as RunConfig;
  const lines = result.error.issues.map((issue) => `- ${issue.path.join(".")}: ${issue.message}`);
  throw new ConfigError(`Invalid config:\n${lines.join("\n")}`);
}
