import { Command } from "commander";
import { buildDiffReleaseCommand } from "./release-diff.js";
import { buildDiffProjectCommand } from "./project-diff.js";

export function buildDiffCommand(): Command {
  const command = new Command("diff");
  command.description("Compare manifests and events for audit reporting");

  command.addCommand(buildDiffProjectCommand());
  command.addCommand(buildDiffReleaseCommand());

  return command;
}
