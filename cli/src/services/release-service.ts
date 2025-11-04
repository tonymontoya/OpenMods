import { promises as fs } from "fs";
import { resolve } from "path";
import {
  releaseManifestSchema,
  type ReleaseArtifact,
  type ReleaseManifest
} from "./manifest-service.js";
import { hashFileSha256, aggregateRootHash, type FileHash } from "./hash-service.js";

interface BuildManifestArgs {
  slug: string;
  gameId: string;
  version: string;
  displayVersion?: string;
  artifactPaths: string[];
  notesPath: string;
}

export async function buildReleaseManifest(args: BuildManifestArgs): Promise<ReleaseManifest> {
  if (!args.artifactPaths.length) {
    throw new Error("Provide at least one artifact path when building a release manifest");
  }
  const changelog = await readNotes(args.notesPath);
  const artifacts = await Promise.all(
    args.artifactPaths.map(async (relativePath) => await buildArtifact(relativePath))
  );

  if (!artifacts.length) {
    throw new Error("Failed to resolve release artifacts");
  }

  const artifactList = artifacts as [ReleaseArtifact, ...ReleaseArtifact[]];

  const manifest: ReleaseManifest = {
    schemaVersion: "1.0.0",
    gameId: args.gameId,
    slug: args.slug,
    version: args.version,
    displayVersion: args.displayVersion ?? args.version,
    releaseDate: new Date().toISOString(),
    changelog: changelog ? [{ title: "notes", body: changelog }] : [],
    artifacts: artifactList
  };

  const sha256Hashes: FileHash[] = artifactList
    .flatMap((artifact) => artifact.hashes ?? [])
    .filter((hash): hash is FileHash => hash.algorithm === "sha256");
  const rootHash = aggregateRootHash(sha256Hashes);
  if (rootHash) {
    manifest.hashes = [rootHash];
  }

  return releaseManifestSchema.parse(manifest);
}

async function buildArtifact(relativePath: string): Promise<ReleaseArtifact> {
  if (relativePath.startsWith("magnet:?")) {
    return {
      type: "magnet",
      uri: relativePath
    };
  }

  const absolutePath = resolve(process.cwd(), relativePath);
  const stats = await fs.stat(absolutePath);
  const hash = await hashFileSha256(absolutePath);

  return {
    type: inferArtifactType(relativePath),
    uri: relativePath,
    sizeBytes: stats.size,
    hashes: [hash]
  };
}

async function readNotes(filePath: string): Promise<string> {
  try {
    const absolute = resolve(process.cwd(), filePath);
    return await fs.readFile(absolute, "utf-8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return "";
    }
    throw error;
  }
}

function inferArtifactType(path: string): ReleaseArtifact["type"] {
  if (path.endsWith(".torrent")) return "torrent";
  if (path.startsWith("magnet:?")) return "magnet";
  if (path.startsWith("http")) return "https";
  if (path.startsWith("ipfs://")) return "ipfs";
  return "file";
}
