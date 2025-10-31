import { promises as fs } from "fs";
import { dirname, resolve } from "path";
import { Command } from "commander";
import { logger } from "../../utils/logger.js";
import { ConfigService } from "../../services/config-service.js";
import {
  projectManifestSchema,
  type ProjectManifest
} from "../../services/project-manifest-service.js";

export function buildProjectScaffoldCommand(): Command {
  const command = new Command("scaffold");

  command
    .description("Create a project manifest skeleton populated from openmods.json")
    .option("--out <file>", "Target manifest JSON path", "project/project.json")
    .option("--force", "Overwrite existing manifest", false)
    .action(async (options) => {
      try {
        const configService = new ConfigService(process.cwd());
        const config = await configService.load();

        if (!config.authorPubkey) {
          throw new Error(
            "openmods.json is missing authorPubkey; rerun `openmods init` with --author-pubkey"
          );
        }

        const manifestPath = resolve(process.cwd(), options.out);
        if (!options.force && (await fileExists(manifestPath))) {
          logger.warn(
            `Manifest already exists at ${manifestPath}; use --force to regenerate if needed.`
          );
          return;
        }

        const manifest = buildManifest(config);
        await fs.mkdir(dirname(manifestPath), { recursive: true });
        await fs.writeFile(
          manifestPath,
          JSON.stringify(manifest, null, 2) + "\n",
          "utf-8"
        );

        logger.success(`Project manifest scaffolded at ${manifestPath}`);
      } catch (error) {
        logger.error("Failed to scaffold project manifest", error);
        process.exitCode = 1;
      }
    });

  return command;
}

function buildManifest(config: Awaited<ReturnType<ConfigService["load"]>>): ProjectManifest {
  const manifest: ProjectManifest = {
    version: "1.0.0",
    gameId: config.gameId,
    slug: config.projectSlug,
    title: "TODO: Replace with project title",
    summary: "TODO: Replace with a concise description of the project",
    description: "",
    links: {
      homepage: "https://example.com/your-project"
    },
    authors: [
      {
        pubkey: config.authorPubkey!,
        role: "maintainer",
        displayName: "TODO: Maintainer name"
      }
    ],
    relayHints: config.relays,
    categories: [],
    tags: [],
    contentWarnings: []
  };

  if (config.zap) {
    manifest.zapConfig = { ...config.zap };
  }

  return projectManifestSchema.parse(manifest);
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
