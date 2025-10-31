import { Command } from "commander";
import { logger } from "../utils/logger.js";
import { ConfigService, OpenModsConfig } from "../services/config-service.js";

export function buildInitCommand(): Command {
  const command = new Command("init");

  command
    .description("Initialize an OpenMods project configuration in the current directory.")
    .option("--game-id <gameId>", "Game identifier for this project", "skyrim-se")
    .option("--slug <slug>", "Project slug (gameId is added automatically)")
    .option("--relay <relay...>", "Preferred relay URLs", collectValues, [
      "wss://relay.damus.io",
      "wss://nostr.openmods.dev"
    ])
    .option(
      "--artifacts-dir <path>",
      "Relative path where build artifacts are written",
      "artifacts"
    )
    .option(
      "--torrents-dir <path>",
      "Relative path where torrent metadata is stored",
      "artifacts/torrents"
    )
    .option(
      "--author-pubkey <npub>",
      "Author npub that will sign project and release events"
    )
    .option("--zap-lnurl <lnurl>", "Optional LNURL pay identifier for zap support")
    .action(async (options) => {
      try {
        const configService = new ConfigService(process.cwd());
        const exists = await configService.exists();
        if (exists) {
          logger.warn("openmods.json already exists; aborting to avoid overwriting local data.");
          return;
        }

        if (!options.slug) {
          throw new Error("--slug is required when initializing a project");
        }

        const config: OpenModsConfig = {
          gameId: options.gameId,
          projectSlug: options.slug,
          relays: options.relay,
          authorPubkey: options.authorPubkey,
          zap: options.zapLnurl
            ? {
                lnurl: options.zapLnurl
              }
            : undefined,
          release: {
            artifactsDir: options.artifactsDir,
            torrentsDir: options.torrentsDir
          }
        };

        await configService.save(config);
        logger.success(`Created openmods.json for ${config.gameId}.${config.projectSlug}`);
      } catch (error) {
        logger.error("Failed to initialize project", error);
        process.exitCode = 1;
      }
    });

  return command;
}

function collectValues(value: string, previous: string[]): string[] {
  const values = [...(previous ?? [])];
  if (!values.includes(value)) {
    values.push(value);
  }
  return values;
}
