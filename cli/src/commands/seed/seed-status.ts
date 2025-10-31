import { Command } from "commander";
import { logger } from "../../utils/logger.js";
import { checkTorrentStatus } from "../../services/seed-status-service.js";

export function buildSeedStatusCommand(): Command {
  const command = new Command("status");

  command
    .description("Check torrent health for a given release torrent file")
    .argument("<torrent>", "Path to .torrent file or magnet URI")
    .option("--tracker <url...>", "Tracker URLs to query if not embedded")
    .option("--transmission-url <url>", "Transmission RPC endpoint (e.g. http://localhost:9091/transmission/rpc)")
    .option("--transmission-user <name>", "Transmission RPC username")
    .option("--transmission-password <password>", "Transmission RPC password")
    .option("--qbittorrent-url <url>", "qBittorrent Web API endpoint (e.g. http://localhost:8080)")
    .option("--qbittorrent-user <name>", "qBittorrent username")
    .option("--qbittorrent-password <password>", "qBittorrent password")
    .option("--deluge-url <url>", "Deluge Web API endpoint (e.g. http://localhost:8112/json)")
    .option("--deluge-password <password>", "Deluge Web UI password")
    .action(async (torrent, options) => {
      try {
        const status = await checkTorrentStatus({
          torrent,
          trackers: options.tracker,
          transmissionUrl: options.transmissionUrl,
          transmissionUser: options.transmissionUser,
          transmissionPassword: options.transmissionPassword,
          qbittorrentUrl: options.qbittorrentUrl,
          qbittorrentUser: options.qbittorrentUser,
          qbittorrentPassword: options.qbittorrentPassword,
          delugeUrl: options.delugeUrl,
          delugePassword: options.delugePassword
        });

        logger.info(`Torrent: ${status.name ?? "unknown"}`);
        logger.info(`Info Hash: ${status.infoHash}`);
        logger.info(`Magnet: ${status.magnetURI}`);
        if (status.trackers.length) {
          logger.info("Trackers:");
          status.trackers.forEach((tracker) => {
            logger.info(`  - ${tracker.url} [${tracker.health}]`);
            if (tracker.seeders !== undefined || tracker.leechers !== undefined) {
              logger.info(
                `      Seeders: ${tracker.seeders ?? "?"} | Leechers: ${tracker.leechers ?? "?"}`
              );
            }
          });
        }

        if (status.aggregateSeeders !== undefined || status.aggregateLeechers !== undefined) {
          logger.info(
            `Aggregate (trackers) — Seeders: ${status.aggregateSeeders ?? "?"} | Leechers: ${
              status.aggregateLeechers ?? "?"
            }`
          );
        }

        if (status.transmission) {
          logger.info("Transmission:");
          if (status.transmission.error) {
            logger.warn(`  Error: ${status.transmission.error}`);
          } else {
            logger.info(`  Seeding: ${status.transmission.seeding ? "yes" : "no"}`);
            logger.info(`  Peers Connected: ${status.transmission.peersConnected ?? 0}`);
            logger.info(`  Upload Ratio: ${status.transmission.uploadRatio?.toFixed(2) ?? "0.00"}`);
          }
        }

        if (status.qbittorrent) {
          logger.info("qBittorrent:");
          if (status.qbittorrent.error) {
            logger.warn(`  Error: ${status.qbittorrent.error}`);
          } else {
            logger.info(`  State: ${status.qbittorrent.state ?? "unknown"}`);
            logger.info(
              `  Seeds: ${status.qbittorrent.numSeeds ?? 0} • Peers: ${status.qbittorrent.numLeechs ?? 0}`
            );
            logger.info(`  Ratio: ${status.qbittorrent.ratio?.toFixed(2) ?? "0.00"}`);
          }
        }

        if (status.deluge) {
          logger.info("Deluge:");
          if (status.deluge.error) {
            logger.warn(`  Error: ${status.deluge.error}`);
          } else {
            logger.info(`  Connected: ${status.deluge.connected ? "yes" : "no"}`);
            logger.info(`  Seeds: ${status.deluge.seeds ?? 0} • Peers: ${status.deluge.peers ?? 0}`);
            logger.info(`  Ratio: ${status.deluge.ratio?.toFixed(2) ?? "0.00"}`);
          }
        }
      } catch (error) {
        logger.error("Failed to query torrent status", error);
        process.exitCode = 1;
      }
    });

  return command;
}
