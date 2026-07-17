// Field type definitions for Airtable

// Known types get autocomplete and default-options support below; the open
// string arm admits the rest of Airtable's ~30 field types (dateTime,
// multipleRecordLinks, url, rating, ...) — Airtable's API is the authority on
// validity, and this server must never silently narrow what it forwards.
export type FieldType =
  | "singleLineText"
  | "multilineText"
  | "number"
  | "singleSelect"
  | "multiSelect"
  | "date"
  | "dateTime"
  | "checkbox"
  | "email"
  | "phoneNumber"
  | "currency"
  | (string & {});

// Field option types for different field types
export interface NumberFieldOptions {
  precision: number;
}

export interface DateFieldOptions {
  dateFormat: {
    name: "local" | "friendly" | "us" | "european" | "iso";
  };
}

export interface CurrencyFieldOptions {
  precision: number;
  symbol: string;
}

export interface SelectFieldOptions {
  choices: Array<{
    name: string;
    color?: string;
  }>;
}

export type FieldOptions =
  | NumberFieldOptions
  | DateFieldOptions
  | CurrencyFieldOptions
  | SelectFieldOptions
  // Escape hatch for every other field type's options (linkedTableId,
  // timeFormat/timeZone, icon/color, ...) — forwarded verbatim to Airtable.
  | Record<string, unknown>;

export interface FieldOption {
  name: string;
  type: FieldType;
  description?: string;
  options?: FieldOptions;
}

// "Requires options AND we know a sane default" — used only to FILL missing
// options, never to justify stripping provided ones. Types that require
// options without a guessable default (multipleRecordLinks needs a
// linkedTableId) are deliberately absent: Airtable's 422 is clearer than a
// fabricated default.
export const fieldRequiresOptions = (type: FieldType): boolean => {
  switch (type) {
    case "number":
    case "singleSelect":
    case "multiSelect":
    case "date":
    case "dateTime":
    case "currency":
      return true;
    default:
      return false;
  }
};

export const getDefaultOptions = (type: FieldType): FieldOptions | undefined => {
  switch (type) {
    case "number":
      return { precision: 0 };
    case "date":
      return { dateFormat: { name: "local" } };
    case "dateTime":
      return {
        dateFormat: { name: "iso" },
        timeFormat: { name: "24hour" },
        timeZone: "utc",
      };
    case "currency":
      return { precision: 2, symbol: "$" };
    case "singleSelect":
    case "multiSelect":
      return { choices: [] };
    default:
      return undefined;
  }
};
