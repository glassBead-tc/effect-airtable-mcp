import { describe, it, expect, vi } from "vitest";
import { createOperationsCatalog, searchCatalog } from "../../../src/code-mode/operations.js";
import type { AxiosInstance } from "axios";

const mockClient = {
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
  delete: vi.fn(),
  defaults: { headers: { common: {} } },
} as unknown as AxiosInstance;

describe("operations catalog", () => {
  it("should contain 16 operations", () => {
    const catalog = createOperationsCatalog(mockClient);
    expect(catalog).toHaveLength(16);
  });

  it("should have unique operation names", () => {
    const catalog = createOperationsCatalog(mockClient);
    const names = catalog.map((op) => op.name);
    expect(new Set(names).size).toBe(16);
  });

  it("should find operations by keyword", () => {
    const catalog = createOperationsCatalog(mockClient);
    const results = searchCatalog(catalog, "record");
    expect(results.length).toBeGreaterThan(0);
    results.forEach((r) => {
      const text = `${r.name} ${r.description}`.toLowerCase();
      expect(text).toContain("record");
    });
  });

  it("should return brief format by default", () => {
    const catalog = createOperationsCatalog(mockClient);
    const results = searchCatalog(catalog, "list_bases");
    expect(results).toHaveLength(1);
    expect(results[0]).toHaveProperty("name");
    expect(results[0]).toHaveProperty("description");
    expect(results[0]).not.toHaveProperty("parameters");
  });

  it("should return detailed format with parameters", () => {
    const catalog = createOperationsCatalog(mockClient);
    const results = searchCatalog(catalog, "list_bases", "detailed");
    expect(results).toHaveLength(1);
    expect(results[0]).toHaveProperty("parameters");
  });
});
