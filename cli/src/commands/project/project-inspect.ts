import { resolve } from "path";
import { promises as fs } from "fs";
import { Command } from "commander";
import { logger } from "../../utils/logger.js";
import {
  projectManifestSchema,
  type ProjectManifest
} from "../../services/project-manifest-service.js";

export function buildProjectInspectCommand(): Command {
  const command = new Command("inspect");

  command
    .description("Preview key details from a project manifest")
    .option("--file <path>", "Path to project manifest", "project/project.json")
    .action(async (options) => {
      try {
        const manifest = await loadManifest(options.file);
        printProjectSummary(manifest);
      } catch (error) {
        logger.error("Failed to inspect project manifest", error);
        process.exitCode = 1;
      }
    });

  return command;
}

async function loadManifest(path: string): Promise<ProjectManifest> {
  const absolute = resolve(process.cwd(), path);
  const raw = await fs.readFile(absolute, "utf-8");
  return projectManifestSchema.parse(JSON.parse(raw));
}

export function printProjectSummary(manifest: ProjectManifest): void {
  logger.info(`${manifest.title} (${manifest.gameId}.${manifest.slug})`);
  logger.info(manifest.summary);
  logger.info("");

  logger.info("Authors:");
  manifest.authors.forEach((author) => {
    const parts = [author.role, author.pubkey];
    if (author.displayName) parts.push(`alias: ${author.displayName}`);
    if (typeof author.zapSplit === "number") {
      parts.push(`zap: ${(author.zapSplit * 100).toFixed(0)}%`);
    }
    logger.info(`  - ${parts.join(" | ")}`);
  });

  logger.info("");
  if (manifest.categories?.length) {
    logger.info(`Categories: ${manifest.categories.join(", ")}`);
  }
  if (manifest.tags?.length) {
    logger.info(`Tags: ${manifest.tags.join(", ")}`);
  }
  if (manifest.relayHints.length) {
    logger.info(`Relay hints: ${manifest.relayHints.join(", ")}`);
  }
}
