import { Buffer } from "buffer";
import { promises as fs } from "fs";
import { dirname, resolve } from "path";
import { Command } from "commander";
import { finalizeEvent, nip19, type Event, type UnsignedEvent } from "nostr-tools";
import { logger } from "../../utils/logger.js";
import { ConfigService, type OpenModsConfig } from "../../services/config-service.js";
import {
  releaseManifestSchema,
  type ReleaseManifest
} from "../../services/manifest-service.js";
import { RelayPublisher } from "../../services/relay-publisher.js";
import { printReleaseSummary } from "./release-inspect.js";

export function buildReleasePublishCommand(): Command {
  const command = new Command("publish");

  command
    .description("Publish a release manifest to configured relays (dry-run by default)")
    .option("--manifest <file>", "Path to manifest JSON", "artifacts/release/manifest.json")
    .option("--out <file>", "Where to write the prepared event", "artifacts/release/event-30079.json")
    .option("--secret <nsec>", "Nostr nsec used to sign the event; falls back to OPENMODS_NSEC")
    .option("--dry-run", "Do not push to relays; only write the event", true)
    .option("--summary", "Display manifest summary before writing the event")
    .option("--relay <url...>", "Override relay list when publishing")
    .action(async (options) => {
      try {
        const configService = new ConfigService(process.cwd());
        const config = await configService.load();

        if (config.signer?.mode === "delegated" && !(options.secret ?? process.env.OPENMODS_NSEC)) {
          logger.info(
            "Signer mode is delegated; emitting unsigned event for remote signer (no --secret provided)."
          );
        }

        if (!config.authorPubkey) {
          throw new Error("openmods.json is missing authorPubkey; run `openmods init` with --author-pubkey");
        }

        const manifestPath = resolve(process.cwd(), options.manifest);
        const manifest = await readManifest(manifestPath);
        if (options.summary) {
          printReleaseSummary(manifest);
        }
        validateManifest(manifest, config);

        const event = await prepareEvent({
          manifest,
          config,
          secret: options.secret ?? process.env.OPENMODS_NSEC,
          createdAt: Math.floor(Date.now() / 1000)
        });

        const outPath = resolve(process.cwd(), options.out);
        await fs.mkdir(dirname(outPath), { recursive: true });
        await fs.writeFile(outPath, JSON.stringify(event, null, 2) + "\n", "utf-8");

        await maybePublish(options, event, config);
      } catch (error) {
        logger.error("Failed to publish release", error);
        process.exitCode = 1;
      }
    });

  return command;
}

async function readManifest(filePath: string): Promise<ReleaseManifest> {
  const raw = await fs.readFile(filePath, "utf-8");
  const json = JSON.parse(raw);
  return releaseManifestSchema.parse(json);
}

function validateManifest(manifest: ReleaseManifest, config: OpenModsConfig): void {
  if (manifest.slug !== config.projectSlug) {
    throw new Error(`Manifest slug ${manifest.slug} does not match config ${config.projectSlug}`);
  }
  if (manifest.gameId !== config.gameId) {
    throw new Error(`Manifest gameId ${manifest.gameId} does not match config ${config.gameId}`);
  }
}

interface PrepareEventArgs {
  manifest: ReleaseManifest;
  config: OpenModsConfig;
  secret?: string;
  createdAt: number;
}

async function prepareEvent(args: PrepareEventArgs): Promise<UnsignedEvent | Event> {
  const secretKey = args.secret ? decodeSecret(args.secret) : undefined;
  const pubkeyHex = await derivePubkey(secretKey, args.config.authorPubkey);
  const authorTag = resolveAuthorTag(pubkeyHex, args.config.authorPubkey);
  const tags = buildTags(args.manifest, authorTag);
  const unsigned: UnsignedEvent = {
    kind: 30079,
    created_at: args.createdAt,
    pubkey: pubkeyHex,
    tags,
    content: JSON.stringify(args.manifest)
  };

  if (!secretKey) {
    return unsigned;
  }

  return finalizeEvent(unsigned, secretKey);
}

function buildTags(manifest: ReleaseManifest, authorIdentifier: string): string[][] {
  const tags: string[][] = [];
  tags.push(["d", `${manifest.gameId}.${manifest.slug}@${manifest.version}`]);
  tags.push(["game", manifest.gameId]);
  tags.push(["slug", manifest.slug]);
  tags.push(["version", manifest.version]);
  tags.push(["published-by", authorIdentifier]);

  for (const artifact of manifest.artifacts) {
    tags.push(["distribution", artifact.uri]);
    if (artifact.hashes) {
      for (const hash of artifact.hashes) {
        tags.push(["hash", `${hash.algorithm}:${hash.value}`]);
      }
    }
  }

  if (manifest.hashes) {
    for (const hash of manifest.hashes) {
      tags.push(["root-hash", `${hash.algorithm}:${hash.value}`]);
    }
  }

  if (manifest.dependencies) {
    for (const dependency of manifest.dependencies) {
      tags.push([
        "depends",
        `${dependency.gameId ?? manifest.gameId}.${dependency.slug}`,
        dependency.versionRange
      ]);
    }
  }

  if (manifest.compatibility?.gameVersionRange) {
    tags.push(["game-version-range", manifest.compatibility.gameVersionRange]);
  }

  return tags;
}

function decodeSecret(secret: string): Uint8Array {
  if (!secret.startsWith("nsec")) {
    throw new Error("Expected secret to be bech32 encoded nsec");
  }
  const decoded = nip19.decode(secret);
  if (decoded.type !== "nsec") {
    throw new Error(`Expected nsec bech32 string, received ${decoded.type}`);
  }
  return decoded.data as Uint8Array;
}

function decodePubkey(npub: string): string {
  if (!npub.startsWith("npub")) {
    throw new Error("Expected authorPubkey to be bech32 npub");
  }
  const decoded = nip19.decode(npub);
  if (decoded.type !== "npub") {
    throw new Error(`Expected npub bech32 string, received ${decoded.type}`);
  }
  return Buffer.from(decoded.data as Uint8Array).toString("hex");
}

function resolveAuthorTag(pubkeyHex: string, configuredPubkey?: string): string {
  if (configuredPubkey) {
    return configuredPubkey;
  }
  return nip19.npubEncode(pubkeyHex);
}

async function derivePubkey(secretKey: Uint8Array | undefined, configuredPubkey?: string): Promise<string> {
  if (configuredPubkey) {
    return decodePubkey(configuredPubkey);
  }
  if (!secretKey) {
    throw new Error("Unable to derive pubkey: provide --author-pubkey or --secret");
  }
  const { getPublicKey } = await import("nostr-tools");
  return getPublicKey(secretKey);
}

async function maybePublish(
  options: { dryRun?: boolean; relay?: string[] },
  event: UnsignedEvent | Event,
  config: OpenModsConfig
): Promise<void> {
  const dryRun = options.dryRun ?? true;
  if (dryRun) {
    logger.success("Prepared release event (dry-run only).");
    return;
  }

  if (!("id" in event) || !("sig" in event)) {
    throw new Error("Cannot publish unsigned release event; provide --secret or OPENMODS_NSEC.");
  }

  const signedEvent = event as Event;
  const relays = options.relay && options.relay.length ? options.relay : config.relays;
  if (!relays.length) {
    logger.warn("No relays configured; skipping publish.");
    return;
  }

  const publisher = new RelayPublisher();
  const results = await publisher.publish(signedEvent, { relays });
  await publisher.close();

  const successes = results.filter((result) => result.status === "ok").length;
  const failures = results.length - successes;
  if (successes) {
    logger.success(`Published release event ${signedEvent.id} to ${successes} relay(s).`);
  }
  if (failures) {
    logger.warn(`Failed to publish to ${failures} relay(s). See logs for details.`);
    results
      .filter((result) => result.status === "error")
      .forEach((result) => logger.warn(`  - ${result.relay}: ${String(result.error)}`));
  }
}
