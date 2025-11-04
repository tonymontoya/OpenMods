import { promises as fs } from "fs";
import { resolve } from "path";
import { Command } from "commander";
import { nip19, verifyEvent, type Event } from "nostr-tools";
import { logger } from "../../utils/logger.js";
import { releaseManifestSchema } from "../../services/manifest-service.js";

export function buildReleaseVerifyCommand(): Command {
  const command = new Command("verify");

  command
    .description("Validate a release manifest event and ensure signature + payload integrity")
    .option("--event <file>", "Path to signed event JSON", "artifacts/release/event-30079.json")
    .option(
      "--manifest <file>",
      "Optional manifest JSON to compare with event content",
      "artifacts/release/manifest.json"
    )
    .action(async (options) => {
      try {
        const eventPath = resolve(process.cwd(), options.event);
        const event = await readEvent(eventPath);
        await ensureSignatureValid(event);

        logger.success(`Signature verified for event ${event.id}`);

        if (options.manifest) {
          const manifestPath = resolve(process.cwd(), options.manifest);
          await compareManifest(event, manifestPath);
          logger.success("Event content matches manifest on disk");
        }
      } catch (error) {
        logger.error("Release verification failed", error);
        process.exitCode = 1;
      }
    });

  return command;
}

async function readEvent(filePath: string): Promise<Event> {
  const raw = await fs.readFile(filePath, "utf-8");
  const json = JSON.parse(raw);
  if (json.kind !== 30079) {
    throw new Error(`Expected kind 30079 event, received kind ${json.kind}`);
  }
  return json as Event;
}

async function ensureSignatureValid(event: Event): Promise<void> {
  const valid = verifyEvent(event);
  if (!valid) {
    throw new Error("Event signature verification failed");
  }

  // Basic sanity check on published-by tag vs public key.
  const publishedBy = event.tags.find((tag) => tag[0] === "published-by")?.[1];
  if (publishedBy) {
    if (publishedBy.startsWith("npub")) {
      const decoded = nip19.decode(publishedBy);
      if (decoded.type !== "npub") {
        throw new Error(`Invalid published-by tag type: ${decoded.type}`);
      }
      const pubkeyHex = decoded.data;
      if (pubkeyHex !== event.pubkey) {
        throw new Error("published-by npub does not match event pubkey");
      }
    } else if (publishedBy !== event.pubkey) {
      throw new Error("published-by tag must match event pubkey");
    }
  }
}

async function compareManifest(event: Event, manifestPath: string): Promise<void> {
  const raw = await fs.readFile(manifestPath, "utf-8");
  const manifest = releaseManifestSchema.parse(JSON.parse(raw));
  const eventManifest = releaseManifestSchema.parse(JSON.parse(event.content));

  if (JSON.stringify(manifest) !== JSON.stringify(eventManifest)) {
    throw new Error("Manifest file does not match event content");
  }
}
