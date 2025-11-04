import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildInitCommand } from "../src/commands/init.js";

describe("init command", () => {
  it("writes openmods.json with provided slug", async () => {
    const workdir = await mkdtemp(join(tmpdir(), "openmods-"));
    const originalCwd = process.cwd();
    process.chdir(workdir);

    try {
      const command = buildInitCommand();
      command.exitOverride(() => {
        throw new Error("Command attempted to exit");
      });

      await command.parseAsync(["node", "openmods", "--slug", "test-mod"], { from: "user" });

      const raw = await readFile(join(workdir, "openmods.json"), "utf-8");
      const config = JSON.parse(raw) as Record<string, unknown>;

      expect(config.gameId).toBe("skyrim-se");
      expect(config.projectSlug).toBe("test-mod");
      expect(Array.isArray(config.relays)).toBe(true);
    } finally {
      process.chdir(originalCwd);
    }
  });
});
