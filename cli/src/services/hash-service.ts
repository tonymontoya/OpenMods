import { createHash } from "crypto";
import { promises as fs } from "fs";

export type FileHash = {
  algorithm: "sha256";
  value: string;
};

export async function hashFileSha256(path: string): Promise<FileHash> {
  const hash = createHash("sha256");
  const buffer = await fs.readFile(path);
  hash.update(buffer);
  return { algorithm: "sha256", value: hash.digest("hex") };
}

export function aggregateRootHash(hashes: FileHash[]): FileHash | undefined {
  if (!hashes.length) return undefined;
  const concatenated = hashes.map((hash) => hash.value).join("");
  const digest = createHash("sha256").update(concatenated).digest("hex");
  return { algorithm: "sha256", value: digest };
}
