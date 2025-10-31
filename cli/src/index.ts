import { Command } from "commander";
import { createRequire } from "module";
import { buildInitCommand } from "./commands/init.js";
import { buildReleaseCommand } from "./commands/release/index.js";
import { buildProjectCommand } from "./commands/project/index.js";
import { buildValidateCommand } from "./commands/validate.js";
import { buildConfigCommand } from "./commands/config/index.js";
import { buildZapCommand } from "./commands/zap/index.js";
import { buildDiffCommand } from "./commands/diff/index.js";
import { buildSeedCommand } from "./commands/seed/index.js";
import { logger } from "./utils/logger.js";

const require = createRequire(import.meta.url);
const { version } = require("../package.json") as { version: string };

async function main(): Promise<void> {
  const program = new Command();

  program
    .name("openmods")
    .description("Self-sovereign author tooling for OpenMods")
    .version(version);

  program.addCommand(buildInitCommand());
  program.addCommand(buildReleaseCommand());
  program.addCommand(buildProjectCommand());
  program.addCommand(buildValidateCommand());
  program.addCommand(buildConfigCommand());
  program.addCommand(buildZapCommand());
  program.addCommand(buildDiffCommand());
  program.addCommand(buildSeedCommand());

  try {
    await program.parseAsync(process.argv);
  } catch (error) {
    logger.error("Unhandled CLI error", error);
    process.exitCode = 1;
  }
}

main().catch((error) => {
  logger.error("Fatal CLI error", error);
  process.exit(1);
});
