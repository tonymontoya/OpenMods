import { promises as fs } from "fs";
import { dirname, resolve, relative } from "path";
import { Command } from "commander";
import { logger } from "../../utils/logger.js";
import { ConfigService } from "../../services/config-service.js";
import { buildReleaseManifest } from "../../services/release-service.js";
import { TorrentService } from "../../services/torrent-service.js";

export function buildReleaseBuildCommand(): Command {
  const command = new Command("build");

  command
    .description("Generate a release manifest with hashes for the supplied artifacts")
    .option(
      "--artifact <file...>",
      "Relative path(s) to release artifacts (archives, torrents, magnets, etc.)."
    )
    .option(
      "--generate-torrents",
      "Generate torrent metadata for each local file artifact before hashing."
    )
    .option(
      "--torrent-dir <path>",
      "Directory where generated torrents are written (defaults to openmods.json release.torrentsDir)."
    )
    .option("--tracker <url...>", "Tracker announce URLs to embed in generated torrents.")
    .option("--torrent-comment <text>", "Optional comment stored in generated torrents.")
    .option(
      "--notes <file>",
      "Markdown file describing release notes; defaults to artifacts/changelog.md",
      "artifacts/changelog.md"
    )
    .option(
      "--version <semver>",
      "Release version; must match semantic versioning.",
      "0.0.1"
    )
    .option(
      "--display-version <value>",
      "Optional display version (defaults to --version)",
      undefined
    )
    .option(
      "--out <file>",
      "Output manifest JSON path",
      "artifacts/release/manifest.json"
    )
    .action(async (options) => {
      try {
        const configService = new ConfigService(process.cwd());
        const config = await configService.load();

        const artifactPaths = [...(options.artifact ?? [])];
        if (!artifactPaths.length) {
          throw new Error("At least one --artifact must be provided");
        }

        const generateTorrents = Boolean(options.generateTorrents);
        if (generateTorrents) {
          const torrentDir = resolve(
            process.cwd(),
            options.torrentDir ?? config.release.torrentsDir
          );
          const torrentService = new TorrentService();
          const eligibleArtifacts = artifactPaths.filter((artifactPath) =>
            isLocalFileArtifact(artifactPath)
          );
          if (!eligibleArtifacts.length) {
            logger.warn("No eligible file artifacts found for torrent generation.");
          } else {
            const announceList: string[] = options.tracker ?? [];
            const generatedPaths: string[] = [];
            for (const artifactPath of eligibleArtifacts) {
              try {
                const result = await torrentService.createTorrent(artifactPath, torrentDir, {
                  announce: announceList,
                  comment: options.torrentComment
                });
                const relativePath = relative(process.cwd(), result.torrentPath) || result.torrentPath;
                if (!artifactPaths.includes(relativePath)) {
                  artifactPaths.push(relativePath);
                  generatedPaths.push(relativePath);
                }
                logger.info(
                  `Generated torrent ${relativePath} (infoHash ${result.infoHash.slice(0, 12)}…)`
                );
              } catch (error) {
                logger.warn(
                  `Failed to generate torrent for ${artifactPath}: ${
                    error instanceof Error ? error.message : String(error)
                  }`
                );
              }
            }
            if (!generatedPaths.length) {
              logger.warn("Torrent generation completed without producing new files.");
            }
          }
        }

        const manifestPath = resolve(process.cwd(), options.out);
        await fs.mkdir(dirname(manifestPath), { recursive: true });

        const manifest = await buildReleaseManifest({
          slug: config.projectSlug,
          gameId: config.gameId,
          version: options.version,
          displayVersion: options.displayVersion,
          artifactPaths,
          notesPath: options.notes
        });

        await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2) + "\n", "utf-8");
        logger.success(`Release manifest written to ${manifestPath}`);
      } catch (error) {
        logger.error("Failed to build release manifest", error);
        process.exitCode = 1;
      }
    });

  return command;
}

interface BuildManifestArgs {
  slug: string;
  gameId: string;
  version: string;
  displayVersion?: string;
  artifactPaths: string[];
  notesPath: string;
}

function isLocalFileArtifact(path: string): boolean {
  const normalized = path.toLowerCase();
  if (normalized.startsWith("magnet:?")) return false;
  if (normalized.startsWith("http://") || normalized.startsWith("https://")) return false;
  if (normalized.startsWith("ipfs://")) return false;
  if (normalized.endsWith(".torrent")) return false;
  return true;
}
