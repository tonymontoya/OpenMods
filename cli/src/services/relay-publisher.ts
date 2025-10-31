import { SimplePool, type Event } from "nostr-tools";

export interface RelayPublishOptions {
  relays: string[];
  signal?: AbortSignal;
  timeoutMs?: number;
}

export interface RelayPublishResult {
  relay: string;
  status: "ok" | "error";
  error?: unknown;
}

export class RelayPublisher {
  private readonly pool: SimplePool;

  constructor(pool?: SimplePool) {
    this.pool = pool ?? new SimplePool();
  }

  async publish(event: Event, options: RelayPublishOptions): Promise<RelayPublishResult[]> {
    const relays = Array.from(new Set(options.relays));
    if (!relays.length) {
      return [];
    }

    const controller = new AbortController();
    const timeout = options.timeoutMs ?? 7000;
    const timeoutId = setTimeout(() => controller.abort(), timeout).unref?.();

    try {
      const publishPromise = this.pool.publish(relays, event);
      if (options.signal) {
        options.signal.addEventListener("abort", () => controller.abort(), { once: true });
      }

      await Promise.race([
        publishPromise,
        new Promise((_resolve, reject) => {
          controller.signal.addEventListener("abort", () => reject(new Error("Publish timed out")), {
            once: true
          });
        })
      ]);

      return relays.map((relay) => ({ relay, status: "ok" as const }));
    } catch (error) {
      return relays.map((relay) => ({ relay, status: "error" as const, error }));
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId as NodeJS.Timeout);
      }
    }
  }

  async close(): Promise<void> {
    await this.pool.close();
  }
}
