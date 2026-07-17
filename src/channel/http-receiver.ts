import express from "express";
import type { Server } from "node:http";
import type { ChannelLog, PushEvent } from "./types.js";

/** Identity reported by GET /health — takeover uses it to recognize a sibling. */
export const RECEIVER_SERVER_NAME = "airtable-effect-channel";

export interface HttpReceiverConfig {
  port: number;
  /** When set, POST /event requires `Authorization: Bearer <token>`. */
  token?: string;
}

interface EventBody {
  content?: unknown;
  meta?: unknown;
}

function extractMeta(raw: unknown): Record<string, string> {
  const meta: Record<string, string> = { origin: "http" };
  if (raw !== null && typeof raw === "object" && !Array.isArray(raw)) {
    for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
      if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
        meta[key] = String(value);
      }
    }
  }
  // origin is reserved so Claude can always tell receiver events from poller events.
  meta["origin"] = "http";
  return meta;
}

/**
 * Local webhook receiver: external systems POST JSON to /event and the payload
 * is pushed into the connected Claude Code session.
 *
 * Bound to 127.0.0.1 only — the loopback binding is the baseline sender gate.
 * Set a token to additionally require a bearer secret (do this if anything
 * untrusted can reach localhost, e.g. through a tunnel).
 */
export function startHttpReceiver(
  config: HttpReceiverConfig,
  push: PushEvent,
  log: ChannelLog
): Promise<Server> {
  const app = express();
  app.use(express.json({ limit: "1mb" }));

  app.post("/event", (req, res) => {
    if (config.token !== undefined && req.headers.authorization !== `Bearer ${config.token}`) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }
    const body = req.body as EventBody | undefined;
    const content = typeof body?.content === "string" ? body.content : JSON.stringify(body ?? {});
    push(content, extractMeta(body?.meta)).then(
      () => res.status(202).json({ status: "delivered" }),
      (error: unknown) => {
        log(`failed to deliver event: ${error instanceof Error ? error.message : String(error)}`);
        res.status(503).json({ error: "channel not connected" });
      }
    );
  });

  app.get("/health", (_req, res) => {
    res.json({ status: "ok", server: RECEIVER_SERVER_NAME, pid: process.pid });
  });

  return new Promise((resolve, reject) => {
    const server = app.listen(config.port, "127.0.0.1", () => {
      // Startup succeeded: later errors should be logged, not crash the process.
      server.off("error", reject);
      server.on("error", (error) => {
        log(`http receiver error: ${error.message}`);
      });
      resolve(server);
    });
    // Without this, a listen failure (e.g. EADDRINUSE from a stale channel
    // instance) is an unhandled 'error' event that kills the whole channel.
    server.on("error", reject);
  });
}
