import { Command } from "commander";
import { buildSeedStatusCommand } from "./seed-status.js";
import { buildSeedAddCommand } from "./seed-add.js";
import { buildSeedPauseCommand } from "./seed-pause.js";
import { buildSeedResumeCommand } from "./seed-resume.js";

export function buildSeedCommand(): Command {
  const command = new Command("seed");
  command.description("Torrent seeding utilities");

  command.addCommand(buildSeedStatusCommand());
  command.addCommand(buildSeedAddCommand());
  command.addCommand(buildSeedPauseCommand());
  command.addCommand(buildSeedResumeCommand());

  return command;
}
