import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it, expect, vi } from "vitest";
import {
  createFileCursorStore,
  pollOnce,
  refreshWebhook,
  startWebhookPoller,
  type CursorStore,
  type WebhookPollerConfig,
} from "../../../src/channel/webhook-poller.js";

const jsonResponse = (body: unknown): Response =>
  new Response(JSON.stringify(body), { status: 200 });

const baseConfig = (fetchFn: typeof fetch): WebhookPollerConfig => ({
  apiKey: "key123",
  baseId: "appABC",
  webhookId: "achWXYZ",
  intervalMs: 1000,
  fetchFn,
});

describe("pollOnce", () => {
  it("pushes each payload and returns the new cursor", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({ cursor: 3, mightHaveMore: false, payloads: [{ a: 1 }, { b: 2 }] })
      );
    const push = vi.fn().mockResolvedValue(undefined);

    const cursor = await pollOnce(baseConfig(fetchFn as typeof fetch), undefined, push);

    expect(cursor).toBe(3);
    expect(push).toHaveBeenCalledTimes(2);
    expect(push).toHaveBeenNthCalledWith(1, JSON.stringify({ a: 1 }), {
      origin: "airtable-webhook",
      base_id: "appABC",
      webhook_id: "achWXYZ",
    });
    // First request carries no cursor param
    const firstUrl = (fetchFn.mock.calls[0] as [URL])[0];
    expect(firstUrl.searchParams.has("cursor")).toBe(false);
    expect(firstUrl.pathname).toBe("/v0/bases/appABC/webhooks/achWXYZ/payloads");
  });

  it("keeps fetching while mightHaveMore, threading the cursor", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ cursor: 2, mightHaveMore: true, payloads: [{ a: 1 }] }))
      .mockResolvedValueOnce(
        jsonResponse({ cursor: 4, mightHaveMore: false, payloads: [{ b: 2 }] })
      );
    const push = vi.fn().mockResolvedValue(undefined);

    const cursor = await pollOnce(baseConfig(fetchFn as typeof fetch), 1, push);

    expect(cursor).toBe(4);
    expect(fetchFn).toHaveBeenCalledTimes(2);
    const firstUrl = (fetchFn.mock.calls[0] as [URL])[0];
    const secondUrl = (fetchFn.mock.calls[1] as [URL])[0];
    expect(firstUrl.searchParams.get("cursor")).toBe("1");
    expect(secondUrl.searchParams.get("cursor")).toBe("2");
    expect(push).toHaveBeenCalledTimes(2);
  });

  it("stops when mightHaveMore is true but no payloads returned", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ cursor: 5, mightHaveMore: true, payloads: [] }));
    const push = vi.fn();

    const cursor = await pollOnce(baseConfig(fetchFn as typeof fetch), 5, push);

    expect(cursor).toBe(5);
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(push).not.toHaveBeenCalled();
  });

  it("throws on a non-2xx response", async () => {
    const fetchFn = vi.fn().mockResolvedValue(new Response("nope", { status: 404 }));
    await expect(pollOnce(baseConfig(fetchFn as typeof fetch), undefined, vi.fn())).rejects.toThrow(
      "HTTP 404"
    );
  });

  it("sends the bearer token", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ cursor: 1, mightHaveMore: false, payloads: [] }));
    await pollOnce(baseConfig(fetchFn as typeof fetch), undefined, vi.fn());
    const init = (fetchFn.mock.calls[0] as [URL, RequestInit])[1];
    expect(init.headers).toEqual({ Authorization: "Bearer key123" });
  });
});

const memoryStore = (
  initial: Record<string, number> = {}
): CursorStore & { data: Record<string, number> } => {
  const data = { ...initial };
  return {
    data,
    load: (key) => data[key],
    save: (key, cursor): void => {
      data[key] = cursor;
    },
  };
};

const waitForCursor = async (
  store: ReturnType<typeof memoryStore>,
  cursor: number
): Promise<void> => {
  await vi.waitFor(() => {
    expect(store.data["appABC:achWXYZ"]).toBe(cursor);
  });
};

describe("startWebhookPoller", () => {
  it("silently drains retained payloads when no cursor is persisted", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({ cursor: 9, mightHaveMore: false, payloads: [{ old: 1 }, { old: 2 }] })
      );
    const push = vi.fn().mockResolvedValue(undefined);
    const store = memoryStore();
    const log = vi.fn();

    const poller = startWebhookPoller(
      { ...baseConfig(fetchFn as typeof fetch), intervalMs: 60_000, cursorStore: store },
      push,
      log
    );
    await waitForCursor(store, 9);
    poller.stop();

    expect(push).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledWith(expect.stringContaining("skipped 2 retained payload(s)"));
  });

  it("resumes pushing from the persisted cursor", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({ cursor: 8, mightHaveMore: false, payloads: [{ fresh: 1 }] })
      );
    const push = vi.fn().mockResolvedValue(undefined);
    const store = memoryStore({ "appABC:achWXYZ": 7 });

    const poller = startWebhookPoller(
      { ...baseConfig(fetchFn as typeof fetch), intervalMs: 60_000, cursorStore: store },
      push,
      vi.fn()
    );
    await waitForCursor(store, 8);
    poller.stop();

    const firstUrl = (fetchFn.mock.calls[0] as [URL])[0];
    expect(firstUrl.searchParams.get("cursor")).toBe("7");
    expect(push).toHaveBeenCalledTimes(1);
  });

  it("retries the silent drain if the first poll fails, then pushes new payloads", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(new Response("nope", { status: 500 }))
      .mockResolvedValueOnce(
        jsonResponse({ cursor: 3, mightHaveMore: false, payloads: [{ old: 1 }] })
      )
      .mockResolvedValueOnce(
        jsonResponse({ cursor: 4, mightHaveMore: false, payloads: [{ fresh: 1 }] })
      );
    const push = vi.fn().mockResolvedValue(undefined);
    const store = memoryStore();

    const poller = startWebhookPoller(
      { ...baseConfig(fetchFn as typeof fetch), intervalMs: 10, cursorStore: store },
      push,
      vi.fn()
    );
    await waitForCursor(store, 4);
    poller.stop();

    // Poll 1 failed, poll 2 drained silently, poll 3 pushed the fresh payload.
    expect(push).toHaveBeenCalledTimes(1);
    expect(push).toHaveBeenCalledWith(JSON.stringify({ fresh: 1 }), expect.any(Object));
  });
});

describe("createFileCursorStore", () => {
  it("round-trips cursors and creates the parent directory", () => {
    const dir = mkdtempSync(join(tmpdir(), "cursor-store-"));
    try {
      const file = join(dir, "nested", "cursors.json");
      const store = createFileCursorStore(file);
      expect(store.load("a:b")).toBeUndefined();
      store.save("a:b", 12);
      store.save("c:d", 3);
      expect(store.load("a:b")).toBe(12);
      expect(createFileCursorStore(file).load("c:d")).toBe(3);
      expect(JSON.parse(readFileSync(file, "utf8"))).toEqual({ "a:b": 12, "c:d": 3 });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("treats a corrupt file as empty", () => {
    const dir = mkdtempSync(join(tmpdir(), "cursor-store-"));
    try {
      const file = join(dir, "cursors.json");
      const store = createFileCursorStore(file);
      store.save("a:b", 1);
      // Corrupt the file, then confirm load degrades to undefined and save recovers.
      writeFileSync(file, "{not json");
      expect(store.load("a:b")).toBeUndefined();
      store.save("a:b", 2);
      expect(store.load("a:b")).toBe(2);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("refreshWebhook", () => {
  it("POSTs to the refresh endpoint", async () => {
    const fetchFn = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    await refreshWebhook(baseConfig(fetchFn as typeof fetch));
    const [url, init] = fetchFn.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.airtable.com/v0/bases/appABC/webhooks/achWXYZ/refresh");
    expect(init.method).toBe("POST");
  });

  it("throws on failure", async () => {
    const fetchFn = vi.fn().mockResolvedValue(new Response("", { status: 403 }));
    await expect(refreshWebhook(baseConfig(fetchFn as typeof fetch))).rejects.toThrow("HTTP 403");
  });
});
