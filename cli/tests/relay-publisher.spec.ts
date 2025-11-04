import { describe, expect, it } from "vitest";
import { RelayPublisher } from "../src/services/relay-publisher.js";
import type { Event } from "nostr-tools";

type Behavior =
  | { type: "resolve"; delay?: number }
  | { type: "reject"; delay?: number; message?: string }
  | { type: "hang" };

class FakePool {
  constructor(private readonly script: Record<string, Behavior[]>) {}

  publish(relays: string[], _event: Event): Array<Promise<string>> {
    return relays.map((relay) => this.execute(relay));
  }

  destroy(): void {
    // noop for tests
  }

  private execute(relay: string): Promise<string> {
    const queue = this.script[relay] ?? [{ type: "resolve" as const }];
    const behavior = queue.shift() ?? { type: "resolve" as const };

    if (behavior.type === "resolve") {
      return new Promise<string>((resolve) => {
        setTimeout(() => resolve("ok"), behavior.delay ?? 0);
      });
    }

    if (behavior.type === "reject") {
      return new Promise<string>((_resolve, reject) => {
        setTimeout(() => reject(new Error(behavior.message ?? "fail")), behavior.delay ?? 0);
      });
    }

    return new Promise<string>(() => {
      // never resolves/rejects
    });
  }
}

const sampleEvent: Event = {
  kind: 1,
  pubkey: "00".repeat(32),
  created_at: Math.floor(Date.now() / 1000),
  content: "",
  tags: [],
  id: "00".repeat(32),
  sig: "00".repeat(64)
};

describe("RelayPublisher", () => {
  it("retries and succeeds on a subsequent attempt", async () => {
    const pool = new FakePool({
      "wss://relay.test": [
        { type: "reject", message: "first failure" },
        { type: "resolve" }
      ]
    });
    const publisher = new RelayPublisher(pool as unknown as any);

    const [result] = await publisher.publish(sampleEvent, {
      relays: ["wss://relay.test"],
      timeoutMs: 50,
      backoffMs: 0
    });

    expect(result.status).toBe("ok");
    expect(result.attempts).toBe(2);
  });

  it("stops after max attempts and reports the last error", async () => {
    const pool = new FakePool({
      "wss://relay.fail": [
        { type: "reject", message: "first failure" },
        { type: "reject", message: "second failure" }
      ]
    });
    const publisher = new RelayPublisher(pool as unknown as any);

    const [result] = await publisher.publish(sampleEvent, {
      relays: ["wss://relay.fail"],
      timeoutMs: 50,
      maxAttempts: 2,
      backoffMs: 0
    });

    expect(result.status).toBe("error");
    expect(result.attempts).toBe(2);
    expect(result.error).toBeInstanceOf(Error);
    expect((result.error as Error).message).toContain("second failure");
  });

  it("enforces timeouts when relays do not respond", async () => {
    const pool = new FakePool({
      "wss://relay.timeout": [{ type: "hang" }]
    });
    const publisher = new RelayPublisher(pool as unknown as any);

    const [result] = await publisher.publish(sampleEvent, {
      relays: ["wss://relay.timeout"],
      timeoutMs: 20,
      maxAttempts: 1
    });

    expect(result.status).toBe("error");
    expect(result.error).toBeInstanceOf(Error);
    expect((result.error as Error).message).toContain("timed out");
  });
});
