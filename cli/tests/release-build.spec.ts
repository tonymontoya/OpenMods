import { access, mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildInitCommand } from "../src/commands/init.js";
import { buildReleaseBuildCommand } from "../src/commands/release/release-build.js";

describe("release build command", () => {
  it("generates torrents when requested", async () => {
    const workdir = await mkdtemp(join(tmpdir(), "openmods-release-"));
    const originalCwd = process.cwd();
    process.chdir(workdir);

    try {
      const initCommand = buildInitCommand();
      initCommand.exitOverride(() => {
        throw new Error("Command attempted to exit");
      });
      await initCommand.parseAsync(["node", "openmods", "--slug", "test-mod"], { from: "user" });

      await mkdir("artifacts", { recursive: true });
      const artifactPath = "artifacts/sample.bin";
      await writeFile(artifactPath, Buffer.from("sample artifact content"));

      const releaseBuild = buildReleaseBuildCommand();
      releaseBuild.exitOverride(() => {
        throw new Error("Command attempted to exit");
      });
      await releaseBuild.parseAsync(
        [
          "node",
          "openmods",
          "--artifact",
          artifactPath,
          "--version",
          "1.0.0",
          "--generate-torrents",
          "--tracker",
          "udp://tracker.example.com:6969"
        ],
        { from: "user" }
      );

      const torrentPath = join("artifacts", "torrents", "sample.bin.torrent");
      await access(torrentPath);

      const manifestRaw = await readFile("artifacts/release/manifest.json", "utf-8");
      const manifest = JSON.parse(manifestRaw) as {
        artifacts: Array<{ uri: string; type: string }>;
      };

      const artifactUris = manifest.artifacts.map((artifact) => artifact.uri);
      expect(artifactUris).toContain("artifacts/sample.bin");
      expect(artifactUris).toContain("artifacts/torrents/sample.bin.torrent");

      const torrentEntry = manifest.artifacts.find(
        (artifact) => artifact.uri === "artifacts/torrents/sample.bin.torrent"
      );
      expect(torrentEntry?.type).toBe("torrent");
    } finally {
      process.chdir(originalCwd);
    }
  });
});
