import { resolve, dirname } from "path";
import { promises as fs } from "fs";
import { Command } from "commander";
import { diffLines } from "diff";
import { releaseManifestSchema } from "../../services/manifest-service.js";
import { logger } from "../../utils/logger.js";

export function buildDiffReleaseCommand(): Command {
  const command = new Command("release");

  command
    .description("Compare two release manifest JSON files")
    .argument("<left>", "Baseline release manifest path")
    .argument("<right>", "Updated release manifest path")
    .option("--summary", "Show concise summary of changes", false)
    .option("--format <format>", "Output format: pretty, table, or json", "pretty")
    .option("--output <file>", "Write summary JSON to file (summary mode only)")
    .action(async (leftPath, rightPath, options) => {
      try {
        const [left, right] = await Promise.all([
          readManifest(leftPath),
          readManifest(rightPath)
        ]);

        if (options.summary) {
          const summary = buildReleaseSummary(left, right);
          if (options.format === "json") {
            logger.info(JSON.stringify(summary, null, 2));
          } else if (options.format === "table") {
            printReleaseSummaryTable(summary);
          } else {
            printReleaseSummary(summary);
          }
          if (options.output) {
            await writeSummaryToFile(options.output, summary);
          }
        } else {
          printManifestDiff(leftPath, rightPath, left, right);
        }
      } catch (error) {
        logger.error("Failed to diff release manifests", error);
        process.exitCode = 1;
      }
    });

  return command;
}

async function readManifest(path: string): Promise<unknown> {
  const absolute = resolve(process.cwd(), path);
  const raw = await fs.readFile(absolute, "utf-8");
  return releaseManifestSchema.parse(JSON.parse(raw));
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

interface ReleaseSummaryDiff {
  versionChanged: boolean;
  addedArtifacts: string[];
  removedArtifacts: string[];
  hashesChanged: boolean;
  addedDependencies: string[];
  removedDependencies: string[];
}

function buildReleaseSummary(left: any, right: any): ReleaseSummaryDiff {
  const leftArtifacts = new Set((left.artifacts ?? []).map((artifact: any) => artifact.uri));
  const rightArtifacts = new Set((right.artifacts ?? []).map((artifact: any) => artifact.uri));
  const leftHashes = new Set((left.hashes ?? []).map((hash: any) => hash.value));
  const rightHashes = new Set((right.hashes ?? []).map((hash: any) => hash.value));
  const leftDeps = new Set(
    (left.dependencies ?? []).map((dep: any) => `${dep.slug}@${dep.versionRange ?? ""}`)
  );
  const rightDeps = new Set(
    (right.dependencies ?? []).map((dep: any) => `${dep.slug}@${dep.versionRange ?? ""}`)
  );

  return {
    versionChanged: left.version !== right.version,
    addedArtifacts: [...rightArtifacts].filter((artifact) => !leftArtifacts.has(artifact)),
    removedArtifacts: [...leftArtifacts].filter((artifact) => !rightArtifacts.has(artifact)),
    hashesChanged: !setsEqual(leftHashes, rightHashes),
    addedDependencies: [...rightDeps].filter((dep) => !leftDeps.has(dep)),
    removedDependencies: [...leftDeps].filter((dep) => !rightDeps.has(dep))
  };
}

function printReleaseSummary(summary: ReleaseSummaryDiff): void {
  if (summary.versionChanged) {
    logger.info("Version changed");
  }
  if (summary.addedArtifacts.length) {
    logger.info(`New artifacts: ${summary.addedArtifacts.join(", ")}`);
  }
  if (summary.removedArtifacts.length) {
    logger.info(`Removed artifacts: ${summary.removedArtifacts.join(", ")}`);
  }
  if (summary.hashesChanged) {
    logger.warn("Root hashes changed");
  }
  if (summary.addedDependencies.length) {
    logger.info(`Added dependencies: ${summary.addedDependencies.join(", ")}`);
  }
  if (summary.removedDependencies.length) {
    logger.info(`Removed dependencies: ${summary.removedDependencies.join(", ")}`);
  }
  if (
    !summary.versionChanged &&
    !summary.hashesChanged &&
    !summary.addedArtifacts.length &&
    !summary.removedArtifacts.length &&
    !summary.addedDependencies.length &&
    !summary.removedDependencies.length
  ) {
    logger.info("No significant changes detected.");
  }
}

function printReleaseSummaryTable(summary: ReleaseSummaryDiff): void {
  const rows: Array<[string, string]> = [
    ["Version", summary.versionChanged ? "changed" : "unchanged"],
    ["Added artifacts", summary.addedArtifacts.join(", ") || "—"],
    ["Removed artifacts", summary.removedArtifacts.join(", ") || "—"],
    ["Root hashes", summary.hashesChanged ? "changed" : "unchanged"],
    ["Added dependencies", summary.addedDependencies.join(", ") || "—"],
    ["Removed dependencies", summary.removedDependencies.join(", ") || "—"]
  ];
  const width = Math.max(...rows.map(([label]) => label.length)) + 2;
  rows.forEach(([label, value]) => logger.info(`${label.padEnd(width, " ")}${value}`));
}

async function writeSummaryToFile(path: string, data: unknown): Promise<void> {
  const outPath = resolve(process.cwd(), path);
  await fs.mkdir(dirname(outPath), { recursive: true });
  await fs.writeFile(outPath, JSON.stringify(data, null, 2) + "\n", "utf-8");
  logger.info(`Summary written to ${outPath}`);
}

function setsEqual<T>(a: Set<T>, b: Set<T>): boolean {
  if (a.size !== b.size) return false;
  for (const value of a) {
    if (!b.has(value)) return false;
  }
  return true;
}
