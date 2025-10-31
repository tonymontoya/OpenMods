import { Command } from "commander";
import { buildConfigRotateCommand } from "./rotate.js";
import { buildConfigSetSignerCommand } from "./set-signer.js";

export function buildConfigCommand(): Command {
  const command = new Command("config");
  command.description("Configuration management");

  command.addCommand(buildConfigRotateCommand());
  command.addCommand(buildConfigSetSignerCommand());

  return command;
}
