import { SimplePool, type Event } from "nostr-tools";

export interface RelayPublishOptions {
  relays: string[];
  signal?: AbortSignal;
  timeoutMs?: number;
  maxAttempts?: number;
  backoffMs?: number;
}

export interface RelayPublishResult {
  relay: string;
  status: "ok" | "error";
  attempts: number;
  durationMs: number;
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

    const publishPromises = relays.map((relay) =>
      this.publishToRelay(relay, event, options)
    );

    return Promise.all(publishPromises);
  }

  async close(): Promise<void> {
    this.pool.destroy();
  }

  private async publishToRelay(
    relay: string,
    event: Event,
    options: RelayPublishOptions
  ): Promise<RelayPublishResult> {
    const timeoutMs = options.timeoutMs ?? 7000;
    const maxAttempts = Math.max(1, options.maxAttempts ?? 3);
    const backoffMs = Math.max(0, options.backoffMs ?? 500);

    let attempt = 0;
    let lastError: unknown;
    const start = Date.now();

    while (attempt < maxAttempts) {
      if (options.signal?.aborted) {
        return this.buildResult(relay, "error", attempt, start, new Error("Publish aborted"));
      }

      attempt += 1;

      try {
        const [publishPromise] = this.pool.publish([relay], event);
        if (!publishPromise) {
          throw new Error("Relay publish returned no response");
        }

        await withTimeout(publishPromise, timeoutMs, options.signal);
        return this.buildResult(relay, "ok", attempt, start);
      } catch (error) {
        lastError = error;
        if (options.signal?.aborted) {
          return this.buildResult(relay, "error", attempt, start, new Error("Publish aborted"));
        }

        if (attempt >= maxAttempts) {
          break;
        }

        const delayMs = backoffMs * attempt;
        if (delayMs > 0) {
          await delay(delayMs);
        }
      }
    }

    return this.buildResult(relay, "error", attempt, start, lastError);
  }

  private buildResult(
    relay: string,
    status: "ok" | "error",
    attempts: number,
    startedAt: number,
    error?: unknown
  ): RelayPublishResult {
    const durationMs = Math.max(0, Date.now() - startedAt);
    return {
      relay,
      status,
      attempts,
      durationMs,
      error
    };
  }
}

async function delay(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  signal?: AbortSignal
): Promise<T> {
  if (signal?.aborted) {
    throw new Error("Publish aborted");
  }

  let timeoutId: NodeJS.Timeout | undefined;
  let abortListener: (() => void) | undefined;

  try {
    const abortPromise =
      signal &&
      new Promise<T>((_resolve, reject) => {
        abortListener = () => reject(new Error("Publish aborted"));
        signal.addEventListener("abort", abortListener!, { once: true });
      });

    const result = await Promise.race<T>([
      promise,
      new Promise<T>((_resolve, reject) => {
        timeoutId = setTimeout(() => reject(new Error("Publish timed out")), timeoutMs);
      }),
      ...(abortPromise ? [abortPromise] : [])
    ]);
    return result;
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    if (signal && abortListener) {
      signal.removeEventListener("abort", abortListener);
    }
  }
}
