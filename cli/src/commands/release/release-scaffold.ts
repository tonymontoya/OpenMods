import { promises as fs } from "fs";
import { dirname, resolve } from "path";
import { Command } from "commander";
import { logger } from "../../utils/logger.js";
import { ConfigService } from "../../services/config-service.js";
import {
  releaseManifestSchema,
  type ReleaseManifest
} from "../../services/manifest-service.js";

export function buildReleaseScaffoldCommand(): Command {
  const command = new Command("scaffold");

  command
    .description("Create a starter release manifest and changelog stub")
    .option("--out <file>", "Target manifest path", "artifacts/release/manifest.json")
    .option(
      "--version <semver>",
      "Initial version to embed in the manifest",
      "0.1.0"
    )
    .option("--force", "Overwrite existing manifest", false)
    .action(async (options) => {
      try {
        const configService = new ConfigService(process.cwd());
        const config = await configService.load();

        const manifestPath = resolve(process.cwd(), options.out);
        if (!options.force && (await fileExists(manifestPath))) {
          logger.warn(
            `Release manifest already exists at ${manifestPath}; use --force to regenerate.`
          );
          return;
        }

        const changelogPath = resolve(process.cwd(), "artifacts/changelog.md");
        await ensureChangelog(changelogPath);

        const manifest = buildManifest({
          config,
          version: options.version,
          changelogPath: changelogPath
        });

        await fs.mkdir(dirname(manifestPath), { recursive: true });
        await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2) + "\n", "utf-8");

        logger.success(`Release manifest scaffolded at ${manifestPath}`);
      } catch (error) {
        logger.error("Failed to scaffold release manifest", error);
        process.exitCode = 1;
      }
    });

  return command;
}

interface BuildManifestArgs {
  config: Awaited<ReturnType<ConfigService["load"]>>;
  version: string;
  changelogPath: string;
}

function buildManifest(args: BuildManifestArgs): ReleaseManifest {
  const now = new Date().toISOString();
  const torrentName = `${args.config.projectSlug}-v${args.version}.torrent`;
  const manifest: ReleaseManifest = {
    schemaVersion: "1.0.0",
    gameId: args.config.gameId,
    slug: args.config.projectSlug,
    version: args.version,
    displayVersion: args.version,
    releaseDate: now,
    changelog: [
      {
        title: "notes",
        body: "Refer to artifacts/changelog.md for release details."
      }
    ],
    artifacts: [
      {
        type: "torrent",
        uri: `${args.config.release.torrentsDir}/${torrentName}`
      }
    ]
  };

  return releaseManifestSchema.parse(manifest);
}

async function ensureChangelog(changelogPath: string): Promise<void> {
  if (await fileExists(changelogPath)) {
    return;
  }

  await fs.mkdir(dirname(changelogPath), { recursive: true });
  const placeholder = `# Changelog\n\n- Describe the changes introduced in this release.\n`;
  await fs.writeFile(changelogPath, placeholder, "utf-8");
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await fs.access(path);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return false;
    }
    throw error;
  }
}
