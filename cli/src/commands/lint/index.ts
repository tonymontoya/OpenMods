import { Command } from "commander";
import { buildLintReleaseCommand } from "./lint-release.js";

export function buildLintCommand(): Command {
  const command = new Command("lint");
  command.description("Lint manifests and artifacts for common issues");

  command.addCommand(buildLintReleaseCommand());

  return command;
}
