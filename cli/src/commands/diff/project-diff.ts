import { resolve, dirname } from "path";
import { promises as fs } from "fs";
import { Command } from "commander";
import { diffLines } from "diff";
import { projectManifestSchema } from "../../services/project-manifest-service.js";
import { logger } from "../../utils/logger.js";

export function buildDiffProjectCommand(): Command {
  const command = new Command("project");

  command
    .description("Compare two project manifest JSON files")
    .argument("<left>", "Baseline manifest path")
    .argument("<right>", "Updated manifest path")
    .option("--summary", "Show only changed fields", false)
    .option("--format <format>", "Output format: pretty, table, or json", "pretty")
    .option("--output <file>", "Write summary JSON to file (summary mode only)")
    .action(async (leftPath, rightPath, options) => {
      try {
        const [left, right] = await Promise.all([
          readManifest(leftPath),
          readManifest(rightPath)
        ]);

        if (options.summary) {
          const summary = buildProjectSummary(left, right);
          if (options.format === "json") {
            logger.info(JSON.stringify(summary, null, 2));
          } else if (options.format === "table") {
            printProjectSummaryTable(summary);
          } else {
            printProjectSummary(summary);
          }
          if (options.output) {
            await writeSummaryToFile(options.output, summary);
          }
        } else {
          printManifestDiff(leftPath, rightPath, left, right);
        }
      } catch (error) {
        logger.error("Failed to diff project manifests", error);
        process.exitCode = 1;
      }
    });

  return command;
}

async function readManifest(path: string): Promise<unknown> {
  const absolute = resolve(process.cwd(), path);
  const raw = await fs.readFile(absolute, "utf-8");
  return projectManifestSchema.parse(JSON.parse(raw));
}

function printManifestDiff(leftLabel: string, rightLabel: string, left: unknown, right: unknown): void {
  const leftJson = JSON.stringify(left, null, 2) + "\n";
  const rightJson = JSON.stringify(right, null, 2) + "\n";
  const diff = diffLines(leftJson, rightJson);

  logger.info(`Diff for ${leftLabel} -> ${rightLabel}`);
  diff.forEach((part) => {
    const prefix = part.added ? "+" : part.removed ? "-" : " ";
    part.value.split("\n").forEach((line) => {
      if (!line) return;
      logger.info(`${prefix} ${line}`);
    });
  });
}

interface ProjectSummaryDiff {
  titleChanged: boolean;
  summaryChanged: boolean;
  addedTags: string[];
  removedTags: string[];
  addedAuthors: string[];
  removedAuthors: string[];
}

function buildProjectSummary(left: any, right: any): ProjectSummaryDiff {
  const leftTags = new Set(left.tags ?? []);
  const rightTags = new Set(right.tags ?? []);
  const leftAuthors = new Set((left.authors ?? []).map((author: any) => author.pubkey));
  const rightAuthors = new Set((right.authors ?? []).map((author: any) => author.pubkey));

  return {
    titleChanged: left.title !== right.title,
    summaryChanged: left.summary !== right.summary,
    addedTags: [...rightTags].filter((tag) => !leftTags.has(tag)),
    removedTags: [...leftTags].filter((tag) => !rightTags.has(tag)),
    addedAuthors: [...rightAuthors].filter((pubkey) => !leftAuthors.has(pubkey)),
    removedAuthors: [...leftAuthors].filter((pubkey) => !rightAuthors.has(pubkey))
  };
}

function printProjectSummary(summary: ProjectSummaryDiff): void {
  if (summary.titleChanged) {
    logger.info("Title changed");
  }
  if (summary.summaryChanged) {
    logger.info("Summary changed");
  }
  if (summary.addedTags.length) {
    logger.info(`Added tags: ${summary.addedTags.join(", ")}`);
  }
  if (summary.removedTags.length) {
    logger.info(`Removed tags: ${summary.removedTags.join(", ")}`);
  }
  if (summary.addedAuthors.length) {
    logger.info(`New authors: ${summary.addedAuthors.join(", ")}`);
  }
  if (summary.removedAuthors.length) {
    logger.info(`Removed authors: ${summary.removedAuthors.join(", ")}`);
  }
  if (
    !summary.titleChanged &&
    !summary.summaryChanged &&
    !summary.addedTags.length &&
    !summary.removedTags.length &&
    !summary.addedAuthors.length &&
    !summary.removedAuthors.length
  ) {
    logger.info("No significant changes detected.");
  }
}

function printProjectSummaryTable(summary: ProjectSummaryDiff): void {
  const rows: Array<[string, string]> = [];
  rows.push(["Title", summary.titleChanged ? "changed" : "unchanged"]);
  rows.push(["Summary", summary.summaryChanged ? "changed" : "unchanged"]);
  rows.push(["Added tags", summary.addedTags.join(", ") || "—"]);
  rows.push(["Removed tags", summary.removedTags.join(", ") || "—"]);
  rows.push(["Added authors", summary.addedAuthors.join(", ") || "—"]);
  rows.push(["Removed authors", summary.removedAuthors.join(", ") || "—"]);

  const width = Math.max(...rows.map(([label]) => label.length)) + 2;
  rows.forEach(([label, value]) => {
    logger.info(`${label.padEnd(width, " ")}${value}`);
  });
}

async function writeSummaryToFile(path: string, data: unknown): Promise<void> {
  const outPath = resolve(process.cwd(), path);
  await fs.mkdir(dirname(outPath), { recursive: true });
  await fs.writeFile(outPath, JSON.stringify(data, null, 2) + "\n", "utf-8");
  logger.info(`Summary written to ${outPath}`);
}
