declare module "diff" {
  export interface Change {
    value: string;
    count?: number;
    added?: boolean;
    removed?: boolean;
  }

  export function diffLines(oldStr: string, newStr: string): Change[];
}

declare module "parse-torrent" {
  interface ParsedTorrent {
    infoHash?: Buffer | string;
    infoHashBuffer?: Buffer;
    name?: string;
    announce?: string[];
    length?: number;
  }

  function parseTorrent(input: string | Buffer): ParsedTorrent | Promise<ParsedTorrent>;
  function toMagnetURI(parsed: ParsedTorrent): string;

  export { ParsedTorrent, toMagnetURI };
  export default parseTorrent;
}

declare module "bittorrent-tracker" {
  interface ScrapeOptions {
    announce: string | string[];
    infoHash: Buffer | string;
  }

  interface ScrapeData {
    complete?: number;
    incomplete?: number;
  }

  type ScrapeCallback = (err: Error | null, data?: ScrapeData) => void;

  function scrape(options: ScrapeOptions, callback: ScrapeCallback): void;

  const tracker: {
    scrape: typeof scrape;
  };

  export { scrape };
  export default tracker;
}
