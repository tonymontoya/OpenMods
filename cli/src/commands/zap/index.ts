import { Command } from "commander";
import { buildZapSimulateCommand } from "./zap-simulate.js";

export function buildZapCommand(): Command {
  const command = new Command("zap");
  command.description("Zap testing and simulation utilities");

  command.addCommand(buildZapSimulateCommand());

  return command;
}
