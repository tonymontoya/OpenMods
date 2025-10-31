import { resolve } from "path";
import { promises as fs } from "fs";
import { projectManifestSchema } from "../src/services/project-manifest-service.js";
import { releaseManifestSchema } from "../src/services/manifest-service.js";

async function main(): Promise<void> {
  const root = resolve(process.cwd(), "samples");
  await Promise.all([
    validate("project", "project.sample.json", projectManifestSchema),
    validate("release", "release.sample.json", releaseManifestSchema)
  ]);
  console.log("Sample manifests validated successfully.");
}

async function validate(label: string, file: string, schema: any): Promise<void> {
  const path = resolve(process.cwd(), "samples", file);
  const raw = await fs.readFile(path, "utf-8");
  const json = JSON.parse(raw);
  schema.parse(json);
  console.log(`✔ ${label}: ${file}`);
}

main().catch((error) => {
  console.error("Sample validation failed", error);
  process.exit(1);
});
