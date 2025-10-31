import { promises as fs } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";
import { z } from "zod";

const signerSchema = z
  .object({
    mode: z.enum(["local", "delegated"]).default("local"),
    delegated: z
      .object({
        relay: z.string().url(),
        remotePubkey: z
          .string()
          .regex(/^npub1[02-9ac-hj-np-z]{59}$/, "Expected delegated signer npub"),
        capabilities: z
          .array(z.enum(["kind30078", "kind30079", "zap"]))
          .default(["kind30078", "kind30079"])
      })
      .optional()
  })
  .superRefine((value, ctx) => {
    if (value.mode === "delegated" && !value.delegated) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "delegated signer details required when mode is 'delegated'"
      });
    }
  });

const configSchema = z.object({
  gameId: z.string().min(1),
  projectSlug: z.string().regex(/^[a-z0-9-]+(\.[a-z0-9-]+)*$/),
  relays: z.array(z.string().url()).nonempty(),
  authorPubkey: z
    .string()
    .regex(/^npub1[02-9ac-hj-np-z]{59}$/, "Expected a Bech32 npub public key")
    .optional(),
  zap: z
    .object({
      lnurl: z.string().url().optional(),
      bolt12: z.string().optional()
    })
    .optional(),
  release: z.object({
    artifactsDir: z.string().min(1),
    torrentsDir: z.string().min(1)
  }),
  signer: signerSchema.optional()
});

export type OpenModsConfig = z.infer<typeof configSchema>;
export type SignerConfig = z.infer<typeof signerSchema>;

const CONFIG_FILENAME = "openmods.json";

function resolveProjectRoot(cwd: string): string {
  return resolve(cwd);
}

export class ConfigService {
  constructor(private readonly cwd: string = process.cwd()) {}

  get configPath(): string {
    return resolveProjectRoot(this.cwd) + "/" + CONFIG_FILENAME;
  }

  async exists(): Promise<boolean> {
    try {
      await fs.stat(this.configPath);
      return true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return false;
      }
      throw error;
    }
  }

  async load(): Promise<OpenModsConfig> {
    const raw = await fs.readFile(this.configPath, "utf-8");
    const parsed = JSON.parse(raw);
    return configSchema.parse(parsed);
  }

  async save(config: OpenModsConfig): Promise<void> {
    configSchema.parse(config);
    const serialized = JSON.stringify(config, null, 2);
    await fs.mkdir(dirname(this.configPath), { recursive: true });
    await fs.writeFile(this.configPath, serialized + "\n", "utf-8");
  }

  async rotateAuthorPubkey(npub: string): Promise<OpenModsConfig> {
    const current = await this.load();
    const updated: OpenModsConfig = {
      ...current,
      authorPubkey: npub
    };
    await this.save(updated);
    return updated;
  }

  async setSigner(signer: SignerConfig): Promise<OpenModsConfig> {
    const current = await this.load();
    const updated: OpenModsConfig = {
      ...current,
      signer
    };
    await this.save(updated);
    return updated;
  }
}

export function resolveFromModule(meta: ImportMeta): string {
  const filePath = fileURLToPath(meta.url);
  return dirname(filePath);
}
