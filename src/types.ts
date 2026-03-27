// Field type definitions for Airtable

export type FieldType =
  | "singleLineText"
  | "multilineText"
  | "number"
  | "singleSelect"
  | "multiSelect"
  | "date"
  | "checkbox"
  | "email"
  | "phoneNumber"
  | "currency";

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
  | SelectFieldOptions;

export interface FieldOption {
  name: string;
  type: FieldType;
  description?: string;
  options?: FieldOptions;
}

export const fieldRequiresOptions = (type: FieldType): boolean => {
  switch (type) {
    case "number":
    case "singleSelect":
    case "multiSelect":
    case "date":
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
    case "currency":
      return { precision: 2, symbol: "$" };
    case "singleSelect":
    case "multiSelect":
      return { choices: [] };
    default:
      return undefined;
  }
};
