import { Buffer } from "buffer";
import { promises as fs } from "fs";
import { dirname, resolve } from "path";
import { Command } from "commander";
import { finalizeEvent, nip19, type Event, type UnsignedEvent } from "nostr-tools";
import { logger } from "../../utils/logger.js";
import { ConfigService, type OpenModsConfig } from "../../services/config-service.js";
import {
  projectManifestSchema,
  type ProjectManifest
} from "../../services/project-manifest-service.js";
import { RelayPublisher } from "../../services/relay-publisher.js";
import { printProjectSummary } from "./project-inspect.js";

export function buildProjectPublishCommand(): Command {
  const command = new Command("publish");

  command
    .description("Publish the project definition (kind 30078)")
    .option("--manifest <file>", "Path to project manifest JSON", "project/project.json")
    .option(
      "--out <file>",
      "Where to write the prepared event",
      "project/event-30078.json"
    )
    .option("--secret <nsec>", "Nostr nsec for signing; falls back to OPENMODS_NSEC")
    .option("--dry-run", "Write event to disk without pushing to relays", true)
    .option("--summary", "Display a summary before writing the event")
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
          throw new Error(
            "openmods.json is missing authorPubkey; run `openmods init` with --author-pubkey"
          );
        }

        const manifestPath = resolve(process.cwd(), options.manifest);
        const manifest = await readManifest(manifestPath);
        if (options.summary) {
          printProjectSummary(manifest);
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
        logger.error("Failed to publish project definition", error);
        process.exitCode = 1;
      }
    });

  return command;
}

async function readManifest(filePath: string): Promise<ProjectManifest> {
  const raw = await fs.readFile(filePath, "utf-8");
  const json = JSON.parse(raw);
  return projectManifestSchema.parse(json);
}

function validateManifest(manifest: ProjectManifest, config: OpenModsConfig): void {
  if (manifest.slug !== config.projectSlug) {
    throw new Error(
      `Project manifest slug ${manifest.slug} does not match config ${config.projectSlug}`
    );
  }
  if (manifest.gameId !== config.gameId) {
    throw new Error(
      `Project manifest gameId ${manifest.gameId} does not match config ${config.gameId}`
    );
  }
}

interface PrepareEventArgs {
  manifest: ProjectManifest;
  config: OpenModsConfig;
  secret?: string;
  createdAt: number;
}

async function prepareEvent(args: PrepareEventArgs): Promise<UnsignedEvent | Event> {
  const secretKey = args.secret ? decodeSecret(args.secret) : undefined;
  const pubkeyHex = await derivePubkey(secretKey, args.config.authorPubkey);
  const tags = buildTags(args.manifest, args.config);
  const unsigned: UnsignedEvent = {
    kind: 30078,
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

function buildTags(manifest: ProjectManifest, config: OpenModsConfig): string[][] {
  const tags: string[][] = [];
  tags.push(["d", `${manifest.gameId}.${manifest.slug}`]);
  tags.push(["game", manifest.gameId]);
  tags.push(["slug", manifest.slug]);
  tags.push(["title", manifest.title]);
  tags.push(["summary", manifest.summary]);

  for (const relay of config.relays) {
    tags.push(["relay", relay]);
  }

  if (manifest.links.homepage) {
    tags.push(["link", "homepage", manifest.links.homepage]);
  }
  if (manifest.links.source) {
    tags.push(["link", "source", manifest.links.source]);
  }
  if (manifest.links.issues) {
    tags.push(["link", "issues", manifest.links.issues]);
  }
  if (manifest.links.support) {
    tags.push(["link", "support", manifest.links.support]);
  }

  for (const author of manifest.authors) {
    const authorTag: string[] = ["author", author.pubkey, author.role];
    if (author.displayName) {
      authorTag.push(author.displayName);
    }
    if (typeof author.zapSplit === "number") {
      authorTag.push(author.zapSplit.toString());
    }
    tags.push(authorTag);
  }

  if (manifest.categories) {
    for (const category of manifest.categories) {
      tags.push(["category", category]);
    }
  }

  if (manifest.tags) {
    for (const tag of manifest.tags) {
      tags.push(["t", tag]);
    }
  }

  if (manifest.contentWarnings) {
    for (const cw of manifest.contentWarnings) {
      tags.push(["cw", cw]);
    }
  }

  if (manifest.zapConfig?.lnurl) {
    tags.push(["zap", manifest.zapConfig.lnurl]);
  }
  if (manifest.zapConfig?.bolt12) {
    tags.push(["zap-bolt12", manifest.zapConfig.bolt12]);
  }

  if (manifest.license) {
    tags.push(["license", manifest.license]);
  }

  if (manifest.dependencies) {
    for (const dependency of manifest.dependencies) {
      tags.push([
        "depends",
        `${dependency.gameId ?? manifest.gameId}.${dependency.slug}`,
        dependency.versionRange ?? ""
      ]);
    }
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
    logger.success("Prepared project definition event (dry-run only).");
    return;
  }

  if (!("id" in event) || !("sig" in event)) {
    throw new Error("Cannot publish unsigned project definition event; provide --secret or OPENMODS_NSEC.");
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
    logger.success(`Published project definition event ${signedEvent.id} to ${successes} relay(s).`);
  }
  if (failures) {
    logger.warn(`Failed to publish to ${failures} relay(s). See logs for details.`);
    results
      .filter((result) => result.status === "error")
      .forEach((result) => logger.warn(`  - ${result.relay}: ${String(result.error)}`));
  }
}
