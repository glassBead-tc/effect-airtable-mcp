/**
 * Claude Code channel entrypoint (stdio).
 *
 * The HTTP entrypoint (src/server.ts) is stateless — one McpServer per request —
 * so it cannot push notifications. This entrypoint holds a persistent stdio
 * connection, declares the `claude/channel` capability, and pushes events into
 * the connected Claude Code session from two sources:
 *
 *   1. A local HTTP receiver (POST http://127.0.0.1:$CHANNEL_HTTP_PORT/event)
 *      for CI hooks, scripts, or anything else that can hit localhost.
 *   2. An optional Airtable webhook poller (set AIRTABLE_WEBHOOK_BASE_ID and
 *      AIRTABLE_WEBHOOK_ID) that drains record/table change payloads.
 *
 * It also registers the same Code Mode tools (search + execute) so Claude can
 * immediately inspect or act on Airtable when an event arrives.
 *
 * Launch: claude --channels --dangerously-load-development-channels airtable-effect-channel
 *
 * IMPORTANT: stdout belongs to the stdio transport. All logging goes to stderr.
 */
import { homedir } from "node:os";
import { join } from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { ManagedRuntime } from "effect";
import { AirtableClient } from "../airtable-client.js";
import { createOperationsCatalog } from "../code-mode/operations.js";
import { registerAllTools } from "../tools/index.js";
import { startHttpReceiver } from "./http-receiver.js";
import { createFileCursorStore, startWebhookPoller } from "./webhook-poller.js";
import type { ChannelLog, PushEvent } from "./types.js";

const CHANNEL_NAME = "airtable-effect-channel";
const HTTP_PORT = parseInt(process.env.CHANNEL_HTTP_PORT ?? "3031", 10);
const HTTP_TOKEN = process.env.CHANNEL_HTTP_TOKEN;
const POLL_SECONDS = parseInt(process.env.AIRTABLE_WEBHOOK_POLL_SECONDS ?? "15", 10);
const CURSOR_FILE =
  process.env.AIRTABLE_WEBHOOK_CURSOR_FILE ??
  join(homedir(), ".airtable-effect-channel", "cursors.json");

const log: ChannelLog = (message) => {
  console.error(`[${CHANNEL_NAME}] ${message}`);
};

const INSTRUCTIONS = `Events from this channel arrive as <channel source="${CHANNEL_NAME}" ...> tags.
The "origin" attribute distinguishes the two event kinds:
- origin="airtable-webhook": an Airtable webhook payload (raw JSON body) describing record,
  field, or table changes in the base identified by the base_id attribute. Use this server's
  search and execute tools to inspect the changed data and act on it.
- origin="http": arbitrary JSON posted to the local event receiver by an external system;
  extra attributes come from the sender's meta object.
This channel is one-way — there is no reply tool. Respond by acting: query or mutate Airtable
via the execute tool, or make changes in the working directory as the event warrants.`;

const runtime = ManagedRuntime.make(AirtableClient.Default);

async function main(): Promise<void> {
  // Resolve the service now so a missing AIRTABLE_API_KEY fails at startup.
  const client = await runtime.runPromise(AirtableClient);
  const catalog = createOperationsCatalog(client);

  const server = new McpServer(
    { name: CHANNEL_NAME, version: "1.0.0" },
    {
      capabilities: {
        experimental: {
          "claude/channel": {},
        },
      },
      instructions: INSTRUCTIONS,
    }
  );
  registerAllTools(server, catalog, runtime);

  const transport = new StdioServerTransport();
  await server.connect(transport);
  log("connected over stdio");

  const push: PushEvent = async (content, meta) => {
    await server.server.notification({
      method: "notifications/claude/channel",
      params: { content, meta },
    });
  };

  const httpServer = await startHttpReceiver({ port: HTTP_PORT, token: HTTP_TOKEN }, push, log);
  log(`event receiver listening on http://127.0.0.1:${HTTP_PORT}/event`);

  let poller: { stop: () => void } | undefined;
  const baseId = process.env.AIRTABLE_WEBHOOK_BASE_ID;
  const webhookId = process.env.AIRTABLE_WEBHOOK_ID;
  const apiKey = process.env.AIRTABLE_API_KEY;
  if (baseId !== undefined && webhookId !== undefined && apiKey !== undefined) {
    poller = startWebhookPoller(
      {
        apiKey,
        baseId,
        webhookId,
        intervalMs: POLL_SECONDS * 1000,
        cursorStore: createFileCursorStore(CURSOR_FILE),
      },
      push,
      log
    );
    log(
      `polling Airtable webhook ${webhookId} on base ${baseId} every ${POLL_SECONDS}s (cursor file: ${CURSOR_FILE})`
    );
  } else {
    log(
      "Airtable webhook polling disabled (set AIRTABLE_WEBHOOK_BASE_ID and AIRTABLE_WEBHOOK_ID to enable)"
    );
  }

  const shutdown = (): void => {
    poller?.stop();
    httpServer.close(() => {
      runtime.dispose().then(
        () => process.exit(0),
        () => process.exit(1)
      );
    });
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
  // Claude Code closing the session closes our stdin — shut down with it.
  transport.onclose = shutdown;
}

main().catch((error: unknown) => {
  console.error("Fatal startup error:", error);
  process.exit(1);
});
