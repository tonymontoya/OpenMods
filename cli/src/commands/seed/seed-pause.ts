import { Command } from "commander";
import { logger } from "../../utils/logger.js";
import { changeTorrentState } from "../../services/seed-client-service.js";

export function buildSeedPauseCommand(): Command {
  const command = new Command("pause");

  command
    .description("Pause torrents on remote clients")
    .argument("<infohash>", "Torrent info hash")
    .option("--transmission-url <url>")
    .option("--transmission-user <name>")
    .option("--transmission-password <password>")
    .option("--qbittorrent-url <url>")
    .option("--qbittorrent-user <name>")
    .option("--qbittorrent-password <password>")
    .option("--deluge-url <url>")
    .option("--deluge-password <password>")
    .action(async (infoHash, options) => {
      try {
        const result = await changeTorrentState("pause", infoHash, {
          transmissionUrl: options.transmissionUrl,
          transmissionUser: options.transmissionUser,
          transmissionPassword: options.transmissionPassword,
          qbittorrentUrl: options.qbittorrentUrl,
          qbittorrentUser: options.qbittorrentUser,
          qbittorrentPassword: options.qbittorrentPassword,
          delugeUrl: options.delugeUrl,
          delugePassword: options.delugePassword
        });

        if (result.length === 0) {
          logger.warn("No clients configured; nothing to pause.");
          return;
        }

        result.forEach((entry) => {
          if (entry.ok) {
            logger.success(`Paused torrent on ${entry.client}`);
          } else {
            logger.warn(`Failed to pause torrent on ${entry.client}: ${entry.error}`);
          }
        });
      } catch (error) {
        logger.error("Failed to pause torrent", error);
        process.exitCode = 1;
      }
    });

  return command;
}
