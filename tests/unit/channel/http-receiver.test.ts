import { describe, it, expect, vi, afterEach } from "vitest";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { startHttpReceiver } from "../../../src/channel/http-receiver.js";

let server: Server | undefined;

afterEach(() => {
  server?.close();
  server = undefined;
});

const start = async (
  push: (content: string, meta: Record<string, string>) => Promise<void>,
  token?: string
): Promise<string> => {
  server = await startHttpReceiver({ port: 0, token }, push, () => {});
  const { port } = server.address() as AddressInfo;
  return `http://127.0.0.1:${port}`;
};

describe("http receiver", () => {
  it("pushes content and flattened meta from the body", async () => {
    const push = vi.fn().mockResolvedValue(undefined);
    const url = await start(push);

    const res = await fetch(`${url}/event`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: "Build failed on main",
        meta: { severity: "high", run: 42, nested: { dropped: true } },
      }),
    });

    expect(res.status).toBe(202);
    expect(push).toHaveBeenCalledWith("Build failed on main", {
      origin: "http",
      severity: "high",
      run: "42",
    });
  });

  it("stringifies the whole body when content is not a string", async () => {
    const push = vi.fn().mockResolvedValue(undefined);
    const url = await start(push);

    await fetch(`${url}/event`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ alert: "disk full" }),
    });

    expect(push).toHaveBeenCalledWith(JSON.stringify({ alert: "disk full" }), {
      origin: "http",
    });
  });

  it("rejects requests without the configured bearer token", async () => {
    const push = vi.fn().mockResolvedValue(undefined);
    const url = await start(push, "s3cret");

    const denied = await fetch(`${url}/event`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: "hi" }),
    });
    expect(denied.status).toBe(401);
    expect(push).not.toHaveBeenCalled();

    const allowed = await fetch(`${url}/event`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer s3cret",
      },
      body: JSON.stringify({ content: "hi" }),
    });
    expect(allowed.status).toBe(202);
    expect(push).toHaveBeenCalledWith("hi", { origin: "http" });
  });

  it("returns 503 when the channel push fails", async () => {
    const push = vi.fn().mockRejectedValue(new Error("Not connected"));
    const url = await start(push);

    const res = await fetch(`${url}/event`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: "hi" }),
    });
    expect(res.status).toBe(503);
  });

  it("a sender cannot override the origin attribute", async () => {
    const push = vi.fn().mockResolvedValue(undefined);
    const url = await start(push);

    await fetch(`${url}/event`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: "hi", meta: { origin: "airtable-webhook" } }),
    });

    expect(push).toHaveBeenCalledWith("hi", { origin: "http" });
  });
});
