import { promises as fs } from "fs";
import { dirname, resolve } from "path";
import { Command } from "commander";
import { logger } from "../../utils/logger.js";
import { ConfigService } from "../../services/config-service.js";
import { buildReleaseManifest } from "../../services/release-service.js";

export function buildReleaseBuildCommand(): Command {
  const command = new Command("build");

  command
    .description("Generate a release manifest with hashes for the supplied artifacts")
    .option(
      "--artifact <file...>",
      "Relative path(s) to release artifacts (archives, torrents, magnets, etc.)."
    )
    .option(
      "--notes <file>",
      "Markdown file describing release notes; defaults to artifacts/changelog.md",
      "artifacts/changelog.md"
    )
    .option(
      "--version <semver>",
      "Release version; must match semantic versioning.",
      "0.0.1"
    )
    .option(
      "--display-version <value>",
      "Optional display version (defaults to --version)",
      undefined
    )
    .option(
      "--out <file>",
      "Output manifest JSON path",
      "artifacts/release/manifest.json"
    )
    .action(async (options) => {
      try {
        const configService = new ConfigService(process.cwd());
        const config = await configService.load();

        const artifactPaths = options.artifact ?? [];
        if (!artifactPaths.length) {
          throw new Error("At least one --artifact must be provided");
        }

        const manifestPath = resolve(process.cwd(), options.out);
        await fs.mkdir(dirname(manifestPath), { recursive: true });

        const manifest = await buildReleaseManifest({
          slug: config.projectSlug,
          gameId: config.gameId,
          version: options.version,
          displayVersion: options.displayVersion,
          artifactPaths,
          notesPath: options.notes
        });

        await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2) + "\n", "utf-8");
        logger.success(`Release manifest written to ${manifestPath}`);
      } catch (error) {
        logger.error("Failed to build release manifest", error);
        process.exitCode = 1;
      }
    });

  return command;
}

interface BuildManifestArgs {
  slug: string;
  gameId: string;
  version: string;
  displayVersion?: string;
  artifactPaths: string[];
  notesPath: string;
}
