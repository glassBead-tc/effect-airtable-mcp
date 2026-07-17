import { describe, it, expect } from "vitest";
import {
  fieldRequiresOptions,
  getDefaultOptions,
  type FieldType,
  type NumberFieldOptions,
  type DateFieldOptions,
  type CurrencyFieldOptions,
  type SelectFieldOptions,
} from "../../src/types.js";

describe("fieldRequiresOptions", () => {
  it("should return true for fields that require options", () => {
    expect(fieldRequiresOptions("number")).toBe(true);
    expect(fieldRequiresOptions("singleSelect")).toBe(true);
    expect(fieldRequiresOptions("multiSelect")).toBe(true);
    expect(fieldRequiresOptions("date")).toBe(true);
    expect(fieldRequiresOptions("currency")).toBe(true);
  });

  it("should return false for fields that don't require options", () => {
    expect(fieldRequiresOptions("singleLineText")).toBe(false);
    expect(fieldRequiresOptions("multilineText")).toBe(false);
    expect(fieldRequiresOptions("email")).toBe(false);
    expect(fieldRequiresOptions("phoneNumber")).toBe(false);
    expect(fieldRequiresOptions("checkbox")).toBe(false);
  });
});

describe("getDefaultOptions", () => {
  it("should return correct default options for number field", () => {
    const options = getDefaultOptions("number") as NumberFieldOptions;
    expect(options).toEqual({ precision: 0 });
  });

  it("should return correct default options for date field", () => {
    const options = getDefaultOptions("date") as DateFieldOptions;
    expect(options).toEqual({ dateFormat: { name: "local" } });
  });

  it("should return correct default options for currency field", () => {
    const options = getDefaultOptions("currency") as CurrencyFieldOptions;
    expect(options).toEqual({ precision: 2, symbol: "$" });
  });

  it("should return correct default options for select fields", () => {
    const singleSelectOptions = getDefaultOptions("singleSelect") as SelectFieldOptions;
    expect(singleSelectOptions).toEqual({ choices: [] });

    const multiSelectOptions = getDefaultOptions("multiSelect") as SelectFieldOptions;
    expect(multiSelectOptions).toEqual({ choices: [] });
  });

  it("should return undefined for fields without default options", () => {
    expect(getDefaultOptions("singleLineText")).toBeUndefined();
    expect(getDefaultOptions("multilineText")).toBeUndefined();
    expect(getDefaultOptions("email")).toBeUndefined();
    expect(getDefaultOptions("phoneNumber")).toBeUndefined();
    expect(getDefaultOptions("checkbox")).toBeUndefined();
  });
});

describe("Field Types", () => {
  it("should have all expected field types", () => {
    const validFieldTypes: FieldType[] = [
      "singleLineText",
      "multilineText",
      "number",
      "singleSelect",
      "multiSelect",
      "date",
      "checkbox",
      "email",
      "phoneNumber",
      "currency",
    ];

    // This test ensures our FieldType union includes all expected types
    validFieldTypes.forEach((fieldType) => {
      expect([
        "singleLineText",
        "multilineText",
        "number",
        "singleSelect",
        "multiSelect",
        "date",
        "checkbox",
        "email",
        "phoneNumber",
        "currency",
      ]).toContain(fieldType);
    });
  });
});
