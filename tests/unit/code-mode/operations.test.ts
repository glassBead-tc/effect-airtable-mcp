import { describe, it, expect, vi } from "vitest";
import { Effect } from "effect";
import { createOperationsCatalog, searchCatalog } from "../../../src/code-mode/operations.js";
import type { AirtableClient } from "../../../src/airtable-client.js";

function makeStubClient(): AirtableClient {
  const method = (): ReturnType<AirtableClient["listBases"]> => Effect.succeed({ stub: true });
  return {
    listBases: vi.fn(method),
    getBase: vi.fn(method),
    listTables: vi.fn(method),
    createTable: vi.fn(method),
    updateTable: vi.fn(method),
    createField: vi.fn(method),
    updateField: vi.fn(method),
    listRecords: vi.fn(method),
    getRecord: vi.fn(method),
    createRecord: vi.fn(method),
    updateRecord: vi.fn(method),
    deleteRecord: vi.fn(method),
    searchRecords: vi.fn(method),
    createRecords: vi.fn(method),
    updateRecords: vi.fn(method),
    deleteRecords: vi.fn(method),
  } as unknown as AirtableClient;
}

describe("operations catalog", () => {
  it("should contain 16 operations", () => {
    const catalog = createOperationsCatalog(makeStubClient());
    expect(catalog).toHaveLength(16);
  });

  it("should have unique operation names", () => {
    const catalog = createOperationsCatalog(makeStubClient());
    const names = catalog.map((op) => op.name);
    expect(new Set(names).size).toBe(16);
  });

  it("should find operations by keyword", () => {
    const catalog = createOperationsCatalog(makeStubClient());
    const results = searchCatalog(catalog, "record");
    expect(results.length).toBeGreaterThan(0);
    results.forEach((r) => {
      const text = `${r.name} ${r.description}`.toLowerCase();
      expect(text).toContain("record");
    });
  });

  it("should return brief format by default", () => {
    const catalog = createOperationsCatalog(makeStubClient());
    const results = searchCatalog(catalog, "list_bases");
    expect(results).toHaveLength(1);
    expect(results[0]).toHaveProperty("name");
    expect(results[0]).toHaveProperty("description");
    expect(results[0]).not.toHaveProperty("parameters");
  });

  it("should return detailed format with parameters", () => {
    const catalog = createOperationsCatalog(makeStubClient());
    const results = searchCatalog(catalog, "list_bases", "detailed");
    expect(results).toHaveLength(1);
    expect(results[0]).toHaveProperty("parameters");
  });

  it("should delegate handlers to the client with translated params", async () => {
    const client = makeStubClient();
    const catalog = createOperationsCatalog(client);
    const getRecord = catalog.find((op) => op.name === "get_record");
    expect(getRecord).toBeDefined();

    const result = await Effect.runPromise(
      getRecord!.handler({ base_id: "app1", table_name: "Tasks", record_id: "rec9" })
    );
    expect(result).toEqual({ stub: true });
    expect(client.getRecord).toHaveBeenCalledWith("app1", "Tasks", "rec9");
  });

  it("should map upsert params to Airtable's performUpsert shape", async () => {
    const client = makeStubClient();
    const catalog = createOperationsCatalog(client);
    const updateRecords = catalog.find((op) => op.name === "update_records");

    await Effect.runPromise(
      updateRecords!.handler({
        base_id: "app1",
        table_name: "Tasks",
        records: [{ fields: { Name: "x" } }],
        perform_upsert: { fields_to_merge_on: ["Name"] },
      })
    );
    expect(client.updateRecords).toHaveBeenCalledWith("app1", "Tasks", {
      records: [{ fields: { Name: "x" } }],
      typecast: undefined,
      performUpsert: { fieldsToMergeOn: ["Name"] },
    });
  });
});
