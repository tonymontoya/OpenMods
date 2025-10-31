import { z } from "zod";

export const releaseManifestSchema = z.object({
  schemaVersion: z.string().optional(),
  gameId: z.string().min(1),
  slug: z.string().min(1),
  version: z.string().regex(/^v?[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.-]+)?$/),
  displayVersion: z.string().optional(),
  releaseDate: z.string().optional(),
  changelog: z
    .array(
      z.object({
        title: z.string(),
        body: z.string()
      })
    )
    .optional(),
  artifacts: z
    .array(
      z.object({
        type: z.enum(["torrent", "magnet", "https", "ipfs", "file"]),
        uri: z.string(),
        sizeBytes: z.number().int().nonnegative().optional(),
        hashes: z
          .array(
            z.object({
              algorithm: z.string(),
              value: z.string()
            })
          )
          .optional()
      })
    )
    .nonempty(),
  hashes: z
    .array(
      z.object({
        algorithm: z.string(),
        value: z.string()
      })
    )
    .optional(),
  compatibility: z
    .object({
      gameVersionRange: z.string(),
      loadOrderHints: z.array(z.string()).optional(),
      platforms: z.array(z.string()).optional()
    })
    .optional(),
  dependencies: z
    .array(
      z.object({
        slug: z.string(),
        gameId: z.string().optional(),
        versionRange: z.string(),
        optional: z.boolean().optional()
      })
    )
    .optional(),
  zapSplit: z
    .array(
      z.object({
        pubkey: z.string(),
        percentage: z.number()
      })
    )
    .optional()
});

export type ReleaseManifest = z.infer<typeof releaseManifestSchema>;
export type ReleaseArtifact = ReleaseManifest["artifacts"][number];
