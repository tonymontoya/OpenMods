import { promises as fs } from "fs";
import { decode as bech32Decode, fromWords } from "bech32";
import { getFetch } from "./http-client.js";

export interface LnurlPayData {
  original: string;
  resolvedUrl: string;
  callback?: string;
  metadata: string;
  minSendable?: bigint;
  maxSendable?: bigint;
  allowsNostr?: boolean;
  nostrPubkey?: string;
}

interface ResolveLnurlOptions {
  amountMsat: bigint;
  metadataPath?: string;
  fetchEnabled?: boolean;
}

export async function resolveLnurlPayData(value: string, options: ResolveLnurlOptions): Promise<LnurlPayData> {
  const resolvedUrl = await normalizeLnurl(value);

  let metadata: string | undefined;
  let callback: string | undefined;
  let allowsNostr: boolean | undefined;
  let nostrPubkey: string | undefined;
  let minSendable: bigint | undefined;
  let maxSendable: bigint | undefined;

  if (options.metadataPath) {
    metadata = await fs.readFile(options.metadataPath, "utf-8");
  }

  if (!metadata && options.fetchEnabled !== false) {
    try {
      const fetch = await getFetch();
      const response = await fetch(resolvedUrl.toString());
      if (response.ok) {
        const payload = await response.json();
        metadata = payload.metadata ?? metadata;
        callback = payload.callback ?? callback;
        allowsNostr = payload.allowsNostr ?? payload.nostr;
        nostrPubkey = payload.nostrPubkey ?? payload.nostrPubkey;
        if (payload.minSendable !== undefined) {
          minSendable = BigInt(payload.minSendable);
        }
        if (payload.maxSendable !== undefined) {
          maxSendable = BigInt(payload.maxSendable);
        }
      }
    } catch (error) {
      // swallow fetch errors; fallback to defaults below
    }
  }

  if (!metadata) {
    const defaultMetadata = [["text/plain", "OpenMods zap request"]];
    metadata = JSON.stringify(defaultMetadata);
  }

  if (!callback) {
    callback = new URL("/lnurl/callback", resolvedUrl).toString();
  }

  return {
    original: value,
    resolvedUrl: resolvedUrl.toString(),
    callback,
    metadata,
    minSendable,
    maxSendable,
    allowsNostr,
    nostrPubkey
  };
}

async function normalizeLnurl(value: string): Promise<URL> {
  if (value.includes("@")) {
    const [name, domain] = value.split("@");
    if (!name || !domain) {
      throw new Error("Invalid lightning address format");
    }
    return new URL(`https://${domain}/.well-known/lnurlp/${name}`);
  }

  if (value.toLowerCase().startsWith("lnurl")) {
    const decoded = decodeLnurl(value);
    return new URL(decoded);
  }

  return new URL(value);
}

function decodeLnurl(lnurl: string): string {
  const { words } = bech32Decode(lnurl.toLowerCase(), 2000);
  const data = Buffer.from(fromWords(words));
  return data.toString("utf-8");
}
