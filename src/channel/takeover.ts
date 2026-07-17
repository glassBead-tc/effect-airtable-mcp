import type { Server } from "node:http";
import { setTimeout as sleep } from "node:timers/promises";
import { startHttpReceiver, RECEIVER_SERVER_NAME } from "./http-receiver.js";
import type { HttpReceiverConfig } from "./http-receiver.js";
import type { ChannelLog, PushEvent } from "./types.js";

export interface AcquireConfig extends HttpReceiverConfig {
  /** How long to keep retrying the bind after evicting a stale sibling. */
  retryBudgetMs?: number;
}

/**
 * Ask whoever holds the port to identify itself. A sibling receiver's
 * GET /health reports its server name and pid; anything else (no response,
 * different shape) is treated as a foreign process we must not touch.
 */
async function identifyPortHolder(port: number): Promise<{ pid?: number } | undefined> {
  try {
    const res = await fetch(`http://127.0.0.1:${port}/health`, {
      signal: AbortSignal.timeout(1500),
    });
    const body = (await res.json()) as { server?: unknown; pid?: unknown };
    if (body.server !== RECEIVER_SERVER_NAME) return undefined;
    return { pid: typeof body.pid === "number" ? body.pid : undefined };
  } catch {
    return undefined;
  }
}

/**
 * Bind the HTTP event receiver, evicting a stale sibling if one holds the
 * port (newest wins). A channel instance abandoned by its Claude Code parent
 * can outlive its stdio connection and keep the receiver port; the health
 * endpoint lets the new instance confirm the holder is a sibling — never a
 * foreign process — and learn its pid, then SIGTERM it and retry the bind.
 *
 * Returns undefined when the receiver cannot be started; the caller keeps the
 * stdio channel and webhook poller running regardless. All failure paths log
 * an actionable message.
 */
export async function acquireReceiver(
  config: AcquireConfig,
  push: PushEvent,
  log: ChannelLog
): Promise<Server | undefined> {
  const attempt = (): Promise<Server> =>
    startHttpReceiver({ port: config.port, token: config.token }, push, log);
  const disabled = (reason: string): undefined => {
    log(`HTTP event receiver disabled: ${reason}. Webhook polling is unaffected.`);
    return undefined;
  };
  const message = (error: unknown): string =>
    error instanceof Error ? error.message : String(error);

  try {
    return await attempt();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EADDRINUSE") {
      return disabled(message(error));
    }
  }

  const sibling = await identifyPortHolder(config.port);
  if (sibling === undefined) {
    return disabled(
      `port ${config.port} is in use by something that is not a ${RECEIVER_SERVER_NAME} receiver — not evicting it`
    );
  }
  if (sibling.pid === undefined || sibling.pid === process.pid) {
    return disabled(
      `port ${config.port} is held by a sibling receiver with no evictable pid ` +
        `(predates takeover support?) — kill it manually ` +
        `(lsof -iTCP:${config.port} -sTCP:LISTEN) and reconnect`
    );
  }

  log(
    `port ${config.port} is held by a stale sibling receiver (pid ${sibling.pid}) — evicting it (newest wins)`
  );
  try {
    process.kill(sibling.pid, "SIGTERM");
  } catch (error) {
    return disabled(`failed to signal stale sibling pid ${sibling.pid}: ${message(error)}`);
  }

  const budget = config.retryBudgetMs ?? 6000;
  const deadline = Date.now() + budget;
  while (Date.now() < deadline) {
    await sleep(300);
    try {
      const server = await attempt();
      log(`took over port ${config.port} from stale sibling pid ${sibling.pid}`);
      return server;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EADDRINUSE") {
        return disabled(message(error));
      }
    }
  }
  return disabled(
    `stale sibling pid ${sibling.pid} did not release port ${config.port} within ${budget}ms`
  );
}
