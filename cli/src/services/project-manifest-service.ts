import { z } from "zod";

export const projectManifestSchema = z.object({
  version: z.string().default("1.0.0"),
  gameId: z.string().min(1),
  slug: z.string().regex(/^[a-z0-9-]+(\.[a-z0-9-]+)*$/),
  title: z.string().min(1).max(160),
  summary: z.string().min(1).max(8192),
  description: z.string().max(65536).optional(),
  links: z
    .object({
      homepage: z.string().url(),
      source: z.string().url().optional(),
      issues: z.string().url().optional(),
      support: z.string().url().optional()
    })
    .strict(),
  authors: z
    .array(
      z
        .object({
          pubkey: z.string().regex(/^npub1[02-9ac-hj-np-z]{59}$/),
          role: z.string().min(1),
          displayName: z.string().optional(),
          zapSplit: z.number().min(0).max(1).optional()
        })
        .strict()
    )
    .min(1),
  relayHints: z.array(z.string().url()).min(1),
  categories: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  zapConfig: z
    .object({
      lnurl: z.string().url().optional(),
      bolt12: z.string().optional()
    })
    .strict()
    .optional(),
  license: z.string().optional(),
  contentWarnings: z.array(z.string()).optional(),
  dependencies: z
    .array(
      z
        .object({
          slug: z.string().min(1),
          gameId: z.string().min(1).optional(),
          versionRange: z.string().optional()
        })
        .strict()
    )
    .optional()
});

export type ProjectManifest = z.infer<typeof projectManifestSchema>;
