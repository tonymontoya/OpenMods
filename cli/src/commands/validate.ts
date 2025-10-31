import { promises as fs } from "fs";
import { resolve } from "path";
import { Command } from "commander";
import { logger } from "../utils/logger.js";
import { ConfigService } from "../services/config-service.js";
import { projectManifestSchema } from "../services/project-manifest-service.js";
import { releaseManifestSchema } from "../services/manifest-service.js";

export function buildValidateCommand(): Command {
  const command = new Command("validate");
  command.description("Validate OpenMods configuration and manifest files");

  command
    .command("config")
    .description("Validate openmods.json against the schema")
    .action(async () => {
      try {
        const configService = new ConfigService(process.cwd());
        const config = await configService.load();
        logger.success(
          `Configuration valid for ${config.gameId}.${config.projectSlug}`
        );
      } catch (error) {
        logger.error("Configuration validation failed", error);
        process.exitCode = 1;
      }
    });

  command
    .command("project-manifest")
    .description("Validate a project manifest JSON file")
    .option("--file <path>", "Path to project manifest", "project/project.json")
    .action(async (options) => {
      try {
        const filePath = resolve(process.cwd(), options.file);
        const manifest = await readJson(filePath);
        const parsed = projectManifestSchema.parse(manifest);

        const configService = new ConfigService(process.cwd());
        if (await configService.exists()) {
          const config = await configService.load();
          ensureIdsMatch(parsed.gameId, config.gameId, "gameId");
          ensureIdsMatch(parsed.slug, config.projectSlug, "slug");
        }

        logger.success(`Project manifest valid at ${filePath}`);
      } catch (error) {
        logger.error("Project manifest validation failed", error);
        process.exitCode = 1;
      }
    });

  command
    .command("release-manifest")
    .description("Validate a release manifest JSON file")
    .option(
      "--file <path>",
      "Path to release manifest",
      "artifacts/release/manifest.json"
    )
    .action(async (options) => {
      try {
        const filePath = resolve(process.cwd(), options.file);
        const manifest = await readJson(filePath);
        const parsed = releaseManifestSchema.parse(manifest);

        const configService = new ConfigService(process.cwd());
        if (await configService.exists()) {
          const config = await configService.load();
          ensureIdsMatch(parsed.gameId, config.gameId, "gameId");
          ensureIdsMatch(parsed.slug, config.projectSlug, "slug");
        }

        logger.success(`Release manifest valid at ${filePath}`);
      } catch (error) {
        logger.error("Release manifest validation failed", error);
        process.exitCode = 1;
      }
    });

  return command;
}

async function readJson(path: string): Promise<unknown> {
  const raw = await fs.readFile(path, "utf-8");
  return JSON.parse(raw);
}

function ensureIdsMatch(value: string, expected: string, label: string): void {
  if (value !== expected) {
    throw new Error(`Manifest ${label} ${value} does not match config ${expected}`);
  }
}
