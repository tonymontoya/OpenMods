import { Command } from "commander";
import { logger } from "../../utils/logger.js";
import { ConfigService, type SignerConfig } from "../../services/config-service.js";

export function buildConfigSetSignerCommand(): Command {
  const command = new Command("set-signer");

  command
    .description("Configure signing mode (local or delegated)")
    .option("--mode <mode>", "Signer mode: local or delegated", "local")
    .option("--relay <url>", "Delegated signer relay URL")
    .option("--remote-pubkey <npub>", "Delegated signer npub")
    .option(
      "--capability <name...>",
      "Delegated signer capabilities (kind30078, kind30079, zap)",
      collectCapabilities,
      ["kind30078", "kind30079"]
    )
    .action(async (options) => {
      try {
        const mode = options.mode as "local" | "delegated";
        const signerConfig: SignerConfig = {
          mode,
          delegated:
            mode === "delegated"
              ? {
                  relay: options.relay,
                  remotePubkey: options.remotePubkey,
                  capabilities: options.capability
                }
              : undefined
        } as SignerConfig;

        if (mode === "delegated") {
          if (!options.relay || !options.remotePubkey) {
            throw new Error("Delegated mode requires --relay and --remote-pubkey");
          }
        }

        const configService = new ConfigService(process.cwd());
        const updated = await configService.setSigner(signerConfig);
        logger.success(`Updated signer configuration for ${updated.gameId}.${updated.projectSlug}`);
      } catch (error) {
        logger.error("Failed to update signer configuration", error);
        process.exitCode = 1;
      }
    });

  return command;
}

function collectCapabilities(value: string, previous: string[]): string[] {
  const known = new Set(["kind30078", "kind30079", "zap"]);
  if (!known.has(value)) {
    throw new Error(`Unsupported capability: ${value}`);
  }
  const list = previous ?? [];
  if (!list.includes(value)) {
    list.push(value);
  }
  return list;
}
