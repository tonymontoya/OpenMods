import { promises as fs } from "fs";
import { resolve } from "path";
import { ConfigService, type OpenModsConfig } from "./config-service.js";
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
  config?: OpenModsConfig;
}

export async function parseTrackingWarnings(context: LintContext): Promise<LintWarning[]> {
  const warnings: LintWarning[] = [];
  const manifestDir = resolve(context.manifestPath, ".." );

  // Artifact existence check
  for (const artifact of context.manifest.artifacts ?? []) {
    if (artifact.type === "magnet") {
      continue;
    }
    if (!artifact.uri) {
      warnings.push({ level: "error", message: "Artifact missing URI" });
      continue;
    }
    if (artifact.type === "torrent" || artifact.type === "file") {
      const localPath = resolve(process.cwd(), artifact.uri);
      try {
        await fs.access(localPath);
      } catch (_error) {
        warnings.push({
          level: "error",
          message: `Artifact not found on disk: ${artifact.uri}`
        });
      }
    }
  }

  // Dependency existence check (project slug reference)
  const dependencies = context.manifest.dependencies ?? [];
  for (const dependency of dependencies) {
    if (!dependency.slug) {
      warnings.push({ level: "warn", message: "Dependency missing slug" });
    }
  }

  // Tracker health check for torrent artifacts
  const trackerWarnings = await evaluateTrackers(context.manifest);
  warnings.push(...trackerWarnings);

  return warnings;
}

async function evaluateTrackers(manifest: ReleaseManifest): Promise<LintWarning[]> {
  const torrentArtifacts = manifest.artifacts?.filter(
    (artifact) => artifact.type === "torrent" && artifact.uri
  ) ?? [];

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
