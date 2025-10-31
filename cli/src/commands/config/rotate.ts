import { Command } from "commander";
import { nip19 } from "nostr-tools";
import { logger } from "../../utils/logger.js";
import { ConfigService } from "../../services/config-service.js";

export function buildConfigRotateCommand(): Command {
  const command = new Command("rotate-author-key");

  command
    .description("Update the author npub in openmods.json")
    .argument("<npub>", "Bech32 encoded author public key")
    .action(async (npub) => {
      try {
        validateNpub(npub);
        const configService = new ConfigService(process.cwd());
        const updated = await configService.rotateAuthorPubkey(npub);
        logger.success(`Updated author pubkey for ${updated.gameId}.${updated.projectSlug}`);
      } catch (error) {
        logger.error("Failed to rotate author key", error);
        process.exitCode = 1;
      }
    });

  return command;
}

function validateNpub(npub: string): void {
  if (!npub.startsWith("npub")) {
    throw new Error("Author key must be a bech32 npub");
  }
  const decoded = nip19.decode(npub);
  if (decoded.type !== "npub") {
    throw new Error(`Expected npub, received ${decoded.type}`);
  }
}
