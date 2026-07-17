import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { ChannelLog, PushEvent } from "./types.js";

/**
 * Polls the Airtable webhook payloads endpoint and pushes each payload into
 * the connected Claude Code session. Polling (instead of a public
 * notificationUrl) means no tunnel or public endpoint is needed: create the
 * webhook once via the Airtable API and this poller drains its payloads.
 */
export interface WebhookPollerConfig {
  apiKey: string;
  baseId: string;
  webhookId: string;
  intervalMs: number;
  apiUrl?: string;
  fetchFn?: typeof fetch;
  cursorStore?: CursorStore;
}

/**
 * Persists poll cursors across server restarts. Airtable retains webhook
 * payloads for ~7 days and never deletes them on read — the cursor is the
 * only record of what has been consumed, so losing it replays history.
 */
export interface CursorStore {
  load: (key: string) => number | undefined;
  save: (key: string, cursor: number) => void;
}

/** A CursorStore backed by a JSON file mapping "baseId:webhookId" to cursor. */
export function createFileCursorStore(filePath: string): CursorStore {
  const read = (): Record<string, number> => {
    try {
      return JSON.parse(readFileSync(filePath, "utf8")) as Record<string, number>;
    } catch {
      return {};
    }
  };
  return {
    load: (key) => read()[key],
    save: (key, cursor): void => {
      const cursors = read();
      cursors[key] = cursor;
      mkdirSync(dirname(filePath), { recursive: true });
      writeFileSync(filePath, JSON.stringify(cursors, null, 2));
    },
  };
}

interface PayloadsResponse {
  cursor: number;
  mightHaveMore: boolean;
  payloads: unknown[];
}

const DEFAULT_API_URL = "https://api.airtable.com/v0";
// Airtable webhooks expire 7 days after creation unless refreshed.
const REFRESH_INTERVAL_MS = 6 * 60 * 60 * 1000;

/**
 * Drain all pending payloads once, pushing each as a channel event.
 * Returns the cursor to resume from on the next poll.
 */
export async function pollOnce(
  config: WebhookPollerConfig,
  cursor: number | undefined,
  push: PushEvent
): Promise<number | undefined> {
  const fetchFn = config.fetchFn ?? fetch;
  const apiUrl = config.apiUrl ?? DEFAULT_API_URL;
  let current = cursor;
  let mightHaveMore = true;
  while (mightHaveMore) {
    const url = new URL(`${apiUrl}/bases/${config.baseId}/webhooks/${config.webhookId}/payloads`);
    if (current !== undefined) {
      url.searchParams.set("cursor", String(current));
    }
    const response = await fetchFn(url, {
      headers: { Authorization: `Bearer ${config.apiKey}` },
    });
    if (!response.ok) {
      throw new Error(`Airtable payloads request failed: HTTP ${response.status}`);
    }
    const body = (await response.json()) as PayloadsResponse;
    for (const payload of body.payloads) {
      await push(JSON.stringify(payload), {
        origin: "airtable-webhook",
        base_id: config.baseId,
        webhook_id: config.webhookId,
      });
    }
    current = body.cursor;
    mightHaveMore = body.mightHaveMore && body.payloads.length > 0;
  }
  return current;
}

export async function refreshWebhook(config: WebhookPollerConfig): Promise<void> {
  const fetchFn = config.fetchFn ?? fetch;
  const apiUrl = config.apiUrl ?? DEFAULT_API_URL;
  const response = await fetchFn(
    `${apiUrl}/bases/${config.baseId}/webhooks/${config.webhookId}/refresh`,
    { method: "POST", headers: { Authorization: `Bearer ${config.apiKey}` } }
  );
  if (!response.ok) {
    throw new Error(`Airtable webhook refresh failed: HTTP ${response.status}`);
  }
}

export function startWebhookPoller(
  config: WebhookPollerConfig,
  push: PushEvent,
  log: ChannelLog
): { stop: () => void } {
  const cursorKey = `${config.baseId}:${config.webhookId}`;
  let cursor = config.cursorStore?.load(cursorKey);
  // Without a persisted cursor, the payloads endpoint starts from the
  // beginning of Airtable's ~7-day retention window — everything before this
  // session must be skipped, not replayed into the conversation.
  let fastForward = cursor === undefined;
  let stopped = false;
  let timer: NodeJS.Timeout | undefined;
  let lastRefresh = Date.now();

  const tick = async (): Promise<void> => {
    try {
      if (fastForward) {
        let skipped = 0;
        cursor = await pollOnce(config, cursor, () => {
          skipped += 1;
          return Promise.resolve();
        });
        fastForward = false;
        if (skipped > 0) {
          log(
            `no persisted cursor: skipped ${skipped} retained payload(s) from before this session`
          );
        }
      } else {
        cursor = await pollOnce(config, cursor, push);
      }
      if (cursor !== undefined) {
        config.cursorStore?.save(cursorKey, cursor);
      }
    } catch (error) {
      log(`webhook poll failed: ${error instanceof Error ? error.message : String(error)}`);
    }
    if (Date.now() - lastRefresh >= REFRESH_INTERVAL_MS) {
      lastRefresh = Date.now();
      try {
        await refreshWebhook(config);
      } catch (error) {
        log(`webhook refresh failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    if (!stopped) {
      timer = setTimeout(() => void tick(), config.intervalMs);
    }
  };

  void tick();
  return {
    stop: (): void => {
      stopped = true;
      if (timer !== undefined) clearTimeout(timer);
    },
  };
}
