import { promises as fs } from "fs";
import { basename, resolve } from "path";
import createTorrent from "create-torrent";
import parseTorrent, { type ParsedTorrent, toMagnetURI } from "parse-torrent";

export interface CreateTorrentOptions {
  announce?: string[];
  comment?: string;
  webSeeds?: string[];
  pieceLength?: number;
}

export interface CreateTorrentResult {
  torrentPath: string;
  infoHash: string;
  magnetURI: string;
  size: number;
}

export class TorrentService {
  async createTorrent(
    inputPath: string,
    outputDir: string,
    options: CreateTorrentOptions = {}
  ): Promise<CreateTorrentResult> {
    const absoluteInput = resolve(process.cwd(), inputPath);
    const stats = await fs.stat(absoluteInput);
    if (!stats.isFile()) {
      throw new Error(`Torrent input must be a file: ${inputPath}`);
    }

    await fs.mkdir(outputDir, { recursive: true });

    const torrentBuffer = await new Promise<Buffer>((resolveBuffer, reject) => {
      createTorrent(
        absoluteInput,
        {
          announceList: buildAnnounceList(options.announce),
          urlList: normalizeArray(options.webSeeds),
          comment: options.comment,
          pieceLength: options.pieceLength
        },
        (error, torrent) => {
          if (error) {
            reject(error);
            return;
          }
          if (!torrent) {
            reject(new Error("Failed to build torrent buffer"));
            return;
          }
          resolveBuffer(Buffer.isBuffer(torrent) ? torrent : Buffer.from(torrent));
        }
      );
    });

    const parsed = await parseTorrent(torrentBuffer);
    const torrentFileName = `${basename(absoluteInput)}.torrent`;
    const torrentPath = resolve(outputDir, torrentFileName);
    await fs.writeFile(torrentPath, torrentBuffer);

    const magnetURI = toMagnetURI(parsed);
    const infoHashHex = resolveInfoHash(parsed) ?? extractInfoHashFromMagnet(magnetURI);
    if (!infoHashHex) {
      throw new Error("Unable to derive info hash from generated torrent");
    }

    return {
      torrentPath,
      infoHash: infoHashHex,
      magnetURI,
      size: typeof parsed.length === "number" ? parsed.length : stats.size
    };
  }
}

function normalizeArray<T>(value: T[] | undefined): T[] | undefined {
  if (!value || value.length === 0) {
    return undefined;
  }
  return value;
}

function buildAnnounceList(trackers: string[] | undefined): string[][] | undefined {
  if (!trackers || trackers.length === 0) {
    return undefined;
  }
  return [trackers];
}

function resolveInfoHash(parsed: ParsedTorrent): string | undefined {
  const candidate = parsed.infoHash;
  if (typeof candidate === "string") {
    return candidate;
  }
  if (candidate && Buffer.isBuffer(candidate)) {
    return candidate.toString("hex");
  }
  if (parsed.infoHashBuffer && Buffer.isBuffer(parsed.infoHashBuffer)) {
    return parsed.infoHashBuffer.toString("hex");
  }
  return undefined;
}

function extractInfoHashFromMagnet(uri: string): string | undefined {
  if (!uri.startsWith("magnet:?")) {
    return undefined;
  }

  const query = uri.slice("magnet:?".length);
  for (const part of query.split("&")) {
    const [rawKey, rawValue] = part.split("=");
    if (rawKey !== "xt" || !rawValue) continue;
    const value = decodeURIComponent(rawValue);
    if (value.startsWith("urn:btih:")) {
      return value.slice("urn:btih:".length).toLowerCase();
    }
    if (value.startsWith("urn:btmh:")) {
      return value.slice("urn:btmh:".length).toLowerCase();
    }
  }

  return undefined;
}
