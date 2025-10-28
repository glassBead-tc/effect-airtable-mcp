import { z } from "zod";

/**
 * Field Schemas - Airtable Field entities with type-specific options
 * Source: Airtable Web API /meta/bases/{baseId}/tables/{tableId}/fields endpoint
 */

// Field type enum
export const FieldTypeSchema = z.enum([
  "singleLineText",
  "multilineText",
  "number",
  "singleSelect",
  "multiSelect",
  "date",
  "dateTime",
  "checkbox",
  "email",
  "phoneNumber",
  "currency",
  "percent",
  "url",
  "rating",
  "duration",
  "attachment",
  "barcode",
  "button",
  "formula",
  "rollup",
  "count",
  "lookup",
  "multipleLookupValues",
  "multipleRecordLinks",
  "multipleAttachments",
  "multipleCollaborators",
  "multipleSelects",
  "createdTime",
  "createdBy",
  "lastModifiedTime",
  "lastModifiedBy",
  "autoNumber",
]);

// Field option schemas for specific field types
export const NumberFieldOptionsSchema = z.object({
  precision: z.number().int().min(0).max(8).describe("Decimal precision (0-8)"),
});

export const CurrencyFieldOptionsSchema = z.object({
  precision: z.number().int().min(0).max(8).describe("Decimal precision (0-8)"),
  symbol: z.string().default("$").describe("Currency symbol"),
});

export const PercentFieldOptionsSchema = z.object({
  precision: z.number().int().min(0).max(8).describe("Decimal precision (0-8)"),
});

export const DateFieldOptionsSchema = z.object({
  dateFormat: z.object({
    name: z.enum(["local", "friendly", "us", "european", "iso"]).describe("Date format style"),
    format: z.string().optional().describe("Custom format string"),
  }),
  timeZone: z.string().optional().describe("IANA timezone identifier"),
});

export const DateTimeFieldOptionsSchema = z.object({
  dateFormat: z.object({
    name: z.enum(["local", "friendly", "us", "european", "iso"]),
    format: z.string().optional(),
  }),
  timeFormat: z.object({
    name: z.enum(["12hour", "24hour"]),
    format: z.string().optional(),
  }),
  timeZone: z.string().optional(),
});

export const SelectChoiceSchema = z.object({
  id: z.string().optional().describe("Choice ID (auto-generated if omitted)"),
  name: z.string().describe("Display text for the choice"),
  color: z
    .enum([
      "blueLight2",
      "cyanLight2",
      "tealLight2",
      "greenLight2",
      "yellowLight2",
      "orangeLight2",
      "redLight2",
      "pinkLight2",
      "purpleLight2",
      "grayLight2",
    ])
    .optional()
    .describe("Color for the choice"),
});

export const SingleSelectFieldOptionsSchema = z.object({
  choices: z.array(SelectChoiceSchema).describe("Available choices"),
});

export const MultiSelectFieldOptionsSchema = z.object({
  choices: z.array(SelectChoiceSchema).describe("Available choices"),
});

export const RatingFieldOptionsSchema = z.object({
  max: z.number().int().min(1).max(10).describe("Maximum rating value (1-10)"),
  icon: z.enum(["star", "heart", "thumbsUp", "flag", "dot"]).describe("Rating icon"),
  color: z
    .enum(["yellowBright", "orangeBright", "redBright", "pinkBright", "purpleBright"])
    .describe("Rating color"),
});

export const DurationFieldOptionsSchema = z.object({
  durationFormat: z
    .enum(["h:mm", "h:mm:ss", "h:mm:ss.S", "h:mm:ss.SS", "h:mm:ss.SSS"])
    .describe("Duration format string"),
});

// Discriminated union for all field options
export const FieldOptionsSchema = z.union([
  NumberFieldOptionsSchema,
  CurrencyFieldOptionsSchema,
  PercentFieldOptionsSchema,
  DateFieldOptionsSchema,
  DateTimeFieldOptionsSchema,
  SingleSelectFieldOptionsSchema,
  MultiSelectFieldOptionsSchema,
  RatingFieldOptionsSchema,
  DurationFieldOptionsSchema,
]);

// Core field entity schema
export const FieldSchema = z.object({
  id: z.string().describe("Unique field identifier (e.g., 'fldXXXXXXXXXXXXXX')"),
  name: z.string().describe("Field name"),
  type: FieldTypeSchema,
  description: z.string().optional().describe("Field description"),
  options: FieldOptionsSchema.optional().describe("Type-specific field options"),
});

// Field ID schema with validation
export const FieldIdSchema = z
  .string()
  .regex(/^fld[a-zA-Z0-9]{14}$/, "Field ID must be in format 'fldXXXXXXXXXXXXXX'");

// Input schemas for field operations
export const CreateFieldInputSchema = z.object({
  base_id: z.string().describe("Base ID"),
  table_id: z.string().describe("Table ID"),
  field: z.object({
    name: z.string().describe("Field name"),
    type: FieldTypeSchema,
    description: z.string().optional(),
    options: FieldOptionsSchema.optional(),
  }),
});

export const UpdateFieldInputSchema = z.object({
  base_id: z.string().describe("Base ID"),
  table_id: z.string().describe("Table ID"),
  field_id: z.string().describe("Field ID to update"),
  updates: z.object({
    name: z.string().optional().describe("New field name"),
    description: z.string().optional().describe("New description"),
    options: FieldOptionsSchema.optional().describe("Updated field options"),
  }),
});

// Output schemas
export const CreateFieldOutputSchema = FieldSchema;
export const UpdateFieldOutputSchema = FieldSchema;

// Helper schema for field value validation
export const FieldValueSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.array(z.string()),
  z.null(),
]);

// Derived TypeScript types
export type FieldType = z.infer<typeof FieldTypeSchema>;
export type Field = z.infer<typeof FieldSchema>;
export type FieldId = z.infer<typeof FieldIdSchema>;
export type FieldOptions = z.infer<typeof FieldOptionsSchema>;
export type NumberFieldOptions = z.infer<typeof NumberFieldOptionsSchema>;
export type CurrencyFieldOptions = z.infer<typeof CurrencyFieldOptionsSchema>;
export type PercentFieldOptions = z.infer<typeof PercentFieldOptionsSchema>;
export type DateFieldOptions = z.infer<typeof DateFieldOptionsSchema>;
export type DateTimeFieldOptions = z.infer<typeof DateTimeFieldOptionsSchema>;
export type SelectChoice = z.infer<typeof SelectChoiceSchema>;
export type SingleSelectFieldOptions = z.infer<typeof SingleSelectFieldOptionsSchema>;
export type MultiSelectFieldOptions = z.infer<typeof MultiSelectFieldOptionsSchema>;
export type RatingFieldOptions = z.infer<typeof RatingFieldOptionsSchema>;
export type DurationFieldOptions = z.infer<typeof DurationFieldOptionsSchema>;
export type FieldValue = z.infer<typeof FieldValueSchema>;
export type CreateFieldInput = z.infer<typeof CreateFieldInputSchema>;
export type UpdateFieldInput = z.infer<typeof UpdateFieldInputSchema>;
export type CreateFieldOutput = z.infer<typeof CreateFieldOutputSchema>;
export type UpdateFieldOutput = z.infer<typeof UpdateFieldOutputSchema>;
