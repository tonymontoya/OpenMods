import { promises as fs } from "fs";
import { dirname, resolve } from "path";
import { createHash } from "crypto";
import { Command } from "commander";
import { finalizeEvent, getPublicKey, nip19, type Event, type UnsignedEvent } from "nostr-tools";
import { logger } from "../../utils/logger.js";
import { ConfigService } from "../../services/config-service.js";
import { resolveLnurlPayData, type LnurlPayData } from "../../services/lnurl-service.js";
import { getFetch } from "../../services/http-client.js";

export function buildZapSimulateCommand(): Command {
  const command = new Command("simulate");

  command
    .description("Generate a zap request (kind 9734) and optional signed event for testing")
    .option("--release-event <file>", "Path to release event JSON", "artifacts/release/event-30079.json")
    .option("--amount <sats>", "Zap amount in sats", (value) => Number.parseInt(value, 10), 100)
    .option("--lnurl <lnurl>", "Override LNURL for zap target")
    .option("--lnurl-metadata <file>", "Supply LNURL metadata JSON to avoid network fetch")
    .option("--message <text>", "Optional zap note message", "")
    .option("--relays <url...>", "Relay hints for zap request")
    .option("--secret <nsec>", "Sign zap request with a local key (defaults to OPENMODS_NSEC)")
    .option("--pubkey <npub>", "Override zapper pubkey (npub) when not signing locally")
    .option("--receipt-secret <nsec>", "Sign zap receipt with receiver key (defaults to OPENMODS_ZAP_RECEIVER_NSEC)")
    .option("--receiver <npub>", "Receiver npub (defaults to config author)")
    .option("--receipt-out <file>", "Output path for zap receipt event", "artifacts/zap/receipt-9735.json")
    .option("--out <file>", "Output path for zap request event", "artifacts/zap/request-9734.json")
    .option("--invoke-callback", "Hit the LNURL callback endpoint and log the returned invoice")
    .option("--summary", "Print a summary of the zap request")
    .action(async (options) => {
      try {
        const configService = new ConfigService(process.cwd());
        const configExists = await configService.exists();
        const config = configExists ? await configService.load() : undefined;

        const releaseEvent = await loadReleaseEvent(options.releaseEvent);
        const lnurlValue = options.lnurl ?? config?.zap?.lnurl;
        if (!lnurlValue) {
          throw new Error("LNURL is required; pass --lnurl or configure zap.lnurl in openmods.json");
        }

        const relays = options.relays?.length ? options.relays : config?.relays ?? [];
        if (Number.isNaN(options.amount) || options.amount <= 0) {
          throw new Error("--amount must be a positive integer");
        }
        const millisats = BigInt(options.amount) * 1000n;

        const lnurlData = await resolveLnurlPayData(lnurlValue, {
          amountMsat: millisats,
          metadataPath: options.lnurlMetadata,
          fetchEnabled: !options.lnurlMetadata
        });

        validateLnurlMetadata(lnurlData, releaseEvent, options.amount);

        const zapPubkeyHex = deriveZapperPubkeyHex(options.secret, options.pubkey);

        const contextToken = buildZapContext({
          releaseEvent,
          lnurl: lnurlData.resolvedUrl,
          callback: lnurlData.callback,
          metadata: lnurlData.metadata,
          relays,
          millisats: millisats.toString(),
          zapperPubkey: zapPubkeyHex
        });

        const zapRequest = buildZapRequest(contextToken, options.message ?? "");

        const secret = options.secret ?? process.env.OPENMODS_NSEC;
        const signedEvent = secret ? finalizeEvent(zapRequest, decodeSecret(secret)) : zapRequest;

        const outPath = resolve(process.cwd(), options.out);
        await fs.mkdir(dirname(outPath), { recursive: true });
        await fs.writeFile(outPath, JSON.stringify(signedEvent, null, 2) + "\n", "utf-8");

        if (options.summary) {
          logZapSummary(signedEvent, options.amount, lnurlData, relays, contextToken);
        }

        const callbackResult = options.invokeCallback
          ? await invokeLnurlCallback(lnurlData, millisats, signedEvent)
          : undefined;

        await maybeWriteReceipt({
          zapRequest: signedEvent,
          releaseEvent,
          config,
          options,
          lnurlData,
          amount: options.amount,
          zapContext: contextToken,
          invoice: callbackResult?.invoice
        });

        logger.success(`Zap request saved to ${outPath}`);
      } catch (error) {
        logger.error("Failed to simulate zap", error);
        process.exitCode = 1;
      }
    });

  return command;
}

interface ZapContext {
  releaseEvent: Event;
  lnurl: string;
  callback?: string;
  metadata: string;
  relays: string[];
  millisats: string;
  zapperPubkey: string;
  descriptionHash: string;
}

function buildZapContext(args: {
  releaseEvent: Event;
  lnurl: string;
  callback?: string;
  metadata: string;
  relays: string[];
  millisats: string;
  zapperPubkey: string;
}): ZapContext {
  const hash = createHash("sha256").update(args.metadata).digest("hex");

  return {
    releaseEvent: args.releaseEvent,
    lnurl: args.lnurl,
    callback: args.callback,
    metadata: args.metadata,
    relays: args.relays,
    millisats: args.millisats,
    zapperPubkey: args.zapperPubkey,
    descriptionHash: hash
  };
}

function buildZapRequest(context: ZapContext, message: string): UnsignedEvent {
  const now = Math.floor(Date.now() / 1000);
  const releaseIdentifier = extractReleaseIdentifier(context.releaseEvent);
  const tags: string[][] = [
    ["relays", ...context.relays],
    ["amount", context.millisats],
    ["lnurl", context.lnurl],
    ["description", context.descriptionHash],
    ["p", context.releaseEvent.pubkey],
    ["e", context.releaseEvent.id],
    ["a", releaseIdentifier]
  ];

  if (message) {
    tags.push(["zap-name", message]);
  }

  return {
    kind: 9734,
    created_at: now,
    content: message,
    tags,
    pubkey: context.zapperPubkey
  } satisfies UnsignedEvent;
}

function extractReleaseIdentifier(event: Event): string {
  const dTag = event.tags.find((tag) => tag[0] === "d");
  if (!dTag) {
    throw new Error("Release event missing deterministic 'd' tag");
  }
  return `30079:${event.pubkey}:${dTag[1]}`;
}

async function loadReleaseEvent(path: string): Promise<Event> {
  const absolute = resolve(process.cwd(), path);
  const raw = await fs.readFile(absolute, "utf-8");
  const event = JSON.parse(raw);
  if (event.kind !== 30079) {
    throw new Error(`Expected release event (kind 30079), received kind ${event.kind}`);
  }
  return event as Event;
}

function decodeSecret(nsec: string): Uint8Array {
  if (!nsec.startsWith("nsec")) {
    throw new Error("Secret must be bech32 nsec");
  }
  const decoded = nip19.decode(nsec);
  if (decoded.type !== "nsec") {
    throw new Error(`Expected nsec, received ${decoded.type}`);
  }
  return decoded.data;
}

function deriveZapperPubkeyHex(secret: string | undefined, overrideNpub?: string): string {
  if (secret) {
    const secretKey = decodeSecret(secret);
    return getPublicKey(secretKey);
  }
  if (!overrideNpub) {
    throw new Error("Provide --secret or --pubkey to define zapper identity");
  }
  const decoded = nip19.decode(overrideNpub);
  if (decoded.type !== "npub") {
    throw new Error(`Expected npub, received ${decoded.type}`);
  }
  return decoded.data;
}

function logZapSummary(
  event: UnsignedEvent | Event,
  amount: number,
  lnurlData: LnurlPayData,
  relays: string[],
  context: ZapContext
): void {
  logger.info(`Zap amount: ${amount} sats`);
  logger.info(`LNURL: ${lnurlData.original}`);
  if (lnurlData.callback) {
    logger.info(`Callback: ${lnurlData.callback}`);
  }
  if (lnurlData.allowsNostr !== undefined) {
    logger.info(`LNURL allows nostr: ${lnurlData.allowsNostr ? "yes" : "no"}`);
  }
  if (lnurlData.nostrPubkey) {
    logger.info(`LNURL nostr pubkey: ${lnurlData.nostrPubkey}`);
  }
  if (relays.length) {
    logger.info(`Target relays: ${relays.join(", ")}`);
  }
  logger.info(`Description hash: ${context.descriptionHash}`);
  const aTag = event.tags.find((tag) => tag[0] === "a")?.[1] ?? "unknown";
  logger.info(`Target release: ${aTag}`);
  if ("id" in event) {
    logger.info(`Event id: ${event.id}`);
  } else {
    logger.info("Event unsigned; forward to delegated signer to complete.");
  }
}

interface ReceiptContext {
  zapRequest: UnsignedEvent | Event;
  releaseEvent: Event;
  config?: Awaited<ReturnType<ConfigService["load"]>>;
  options: Record<string, any>;
  lnurlData: LnurlPayData;
  amount: number;
  zapContext: ZapContext;
  invoice?: string;
}

async function maybeWriteReceipt(context: ReceiptContext): Promise<void> {
  const receiptOut = context.options.receiptOut as string | undefined;
  if (!receiptOut) {
    return;
  }

  const receiverNpub = context.options.receiver ?? context.config?.authorPubkey;
  if (!receiverNpub) {
    logger.warn("Skipping receipt generation: receiver npub not supplied");
    return;
  }

  const receiverHex = decodeNpub(receiverNpub);
  const receiptSecret = context.options.receiptSecret ?? process.env.OPENMODS_ZAP_RECEIVER_NSEC;

  const zapRequestId = "id" in context.zapRequest ? context.zapRequest.id : undefined;
  const tags: string[][] = [];
  tags.push(["p", context.zapRequest.pubkey]);
  tags.push(["a", context.zapRequest.tags.find((tag) => tag[0] === "a")?.[1] ?? extractReleaseIdentifier(context.releaseEvent)]);
  tags.push(["description", context.zapContext.descriptionHash]);
  if (context.lnurlData.callback) {
    tags.push(["callback", context.lnurlData.callback]);
  }
  tags.push(["lnurl", context.lnurlData.resolvedUrl]);
  const invoice = context.invoice ?? buildSimulatedInvoice(context.amount, context.lnurlData);
  tags.push(["bolt11", invoice]);
  if (zapRequestId) {
    tags.push(["e", zapRequestId]);
  }

  const unsigned: UnsignedEvent = {
    kind: 9735,
    created_at: Math.floor(Date.now() / 1000),
    content: `Zap receipt for ${context.amount} sats (simulated)`,
    tags,
    pubkey: receiverHex
  };

  const receipt = receiptSecret ? finalizeEvent(unsigned, decodeSecret(receiptSecret)) : unsigned;

  const outPath = resolve(process.cwd(), receiptOut);
  await fs.mkdir(dirname(outPath), { recursive: true });
  await fs.writeFile(outPath, JSON.stringify(receipt, null, 2) + "\n", "utf-8");
}

function decodeNpub(npub: string): string {
  const decoded = nip19.decode(npub);
  if (decoded.type !== "npub") {
    throw new Error(`Expected npub, received ${decoded.type}`);
  }
  return decoded.data;
}

function buildSimulatedInvoice(amount: number, lnurlData: LnurlPayData): string {
  const padded = amount.toString().padStart(8, "0");
  let host = "openmods";
  try {
    if (lnurlData.callback) {
      host = new URL(lnurlData.callback).host.replace(/[^a-z0-9]/gi, "").slice(0, 10) || host;
    }
  } catch (_error) {
    // ignore parse errors
  }
  return `lnbc${padded}0n1p${host}${padded}`;
}

interface LnurlCallbackResult {
  invoice?: string;
  raw?: unknown;
}

function formatMsatToSatString(msat: bigint): string {
  return (msat / 1000n).toString();
}

async function invokeLnurlCallback(
  lnurlData: LnurlPayData,
  amountMsat: bigint,
  zapEvent: UnsignedEvent | Event
): Promise<LnurlCallbackResult | undefined> {
  if (!lnurlData.callback) {
    logger.warn("LNURL callback URL missing; skipping invocation.");
    return undefined;
  }

  try {
    const fetch = await getFetch();
    const url = new URL(lnurlData.callback);
    url.searchParams.set("amount", amountMsat.toString());

    if ("id" in zapEvent) {
      url.searchParams.set("nostr", JSON.stringify(zapEvent));
    } else {
      logger.warn("Zap event unsigned; invoking callback without nostr payload.");
    }

    const response = await fetch(url.toString());
    if (!response.ok) {
      throw new Error(`Callback returned ${response.status}`);
    }

    const payload = await response.json();
    const invoice: string | undefined = payload.pr ?? payload.invoice;
    if (invoice) {
      logger.info("LNURL callback returned invoice.");
      return { invoice, raw: payload };
    }

    logger.warn("LNURL callback succeeded but did not include an invoice; using simulated value.");
    return { raw: payload };
  } catch (error) {
    logger.warn(`Failed to invoke LNURL callback: ${String(error)}`);
    return undefined;
  }
}
function validateLnurlMetadata(lnurlData: LnurlPayData, releaseEvent: Event, amount: number): void {
  try {
    const metadata = JSON.parse(lnurlData.metadata) as Array<[string, string]>;
    const textEntries = metadata.filter(([type]) => type === "text/plain").map(([, value]) => value);
    const releaseSlug = releaseEvent.tags.find((tag) => tag[0] === "a")?.[1] ?? "";
    if (!textEntries.some((entry) => entry.includes(releaseSlug))) {
      logger.warn(
        "LNURL metadata does not reference release slug; ensure callback validates zap target."
      );
    }
  } catch (_error) {
    logger.warn("Unable to parse LNURL metadata; continuing with default hash.");
  }

  if (lnurlData.allowsNostr === false) {
    logger.warn("LNURL metadata reports nostr support disabled; verify relay acceptance.");
  }

  const zapMsat = BigInt(amount) * 1000n;
  if (lnurlData.minSendable && zapMsat < lnurlData.minSendable) {
    throw new Error(
      `Amount ${amount} sats is below LNURL minimum ${formatMsatToSatString(lnurlData.minSendable)} sats`
    );
  }
  if (lnurlData.maxSendable && zapMsat > lnurlData.maxSendable) {
    throw new Error(
      `Amount ${amount} sats exceeds LNURL maximum ${formatMsatToSatString(lnurlData.maxSendable)} sats`
    );
  }
}
