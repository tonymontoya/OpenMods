import { promises as fs } from "fs";
import { resolve } from "path";
import { Command } from "commander";
import { releaseManifestSchema } from "../../services/manifest-service.js";
import { logger } from "../../utils/logger.js";
import { lintReleaseManifest } from "../../services/release-lint-service.js";

export function buildLintReleaseCommand(): Command {
  const command = new Command("release");

  command
    .description("Lint a release manifest and its referenced artifacts")
    .option("--manifest <file>", "Path to release manifest", "artifacts/release/manifest.json")
    .option("--strict", "Treat warnings as errors", false)
    .option("--skip-tracker-checks", "Skip tracker probing", false)
    .action(async (options) => {
      try {
        const manifestPath = resolve(process.cwd(), options.manifest);
        const manifestRaw = await fs.readFile(manifestPath, "utf-8");
        const manifest = releaseManifestSchema.parse(JSON.parse(manifestRaw));

        const warnings = await lintReleaseManifest(
          { manifest, manifestPath },
          { skipTrackerChecks: options.skipTrackerChecks }
        );
        const errors = warnings.filter((warning) => warning.level === "error");
        const warnOnly = warnings.filter((warning) => warning.level === "warn");

        if (warnings.length === 0) {
          logger.success(`Release manifest ${manifestPath} passed lint checks.`);
          return;
        }

        warnings.forEach((warning) => {
          const prefix = warning.level === "error" ? "ERROR" : "WARN";
          logger.warn(`${prefix}: ${warning.message}`);
        });

        if (errors.length > 0 || (options.strict && warnOnly.length > 0)) {
          throw new Error("Release manifest failed lint checks");
        }

        logger.success(`Release manifest ${manifestPath} linted with warnings.`);
      } catch (error) {
        logger.error("Release linting failed", error);
        process.exitCode = 1;
      }
    });

  return command;
}
