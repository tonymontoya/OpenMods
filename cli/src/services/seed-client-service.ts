import { basename } from "path";
import { promises as fs } from "fs";
import { getFetch } from "./http-client.js";

export interface ClientOptions {
  transmissionUrl?: string;
  transmissionUser?: string;
  transmissionPassword?: string;
  qbittorrentUrl?: string;
  qbittorrentUser?: string;
  qbittorrentPassword?: string;
  delugeUrl?: string;
  delugePassword?: string;
}

export interface ClientResult {
  client: string;
  ok: boolean;
  error?: string;
}

export async function addTorrent(torrent: string, options: ClientOptions): Promise<ClientResult[]> {
  const tasks: Promise<ClientResult>[] = [];
  if (options.transmissionUrl) {
    tasks.push(addTransmission(torrent, options));
  }
  if (options.qbittorrentUrl) {
    tasks.push(addQBittorrent(torrent, options));
  }
  if (options.delugeUrl) {
    tasks.push(addDeluge(torrent, options));
  }
  return Promise.all(tasks);
}

export async function changeTorrentState(
  action: "pause" | "resume",
  infoHash: string,
  options: ClientOptions
): Promise<ClientResult[]> {
  const tasks: Promise<ClientResult>[] = [];
  if (options.transmissionUrl) {
    tasks.push(changeTransmissionState(action, infoHash, options));
  }
  if (options.qbittorrentUrl) {
    tasks.push(changeQBittorrentState(action, infoHash, options));
  }
  if (options.delugeUrl) {
    tasks.push(changeDelugeState(action, infoHash, options));
  }
  return Promise.all(tasks);
}

async function addTransmission(torrent: string, options: ClientOptions): Promise<ClientResult> {
  try {
    const fetch = await getFetch();
    const sessionHeaders = await getTransmissionHeaders(options, fetch);
    const requestBody = await buildTransmissionAddBody(torrent);
    const response = await fetch(options.transmissionUrl!, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...sessionHeaders.headers
      },
      body: JSON.stringify({
        method: "torrent-add",
        arguments: requestBody
      })
    });

    if (response.status === 409) {
      const sessionId = response.headers.get("x-transmission-session-id");
      if (!sessionId) throw new Error("Missing Transmission session id");
      sessionHeaders.headers["X-Transmission-Session-Id"] = sessionId;
      return addTransmission(torrent, options);
    }

    if (!response.ok) {
      throw new Error(`Transmission responded with ${response.status}`);
    }

    return { client: "transmission", ok: true };
  } catch (error) {
    return { client: "transmission", ok: false, error: toMessage(error) };
  }
}

async function getTransmissionHeaders(options: ClientOptions, fetch: typeof globalThis.fetch) {
  const headers: Record<string, string> = {};
  if (options.transmissionUser && options.transmissionPassword) {
    const token = Buffer.from(
      `${options.transmissionUser}:${options.transmissionPassword}`
    ).toString("base64");
    headers.Authorization = `Basic ${token}`;
  }
  return { headers };
}

async function buildTransmissionAddBody(torrent: string): Promise<Record<string, unknown>> {
  if (torrent.startsWith("magnet:")) {
    return { filename: torrent };
  }
  const buffer = await fs.readFile(torrent);
  const encoded = buffer.toString("base64");
  return { metainfo: encoded };
}

async function changeTransmissionState(
  action: "pause" | "resume",
  infoHash: string,
  options: ClientOptions
): Promise<ClientResult> {
  try {
    const fetch = await getFetch();
    const headers = await getTransmissionHeaders(options, fetch);
    const response = await fetch(options.transmissionUrl!, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...headers.headers
      },
      body: JSON.stringify({
        method: action === "pause" ? "torrent-stop" : "torrent-start",
        arguments: {
          ids: [infoHash]
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Transmission responded with ${response.status}`);
    }

    return { client: "transmission", ok: true };
  } catch (error) {
    return { client: "transmission", ok: false, error: toMessage(error) };
  }
}

async function addQBittorrent(torrent: string, options: ClientOptions): Promise<ClientResult> {
  try {
    const fetch = await getFetch();
    const cookie = options.qbittorrentUser
      ? await qbittorrentLogin(options, fetch)
      : undefined;
    const headers: Record<string, string> = {};
    if (cookie) headers.Cookie = cookie;

    const url = new URL("/api/v2/torrents/add", options.qbittorrentUrl);
    let body: BodyInit;
    let contentType: string;
    if (torrent.startsWith("magnet:")) {
      body = new URLSearchParams({ urls: torrent });
      contentType = "application/x-www-form-urlencoded";
    } else {
      const file = await fs.readFile(torrent);
      const form = new FormData();
      form.append("torrents", new Blob([file]), basename(torrent));
      body = form as any;
      contentType = (form as any).getHeaders?.()["content-type"] ?? undefined;
    }

    const response = await fetch(url, {
      method: "POST",
      headers: contentType ? { ...headers, "Content-Type": contentType } : headers,
      body
    });

    if (!response.ok) {
      throw new Error(`qBittorrent responded with ${response.status}`);
    }

    return { client: "qbittorrent", ok: true };
  } catch (error) {
    return { client: "qbittorrent", ok: false, error: toMessage(error) };
  }
}

async function changeQBittorrentState(
  action: "pause" | "resume",
  infoHash: string,
  options: ClientOptions
): Promise<ClientResult> {
  try {
    const fetch = await getFetch();
    const cookie = options.qbittorrentUser
      ? await qbittorrentLogin(options, fetch)
      : undefined;
    const headers: Record<string, string> = {};
    if (cookie) headers.Cookie = cookie;

    const endpoint = action === "pause" ? "/api/v2/torrents/pause" : "/api/v2/torrents/resume";
    const url = new URL(endpoint, options.qbittorrentUrl);
    const response = await fetch(url, {
      method: "POST",
      headers: {
        ...headers,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: `hashes=${infoHash}`
    });

    if (!response.ok) {
      throw new Error(`qBittorrent responded with ${response.status}`);
    }

    return { client: "qbittorrent", ok: true };
  } catch (error) {
    return { client: "qbittorrent", ok: false, error: toMessage(error) };
  }
}

async function qbittorrentLogin(options: ClientOptions, fetch: typeof globalThis.fetch): Promise<string | undefined> {
  if (!options.qbittorrentUser || !options.qbittorrentPassword) {
    return undefined;
  }
  const url = new URL("/api/v2/auth/login", options.qbittorrentUrl);
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: `username=${encodeURIComponent(options.qbittorrentUser)}&password=${encodeURIComponent(options.qbittorrentPassword)}`
  });

  if (!response.ok) {
    throw new Error("qBittorrent authentication failed");
  }

  const cookie = response.headers.get("set-cookie");
  return cookie ?? undefined;
}

async function addDeluge(torrent: string, options: ClientOptions): Promise<ClientResult> {
  try {
    const fetch = await getFetch();
    const cookie = options.delugePassword ? await delugeLogin(options, fetch) : undefined;
    const headers: Record<string, string> = {
      "Content-Type": "application/json"
    };
    if (cookie) headers.Cookie = cookie;

    let params: any;
    if (torrent.startsWith("magnet:")) {
      params = [torrent, {}];
    } else {
      const file = await fs.readFile(torrent);
      params = [file.toString("base64"), { file: basename(torrent) }];
    }

    const response = await fetch(options.delugeUrl!, {
      method: "POST",
      headers,
      body: JSON.stringify({ method: "web.add_torrents", params: [[{ options: {}, ...buildDelugeAddParams(params) }]], id: 1 })
    });

    if (!response.ok) {
      throw new Error(`Deluge responded with ${response.status}`);
    }

    return { client: "deluge", ok: true };
  } catch (error) {
    return { client: "deluge", ok: false, error: toMessage(error) };
  }
}

function buildDelugeAddParams(params: any): Record<string, unknown> {
  if (Array.isArray(params)) {
    if (params[0].startsWith("magnet:")) {
      return { url: params[0], options: params[1] ?? {} };
    }
    return { filename: params[0], options: params[1] ?? {} };
  }
  return { url: params, options: {} };
}

async function changeDelugeState(
  action: "pause" | "resume",
  infoHash: string,
  options: ClientOptions
): Promise<ClientResult> {
  try {
    const fetch = await getFetch();
    const cookie = options.delugePassword ? await delugeLogin(options, fetch) : undefined;
    const headers: Record<string, string> = {
      "Content-Type": "application/json"
    };
    if (cookie) headers.Cookie = cookie;

    const method = action === "pause" ? "web.pause_torrent" : "web.resume_torrent";
    const response = await fetch(options.delugeUrl!, {
      method: "POST",
      headers,
      body: JSON.stringify({ method, params: [[infoHash]], id: 1 })
    });

    if (!response.ok) {
      throw new Error(`Deluge responded with ${response.status}`);
    }

    return { client: "deluge", ok: true };
  } catch (error) {
    return { client: "deluge", ok: false, error: toMessage(error) };
  }
}

async function delugeLogin(options: ClientOptions, fetch: typeof globalThis.fetch): Promise<string | undefined> {
  if (!options.delugePassword) {
    return undefined;
  }
  const response = await fetch(options.delugeUrl!, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ method: "auth.login", params: [options.delugePassword], id: 1 })
  });

  if (!response.ok) {
    throw new Error(`Deluge authentication failed (${response.status})`);
  }

  const cookie = response.headers.get("set-cookie");
  return cookie ?? undefined;
}

function toMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
