import { describe, it, expect, vi, afterEach } from "vitest";
import { spawn, type ChildProcess } from "node:child_process";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { fileURLToPath } from "node:url";
import { acquireReceiver } from "../../../src/channel/takeover.js";

const repoRoot = fileURLToPath(new URL("../../..", import.meta.url));

let cleanups: Array<() => void> = [];

afterEach(() => {
  for (const cleanup of cleanups) cleanup();
  cleanups = [];
});

const track = <T extends Server>(server: T): T => {
  cleanups.push(() => server.close());
  return server;
};

const push = vi.fn().mockResolvedValue(undefined);

/** Spawn the stale-receiver fixture and wait for its {port, pid} banner. */
const spawnStaleReceiver = (): Promise<{ child: ChildProcess; port: number; pid: number }> =>
  new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      ["node_modules/tsx/dist/cli.mjs", "tests/fixtures/stale-receiver.ts", "0"],
      { cwd: repoRoot, stdio: ["ignore", "pipe", "inherit"] }
    );
    cleanups.push(() => child.kill("SIGKILL"));
    let buffer = "";
    child.stdout.on("data", (chunk: Buffer) => {
      buffer += chunk.toString();
      const line = buffer.split("\n")[0];
      if (buffer.includes("\n")) {
        const { port, pid } = JSON.parse(line) as { port: number; pid: number };
        resolve({ child, port, pid });
      }
    });
    child.on("error", reject);
    child.on("exit", (code) => reject(new Error(`fixture exited early (code ${code})`)));
  });

describe("acquireReceiver", () => {
  it("binds a free port directly", async () => {
    const server = await acquireReceiver({ port: 0 }, push, () => {});
    expect(server).toBeDefined();
    track(server!);
    const { port } = server!.address() as AddressInfo;
    const res = await fetch(`http://127.0.0.1:${port}/health`);
    expect(res.status).toBe(200);
  });

  it("does not evict a foreign (non-sibling) port holder", async () => {
    const foreign = track(createServer((_req, res) => res.end("not a receiver")));
    await new Promise<void>((resolve) => foreign.listen(0, "127.0.0.1", resolve));
    const { port } = foreign.address() as AddressInfo;

    const logs: string[] = [];
    const server = await acquireReceiver({ port }, push, (m) => logs.push(m));
    expect(server).toBeUndefined();
    expect(logs.join("\n")).toContain("not evicting");
    // The foreign holder must be untouched.
    expect(foreign.listening).toBe(true);
  });

  it("does not evict itself when the sibling reports our own pid", async () => {
    // An in-process receiver reports process.pid — the same pid acquireReceiver
    // would be signaling. It must refuse rather than SIGTERM itself.
    const sibling = await acquireReceiver({ port: 0 }, push, () => {});
    track(sibling!);
    const { port } = sibling!.address() as AddressInfo;

    const logs: string[] = [];
    const server = await acquireReceiver({ port }, push, (m) => logs.push(m));
    expect(server).toBeUndefined();
    expect(logs.join("\n")).toContain("no evictable pid");
    expect(sibling!.listening).toBe(true);
  });

  it("evicts a stale sibling process and takes over its port", async () => {
    const { child, port, pid } = await spawnStaleReceiver();
    child.removeAllListeners("exit"); // the early-exit rejection guard

    const exited = new Promise<void>((resolve) => child.on("exit", () => resolve()));
    const logs: string[] = [];
    const server = await acquireReceiver({ port, retryBudgetMs: 8000 }, push, (m) => logs.push(m));

    expect(server).toBeDefined();
    track(server!);
    expect(logs.join("\n")).toContain(`evicting`);
    expect(logs.join("\n")).toContain(`took over port ${port} from stale sibling pid ${pid}`);
    await exited;

    // The new receiver owns the port: health now reports OUR pid.
    const body = (await (await fetch(`http://127.0.0.1:${port}/health`)).json()) as {
      pid: number;
    };
    expect(body.pid).toBe(process.pid);
  }, 20_000);
});
