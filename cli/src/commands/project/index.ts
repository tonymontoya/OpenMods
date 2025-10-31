import { Command } from "commander";
import { buildProjectPublishCommand } from "./project-publish.js";
import { buildProjectScaffoldCommand } from "./project-scaffold.js";
import { buildProjectInspectCommand } from "./project-inspect.js";

export function buildProjectCommand(): Command {
  const command = new Command("project");
  command.description("Project definition workflows");

  command.addCommand(buildProjectScaffoldCommand());
  command.addCommand(buildProjectPublishCommand());
  command.addCommand(buildProjectInspectCommand());

  return command;
}
