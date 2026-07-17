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
import type { Server } from "node:http";
import { homedir } from "node:os";
import { join } from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { ManagedRuntime } from "effect";
import { AirtableClient } from "../airtable-client.js";
import { createOperationsCatalog } from "../code-mode/operations.js";
import { registerAllTools } from "../tools/index.js";
import { createFileCursorStore, startWebhookPoller } from "./webhook-poller.js";
import { acquireReceiver } from "./takeover.js";
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

  // The receiver is a secondary event source — a stale sibling holding the
  // port gets evicted (newest wins), and any unrecoverable failure leaves the
  // stdio channel and webhook poller running rather than dying with an opaque
  // connection error. acquireReceiver logs every failure path.
  const httpServer: Server | undefined = await acquireReceiver(
    { port: HTTP_PORT, token: HTTP_TOKEN },
    push,
    log
  );
  if (httpServer !== undefined) {
    log(`event receiver listening on http://127.0.0.1:${HTTP_PORT}/event`);
  }

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

  let shuttingDown = false;
  const shutdown = (): void => {
    if (shuttingDown) return;
    shuttingDown = true;
    // Failsafe: registering signal handlers suppresses default die-on-signal
    // behavior, so a hung close/dispose would otherwise leave a zombie holding
    // the receiver port. Shutdown must always terminate the process.
    setTimeout(() => process.exit(1), 3000).unref();
    poller?.stop();
    const disposeAndExit = (): void => {
      runtime.dispose().then(
        () => process.exit(0),
        () => process.exit(1)
      );
    };
    if (httpServer !== undefined) {
      // Keep-alive sockets would stall close()'s callback indefinitely.
      httpServer.closeAllConnections();
      httpServer.close(disposeAndExit);
    } else {
      disposeAndExit();
    }
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
  // Claude Code closing the session closes our stdin — shut down with it.
  // transport.onclose alone is NOT enough: the SDK's StdioServerTransport only
  // listens for 'data'/'error' and fires onclose on explicit close(), so a
  // plain stdin EOF is silent. Without this handler an abandoned instance
  // lingers forever with the receiver port held (observed 2026-07-17).
  transport.onclose = shutdown;
  process.stdin.on("end", () => {
    log("stdin closed — shutting down");
    shutdown();
  });
  // Stdin EOF only fires if the parent actually closes the pipe; a crashed
  // parent reparents us to pid 1. Poll for that and exit rather than linger.
  setInterval(() => {
    if (process.ppid === 1) {
      log("parent process is gone — shutting down");
      shutdown();
    }
  }, 5000).unref();
}

main().catch((error: unknown) => {
  console.error("Fatal startup error:", error);
  process.exit(1);
});
