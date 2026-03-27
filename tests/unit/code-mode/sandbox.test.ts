import { describe, it, expect, vi } from "vitest";
import { executeSandbox } from "../../../src/code-mode/sandbox.js";

describe("sandbox", () => {
  it("should execute simple code and return result", async () => {
    const callTool = vi.fn().mockResolvedValue({ id: "rec123" });
    const result = await executeSandbox(
      'return await callTool("get_record", { base_id: "app1", table_name: "t", record_id: "rec123" });',
      callTool
    );
    expect(result).toEqual({ id: "rec123" });
    expect(callTool).toHaveBeenCalledWith("get_record", {
      base_id: "app1",
      table_name: "t",
      record_id: "rec123",
    });
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
    const result = await executeSandbox(code, callTool);
    expect(result).toEqual({ tables: [{ id: "tbl1", name: "Tasks" }] });
    expect(callTool).toHaveBeenCalledTimes(2);
  });

  it("should timeout on long-running code", async () => {
    const callTool = vi.fn();
    await expect(executeSandbox("while(true) {}", callTool, { timeoutMs: 200 })).rejects.toThrow();
  });

  it("should not expose Node.js globals", async () => {
    const callTool = vi.fn();
    const result = await executeSandbox("return typeof require", callTool);
    expect(result).toBe("undefined");
  });

  it("should not expose process", async () => {
    const callTool = vi.fn();
    const result = await executeSandbox("return typeof process", callTool);
    expect(result).toBe("undefined");
  });

  it("should propagate callTool errors", async () => {
    const callTool = vi.fn().mockRejectedValue(new Error("API failed"));
    await expect(
      executeSandbox('return await callTool("list_bases", {});', callTool)
    ).rejects.toThrow("API failed");
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
    const result = await executeSandbox(code, callTool);
    expect(result).toEqual(["Alice", "Bob"]);
  });
});
