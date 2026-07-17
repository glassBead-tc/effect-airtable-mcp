import { describe, it, expect, vi } from "vitest";
import { Effect } from "effect";
import { executeSandbox, type CallToolFn } from "../../../src/code-mode/sandbox.js";

const run = (
  code: string,
  callTool: CallToolFn,
  options?: Parameters<typeof executeSandbox>[2]
): Promise<unknown> => Effect.runPromise(executeSandbox(code, callTool, options));

const runError = (
  code: string,
  callTool: CallToolFn,
  options?: Parameters<typeof executeSandbox>[2]
): Promise<{ _tag: string; message?: string }> =>
  Effect.runPromise(Effect.flip(executeSandbox(code, callTool, options)));

describe("sandbox", () => {
  it("should execute simple code and return result", async () => {
    const callTool = vi.fn().mockResolvedValue({ id: "rec123" });
    const result = await run(
      'return await callTool("get_record", { base_id: "app1", table_name: "t", record_id: "rec123" });',
      callTool
    );
    expect(result).toEqual({ id: "rec123" });
    expect(callTool).toHaveBeenCalledWith(
      "get_record",
      { base_id: "app1", table_name: "t", record_id: "rec123" },
      expect.any(AbortSignal)
    );
  });

  it("should support multi-step orchestration", async () => {
    const callTool = vi
      .fn()
      .mockResolvedValueOnce({ bases: [{ id: "appABC" }] })
      .mockResolvedValueOnce({ tables: [{ id: "tbl1", name: "Tasks" }] });
    const code = `
      const bases = await callTool("list_bases", {});
      const tables = await callTool("list_tables", { base_id: bases.bases[0].id });
      return tables;
    `;
    const result = await run(code, callTool);
    expect(result).toEqual({ tables: [{ id: "tbl1", name: "Tasks" }] });
    expect(callTool).toHaveBeenCalledTimes(2);
  });

  it("should timeout on synchronous infinite loops", async () => {
    const callTool = vi.fn();
    const error = await runError("while(true) {}", callTool, { syncTimeoutMs: 200 });
    expect(error._tag).toBe("SandboxError");
  });

  it("should timeout on async code that never settles", async () => {
    const callTool: CallToolFn = () => new Promise(() => undefined);
    const error = await runError('return await callTool("list_bases", {});', callTool, {
      totalTimeoutMs: 200,
    });
    expect(error._tag).toBe("TimeoutException");
  });

  it("should not expose Node.js globals", async () => {
    const callTool = vi.fn();
    const result = await run("return typeof require", callTool);
    expect(result).toBe("undefined");
  });

  it("should not expose process", async () => {
    const callTool = vi.fn();
    const result = await run("return typeof process", callTool);
    expect(result).toBe("undefined");
  });

  it("should propagate callTool errors as SandboxError", async () => {
    const callTool = vi.fn().mockRejectedValue(new Error("API failed"));
    const error = await runError('return await callTool("list_bases", {});', callTool);
    expect(error._tag).toBe("SandboxError");
    expect(error.message).toContain("API failed");
  });

  it("should allow data transformation with built-ins", async () => {
    const callTool = vi.fn().mockResolvedValue({
      records: [
        { id: "r1", fields: { Name: "Alice" } },
        { id: "r2", fields: { Name: "Bob" } },
      ],
    });
    const code = `
      const data = await callTool("list_records", { base_id: "app1", table_name: "People" });
      return data.records.map(r => r.fields.Name);
    `;
    const result = await run(code, callTool);
    expect(result).toEqual(["Alice", "Bob"]);
  });
});
