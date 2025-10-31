import { createHash } from "crypto";
import { promises as fs } from "fs";
import { resolve } from "path";
import { hashFileSha256 } from "./hash-service.js";
import { ReleaseManifest } from "./manifest-service.js";
import { checkTorrentStatus } from "./seed-status-service.js";

export type LintLevel = "warn" | "error";

export interface LintWarning {
  level: LintLevel;
  message: string;
}

interface LintContext {
  manifest: ReleaseManifest;
  manifestPath: string;
}

interface LintOptions {
  skipTrackerChecks?: boolean;
}

export async function lintReleaseManifest(
  context: LintContext,
  options: LintOptions = {}
): Promise<LintWarning[]> {
  const warnings: LintWarning[] = [];
  const manifestDir = resolve(context.manifestPath, "..");

  warnings.push(...(await checkArtifactFiles(context.manifest, manifestDir)));
  warnings.push(...checkDependencies(context.manifest));
  warnings.push(...checkRootHashes(context.manifest));

  if (!options.skipTrackerChecks) {
    warnings.push(...(await evaluateTrackers(context.manifest)));
  }

  return warnings;
}

async function checkArtifactFiles(
  manifest: ReleaseManifest,
  manifestDir: string
): Promise<LintWarning[]> {
  const warnings: LintWarning[] = [];

  for (const artifact of manifest.artifacts ?? []) {
    if (!artifact.uri) {
      warnings.push({ level: "error", message: "Artifact missing URI" });
      continue;
    }

    if (artifact.type === "magnet") {
      if (!artifact.uri.startsWith("magnet:")) {
        warnings.push({ level: "warn", message: `Magnet URI malformed: ${artifact.uri}` });
      }
      continue;
    }

    const isLocalFile = !artifact.uri.match(/^https?:/i) && !artifact.uri.startsWith("ipfs://");
    if (isLocalFile) {
      const localPath = resolve(manifestDir, artifact.uri);
      try {
        await fs.access(localPath);
      } catch (_error) {
        warnings.push({ level: "error", message: `Artifact not found: ${artifact.uri}` });
        continue;
      }

      const declaredHash = artifact.hashes?.find((hash) => hash.algorithm === "sha256");
      if (!declaredHash) {
        warnings.push({ level: "warn", message: `Artifact missing sha256 hash: ${artifact.uri}` });
      } else {
        const actualHash = await hashFileSha256(localPath);
        if (actualHash.value !== declaredHash.value) {
          warnings.push({
            level: "error",
            message: `Artifact hash mismatch for ${artifact.uri} (expected ${declaredHash.value}, got ${actualHash.value})`
          });
        }
      }
    }
  }

  return warnings;
}

function checkDependencies(manifest: ReleaseManifest): LintWarning[] {
  const warnings: LintWarning[] = [];
  const dependencies = manifest.dependencies ?? [];
  const seen = new Set<string>();

  for (const dependency of dependencies) {
    if (!dependency.slug) {
      warnings.push({ level: "warn", message: "Dependency declared without slug" });
      continue;
    }
    const key = `${dependency.gameId ?? manifest.gameId}:${dependency.slug}`;
    if (seen.has(key)) {
      warnings.push({ level: "warn", message: `Duplicate dependency entry: ${key}` });
    }
    seen.add(key);

    if (dependency.gameId && dependency.gameId !== manifest.gameId) {
      warnings.push({
        level: "warn",
        message: `Dependency ${dependency.slug} targets different gameId (${dependency.gameId})`
      });
    }
  }

  return warnings;
}

function checkRootHashes(manifest: ReleaseManifest): LintWarning[] {
  const warnings: LintWarning[] = [];
  const artifactHashes = (manifest.artifacts ?? [])
    .flatMap((artifact) => artifact.hashes ?? [])
    .filter((hash) => hash.algorithm === "sha256")
    .map((hash) => hash.value);

  if (!artifactHashes.length) {
    warnings.push({ level: "warn", message: "No artifact sha256 hashes available for root hash aggregation" });
    return warnings;
  }

  const expectedRoot = computeRootHash(artifactHashes);
  const manifestRoot = manifest.hashes?.find((hash) => hash.algorithm === "sha256");

  if (!manifestRoot) {
    warnings.push({ level: "warn", message: "Release manifest missing root sha256 hash" });
  } else if (manifestRoot.value !== expectedRoot) {
    warnings.push({
      level: "error",
      message: `Root hash mismatch (expected ${expectedRoot}, got ${manifestRoot.value})`
    });
  }

  return warnings;
}

function computeRootHash(hashes: string[]): string {
  const hash = createHash("sha256");
  hashes.forEach((value) => hash.update(value));
  return hash.digest("hex");
}

async function evaluateTrackers(manifest: ReleaseManifest): Promise<LintWarning[]> {
  const torrentArtifacts = (manifest.artifacts ?? []).filter(
    (artifact) => artifact.type === "torrent" && artifact.uri
  );

  if (!torrentArtifacts.length) {
    return [];
  }

  const warnings: LintWarning[] = [];

  for (const artifact of torrentArtifacts) {
    try {
      const status = await checkTorrentStatus({ torrent: artifact.uri });
      if ((status.aggregateSeeders ?? 0) < 1) {
        warnings.push({
          level: "warn",
          message: `No seeders detected for ${artifact.uri}; ensure seeders are online before publishing.`
        });
      }
      status.trackers
        .filter((tracker) => tracker.health === "error")
        .forEach((tracker) =>
          warnings.push({
            level: "warn",
            message: `Tracker ${tracker.url} error: ${tracker.error ?? "unknown"}`
          })
        );
    } catch (error) {
      warnings.push({
        level: "warn",
        message: `Failed to inspect torrent ${artifact.uri}: ${String(error)}`
      });
    }
  }

  return warnings;
}
