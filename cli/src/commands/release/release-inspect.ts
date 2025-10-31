import { resolve } from "path";
import { promises as fs } from "fs";
import { Command } from "commander";
import { logger } from "../../utils/logger.js";
import {
  releaseManifestSchema,
  type ReleaseManifest
} from "../../services/manifest-service.js";

export function buildReleaseInspectCommand(): Command {
  const command = new Command("inspect");

  command
    .description("Preview key details from a release manifest")
    .option("--file <path>", "Path to release manifest", "artifacts/release/manifest.json")
    .action(async (options) => {
      try {
        const manifest = await loadManifest(options.file);
        printReleaseSummary(manifest);
      } catch (error) {
        logger.error("Failed to inspect release manifest", error);
        process.exitCode = 1;
      }
    });

  return command;
}

async function loadManifest(path: string): Promise<ReleaseManifest> {
  const absolute = resolve(process.cwd(), path);
  const raw = await fs.readFile(absolute, "utf-8");
  return releaseManifestSchema.parse(JSON.parse(raw));
}

export function printReleaseSummary(manifest: ReleaseManifest): void {
  logger.info(`${manifest.slug} v${manifest.displayVersion ?? manifest.version}`);
  logger.info(`Game: ${manifest.gameId}`);
  if (manifest.releaseDate) {
    logger.info(`Published: ${manifest.releaseDate}`);
  }
  if (manifest.changelog?.length) {
    logger.info("Changelog highlights:");
    manifest.changelog.forEach((entry) => {
      logger.info(`  - ${entry.title}: ${entry.body.split("\n")[0]}`);
    });
  }
  logger.info("");

  logger.info("Artifacts:");
  manifest.artifacts.forEach((artifact) => {
    const size = artifact.sizeBytes ? ` (${artifact.sizeBytes} bytes)` : "";
    logger.info(`  - [${artifact.type}] ${artifact.uri}${size}`);
  });

  if (manifest.dependencies?.length) {
    logger.info("");
    logger.info("Dependencies:");
    manifest.dependencies.forEach((dependency) => {
      const target = `${dependency.gameId ?? manifest.gameId}.${dependency.slug}`;
      logger.info(`  - ${target} ${dependency.versionRange ?? ""}`.trim());
    });
  }
}
