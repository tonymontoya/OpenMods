import { Command } from "commander";
import { buildReleaseBuildCommand } from "./release-build.js";
import { buildReleasePublishCommand } from "./release-publish.js";
import { buildReleaseVerifyCommand } from "./release-verify.js";
import { buildReleaseScaffoldCommand } from "./release-scaffold.js";
import { buildReleaseInspectCommand } from "./release-inspect.js";

export function buildReleaseCommand(): Command {
  const command = new Command("release");
  command.description("Mod release workflows");

  command.addCommand(buildReleaseScaffoldCommand());
  command.addCommand(buildReleaseBuildCommand());
  command.addCommand(buildReleasePublishCommand());
  command.addCommand(buildReleaseVerifyCommand());
  command.addCommand(buildReleaseInspectCommand());

  return command;
}
