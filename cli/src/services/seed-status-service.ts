import { promises as fs } from "fs";
import { resolve } from "path";
import parseTorrent, { type ParsedTorrent, toMagnetURI } from "parse-torrent";
import { getFetch } from "./http-client.js";

interface TrackerStatus {
  url: string;
  health: "http" | "udp" | "unsupported" | "error";
  seeders?: number;
  leechers?: number;
  error?: string;
}

interface TransmissionStatus {
  seeding?: boolean;
  peersConnected?: number;
  uploadRatio?: number;
  error?: string;
}

interface QBittorrentStatus {
  state?: string;
  numSeeds?: number;
  numLeechs?: number;
  ratio?: number;
  error?: string;
}

interface DelugeStatus {
  connected?: boolean;
  seeds?: number;
  peers?: number;
  ratio?: number;
  error?: string;
}

export interface TorrentStatus {
  name?: string;
  infoHash: string;
  magnetURI: string;
  trackers: TrackerStatus[];
  aggregateSeeders?: number;
  aggregateLeechers?: number;
  transmission?: TransmissionStatus;
  qbittorrent?: QBittorrentStatus;
  deluge?: DelugeStatus;
}

export interface CheckTorrentStatusArgs {
  torrent: string;
  trackers?: string[];
  transmissionUrl?: string;
  transmissionUser?: string;
  transmissionPassword?: string;
  qbittorrentUrl?: string;
  qbittorrentUser?: string;
  qbittorrentPassword?: string;
  delugeUrl?: string;
  delugePassword?: string;
}

export async function checkTorrentStatus(args: CheckTorrentStatusArgs): Promise<TorrentStatus> {
  const parsed = await parseInput(args.torrent);
  const infoHashBuffer = resolveInfoHashBuffer(parsed);
  if (!infoHashBuffer) {
    throw new Error("Unable to resolve info hash for torrent status check");
  }
  const infoHashHex = infoHashBuffer.toString("hex");
  const magnetURI = toMagnetURI(parsed);
  const trackerSet = new Set<string>([...(parsed.announce ?? []), ...(args.trackers ?? [])]);
  const trackerResults = await probeTrackers([...trackerSet], infoHashBuffer);
  const aggregateSeeders = sumDefined(trackerResults.map((result) => result.seeders));
  const aggregateLeechers = sumDefined(trackerResults.map((result) => result.leechers));

  let transmission: TransmissionStatus | undefined;
  if (args.transmissionUrl) {
    transmission = await queryTransmission(
      args.transmissionUrl,
      infoHashHex,
      args.transmissionUser,
      args.transmissionPassword
    );
  }

  let qbittorrent: QBittorrentStatus | undefined;
  if (args.qbittorrentUrl) {
    qbittorrent = await queryQBittorrent(
      args.qbittorrentUrl,
      infoHashHex,
      args.qbittorrentUser,
      args.qbittorrentPassword
    );
  }

  let deluge: DelugeStatus | undefined;
  if (args.delugeUrl) {
    deluge = await queryDeluge(args.delugeUrl, infoHashHex, args.delugePassword);
  }

  return {
    name: parsed.name,
    infoHash: infoHashHex,
    magnetURI,
    trackers: trackerResults,
    aggregateSeeders,
    aggregateLeechers,
    transmission,
    qbittorrent,
    deluge
  };
}

async function parseInput(input: string): Promise<ParsedTorrent> {
  if (input.startsWith("magnet:?")) {
    return await parseTorrent(input);
  }
  const absolute = resolve(process.cwd(), input);
  const buffer = await fs.readFile(absolute);
  return await parseTorrent(buffer);
}

function resolveInfoHashBuffer(parsed: ParsedTorrent): Buffer | undefined {
  if (parsed.infoHash && Buffer.isBuffer(parsed.infoHash)) {
    return parsed.infoHash;
  }
  if (typeof parsed.infoHash === "string") {
    return Buffer.from(parsed.infoHash, "hex");
  }
  if (parsed.infoHashBuffer && Buffer.isBuffer(parsed.infoHashBuffer)) {
    return parsed.infoHashBuffer;
  }
  return undefined;
}

async function probeTrackers(
  trackers: string[],
  infoHash: Buffer
): Promise<TrackerStatus[]> {
  const scrapePromises = trackers.map((url) => scrapeTracker(url, infoHash));
  return Promise.all(scrapePromises);
}

async function scrapeTracker(url: string, infoHash: Buffer): Promise<TrackerStatus> {
  const normalized = url.trim();
  if (!normalized) {
    return { url, health: "unsupported", error: "Empty tracker URL" };
  }

  const scheme = normalized.split(":")[0];
  if (scheme !== "http" && scheme !== "https" && scheme !== "udp") {
    return { url: normalized, health: "unsupported" };
  }

  try {
    const module = await import("bittorrent-tracker");
    const Client = (module as any).default ?? module;
    const result: any = await new Promise((resolve, reject) => {
      Client.scrape({ announce: normalized, infoHash }, (err: Error | null, data: any) => {
        if (err) return reject(err);
        resolve(data);
      });
    });

    return {
      url: normalized,
      health: scheme === "udp" ? "udp" : "http",
      seeders: typeof result?.complete === "number" ? result.complete : undefined,
      leechers: typeof result?.incomplete === "number" ? result.incomplete : undefined
    };
  } catch (error) {
    return {
      url: normalized,
      health: "error",
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

async function queryTransmission(
  endpoint: string,
  infoHashHex: string,
  username?: string,
  password?: string
): Promise<TransmissionStatus> {
  try {
    const fetch = await getFetch();
    const body = {
      method: "torrent-get",
      arguments: {
        fields: ["hashString", "peersConnected", "seeding", "uploadRatio"],
        ids: [infoHashHex]
      }
    };
    const headers: Record<string, string> = {
      "Content-Type": "application/json"
    };
    if (username && password) {
      const token = Buffer.from(`${username}:${password}`).toString("base64");
      headers.Authorization = `Basic ${token}`;
    }

    let response = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(body)
    });

    if (response.status === 409) {
      const sessionId = response.headers.get("x-transmission-session-id");
      if (!sessionId) {
        throw new Error("Transmission session ID not provided");
      }
      headers["X-Transmission-Session-Id"] = sessionId;
      response = await fetch(endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify(body)
      });
    }

    if (!response.ok) {
      throw new Error(`Transmission RPC failed (${response.status})`);
    }

    const json = (await response.json()) as {
      arguments?: { torrents?: Array<Record<string, unknown>> };
    };
    const torrent = json.arguments?.torrents?.find(
      (entry) => typeof entry.hashString === "string" && entry.hashString === infoHashHex
    );

    if (!torrent) {
      return { error: "Torrent not found in Transmission" };
    }

    return {
      seeding: Boolean(torrent.seeding),
      peersConnected: Number(torrent.peersConnected ?? 0),
      uploadRatio: Number(torrent.uploadRatio ?? 0)
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

async function queryQBittorrent(
  baseUrl: string,
  infoHashHex: string,
  username?: string,
  password?: string
): Promise<QBittorrentStatus> {
  try {
    const fetch = await getFetch();
    const session = await qbittorrentLogin(baseUrl, username, password, fetch);
    const headers: Record<string, string> = {};
    if (session) {
      headers.Cookie = session;
    }
    const url = new URL("/api/v2/torrents/info", baseUrl);
    url.searchParams.set("hashes", infoHashHex);
    const response = await fetch(url, {
      method: "GET",
      headers
    });

    if (!response.ok) {
      throw new Error(`qBittorrent request failed (${response.status})`);
    }

    const torrents = (await response.json()) as Array<Record<string, unknown>>;
    const torrent = torrents.find((entry) => entry.hash === infoHashHex);
    if (!torrent) {
      return { error: "Torrent not found in qBittorrent" };
    }

    return {
      state: typeof torrent.state === "string" ? (torrent.state as string) : undefined,
      numSeeds: Number(torrent.num_seeds ?? torrent.numSeeds ?? 0),
      numLeechs: Number(torrent.num_leechs ?? torrent.numLeechs ?? 0),
      ratio: Number(torrent.ratio ?? 0)
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

async function qbittorrentLogin(
  baseUrl: string,
  username?: string,
  password?: string,
  fetchImpl?: (input: any, init?: any) => Promise<any>
): Promise<string | undefined> {
  if (!username || !password) {
    return undefined;
  }
  const fetch = fetchImpl ?? (await getFetch());
  const url = new URL("/api/v2/auth/login", baseUrl);
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: `username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`
  });

  if (!response.ok) {
    throw new Error(`qBittorrent auth failed (${response.status})`);
  }

  const cookie = response.headers.get("set-cookie");
  return cookie ?? undefined;
}

function sumDefined(values: Array<number | undefined>): number | undefined {
  const filtered = values.filter((value) => typeof value === "number") as number[];
  if (!filtered.length) return undefined;
  return filtered.reduce((sum, value) => sum + value, 0);
}

async function queryDeluge(
  baseUrl: string,
  infoHashHex: string,
  password?: string
): Promise<DelugeStatus> {
  try {
    const fetch = await getFetch();
    const authToken = password ? await delugeLogin(baseUrl, password, fetch) : undefined;

    const statusBody = {
      method: "web.get_torrent_status",
      params: [infoHashHex, ["state", "peers", "seeds", "ratio"]],
      id: 2
    };
    const headers: Record<string, string> = {
      "Content-Type": "application/json"
    };
    if (authToken) {
      headers.Cookie = authToken;
    }

    const response = await fetch(baseUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(statusBody)
    });

    if (!response.ok) {
      throw new Error(`Deluge request failed (${response.status})`);
    }

    const json = (await response.json()) as {
      result?: Record<string, unknown>;
      error?: unknown;
    };

    if (!json.result) {
      return { error: "Torrent not found in Deluge" };
    }

    return {
      connected: json.result.state === "Seeding" || json.result.state === "Downloading",
      seeds: Number(json.result.seeds ?? 0),
      peers: Number(json.result.peers ?? 0),
      ratio: Number(json.result.ratio ?? 0)
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

async function delugeLogin(
  baseUrl: string,
  password: string,
  fetchImpl: (input: any, init?: any) => Promise<any>
): Promise<string | undefined> {
  const body = {
    method: "auth.login",
    params: [password],
    id: 1
  };
  const response = await fetchImpl(baseUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    throw new Error(`Deluge auth failed (${response.status})`);
  }

  const cookie = response.headers.get("set-cookie");
  return cookie ?? undefined;
}
