import { Command } from "commander";
import { buildSeedStatusCommand } from "./seed-status.js";

export function buildSeedCommand(): Command {
  const command = new Command("seed");
  command.description("Torrent seeding utilities");

  command.addCommand(buildSeedStatusCommand());

  return command;
}
