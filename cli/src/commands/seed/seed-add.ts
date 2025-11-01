import { Command } from "commander";
import { logger } from "../../utils/logger.js";
import { addTorrent } from "../../services/seed-client-service.js";

export function buildSeedAddCommand(): Command {
  const command = new Command("add");

  command
    .description("Add a torrent/magnet to remote clients")
    .argument("<torrent>", "Path to .torrent file or magnet URI")
    .option("--transmission-url <url>", "Transmission RPC endpoint")
    .option("--transmission-user <name>")
    .option("--transmission-password <password>")
    .option("--qbittorrent-url <url>", "qBittorrent Web API endpoint")
    .option("--qbittorrent-user <name>")
    .option("--qbittorrent-password <password>")
    .option("--deluge-url <url>", "Deluge Web API endpoint")
    .option("--deluge-password <password>")
    .action(async (torrent, options) => {
      try {
        const result = await addTorrent(torrent, {
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
          logger.warn("No clients configured; nothing to add.");
          return;
        }

        result.forEach((entry) => {
          if (entry.ok) {
            logger.success(`Added torrent to ${entry.client}`);
          } else {
            logger.warn(`Failed to add torrent to ${entry.client}: ${entry.error}`);
          }
        });
      } catch (error) {
        logger.error("Failed to add torrent", error);
        process.exitCode = 1;
      }
    });

  return command;
}
