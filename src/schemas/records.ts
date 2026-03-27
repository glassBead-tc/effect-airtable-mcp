import { z } from "zod";
import { FieldValueSchema } from "./fields.js";

/**
 * Record Schemas - Airtable Record entities and operations
 * Source: Airtable Web API /{baseId}/{tableIdOrName} endpoint
 */

// Core record entity schema
export const RecordSchema = z.object({
  id: z.string().describe("Unique record identifier (e.g., 'recXXXXXXXXXXXXXX')"),
  createdTime: z.string().datetime().describe("ISO 8601 timestamp of record creation"),
  fields: z.record(z.string(), FieldValueSchema).describe("Record field values as key-value pairs"),
});

// Record ID schema with validation
export const RecordIdSchema = z
  .string()
  .regex(/^rec[a-zA-Z0-9]{14}$/, "Record ID must be in format 'recXXXXXXXXXXXXXX'");

// Input schemas for record operations
export const ListRecordsInputSchema = z.object({
  base_id: z.string().describe("Base ID"),
  table_name: z.string().describe("Table name or ID"),
  max_records: z
    .number()
    .int()
    .positive()
    .optional()
    .describe("Maximum number of records to return"),
  view: z.string().optional().describe("View name or ID to filter by"),
  fields: z.array(z.string()).optional().describe("Specific fields to return"),
  filter_by_formula: z.string().optional().describe("Airtable formula to filter records"),
  sort: z
    .array(
      z.object({
        field: z.string().describe("Field name to sort by"),
        direction: z.enum(["asc", "desc"]).describe("Sort direction"),
      })
    )
    .optional()
    .describe("Sort configuration"),
  page_size: z.number().int().min(1).max(100).optional().describe("Number of records per page"),
  offset: z.string().optional().describe("Pagination offset token"),
  cell_format: z
    .enum(["json", "string"])
    .optional()
    .describe("Response format for cell values: 'json' (default) or 'string'"),
  time_zone: z
    .string()
    .optional()
    .describe("Time zone for 'string' cell format (e.g., 'America/New_York')"),
  user_locale: z
    .string()
    .optional()
    .describe("User locale for 'string' cell format (e.g., 'en-us')"),
});

export const CreateRecordInputSchema = z.object({
  base_id: z.string().describe("Base ID"),
  table_name: z.string().describe("Table name or ID"),
  fields: z.record(z.string(), FieldValueSchema).describe("Record field values"),
  typecast: z
    .boolean()
    .optional()
    .default(false)
    .describe("Automatically convert field values to correct types"),
});

export const UpdateRecordInputSchema = z.object({
  base_id: z.string().describe("Base ID"),
  table_name: z.string().describe("Table name or ID"),
  record_id: z.string().describe("Record ID to update"),
  fields: z.record(z.string(), FieldValueSchema).describe("Fields to update"),
  typecast: z.boolean().optional().default(false).describe("Automatically convert field values"),
});

export const DeleteRecordInputSchema = z.object({
  base_id: z.string().describe("Base ID"),
  table_name: z.string().describe("Table name or ID"),
  record_id: z.string().describe("Record ID to delete"),
});

export const GetRecordInputSchema = z.object({
  base_id: z.string().describe("Base ID"),
  table_name: z.string().describe("Table name or ID"),
  record_id: z.string().describe("Record ID to retrieve"),
});

export const SearchRecordsInputSchema = z.object({
  base_id: z.string().describe("Base ID"),
  table_name: z.string().describe("Table name or ID"),
  field_name: z.string().describe("Field name to search in"),
  value: z.string().describe("Value to search for"),
});

// Output schemas
export const ListRecordsOutputSchema = z.object({
  records: z.array(RecordSchema),
  offset: z.string().optional().describe("Pagination offset for next page"),
});

export const CreateRecordOutputSchema = RecordSchema;
export const UpdateRecordOutputSchema = RecordSchema;
export const GetRecordOutputSchema = RecordSchema;
export const SearchRecordsOutputSchema = z.object({
  records: z.array(RecordSchema),
});

export const DeleteRecordOutputSchema = z.object({
  deleted: z.boolean(),
  id: z.string(),
});

// Batch create
export const CreateRecordsInputSchema = z.object({
  base_id: z.string().describe("Base ID"),
  table_name: z.string().describe("Table name or ID"),
  records: z
    .array(
      z.object({
        fields: z.record(z.string(), FieldValueSchema).describe("Record field values"),
      })
    )
    .min(1)
    .max(10)
    .describe("Array of records to create (1-10)"),
  typecast: z.boolean().optional().default(false).describe("Automatically convert field values"),
});

export const CreateRecordsOutputSchema = z.object({
  records: z.array(RecordSchema),
});

// Batch update (with upsert)
export const UpdateRecordsInputSchema = z.object({
  base_id: z.string().describe("Base ID"),
  table_name: z.string().describe("Table name or ID"),
  records: z
    .array(
      z.object({
        id: z.string().optional().describe("Record ID (required for update, omit for upsert)"),
        fields: z.record(z.string(), FieldValueSchema).describe("Fields to update"),
      })
    )
    .min(1)
    .max(10)
    .describe("Array of records to update (1-10)"),
  perform_upsert: z
    .object({
      fields_to_merge_on: z
        .array(z.string())
        .min(1)
        .max(3)
        .describe("Field names to match on for upsert"),
    })
    .optional()
    .describe("If set, performs upsert instead of update"),
  typecast: z.boolean().optional().default(false).describe("Automatically convert field values"),
});

export const UpdateRecordsOutputSchema = z.object({
  records: z.array(RecordSchema),
});

// Batch delete
export const DeleteRecordsInputSchema = z.object({
  base_id: z.string().describe("Base ID"),
  table_name: z.string().describe("Table name or ID"),
  record_ids: z.array(z.string()).min(1).max(10).describe("Array of record IDs to delete (1-10)"),
});

export const DeleteRecordsOutputSchema = z.object({
  records: z.array(
    z.object({
      id: z.string(),
      deleted: z.boolean(),
    })
  ),
});

export type CreateRecordsInput = z.infer<typeof CreateRecordsInputSchema>;
export type CreateRecordsOutput = z.infer<typeof CreateRecordsOutputSchema>;
export type UpdateRecordsInput = z.infer<typeof UpdateRecordsInputSchema>;
export type UpdateRecordsOutput = z.infer<typeof UpdateRecordsOutputSchema>;
export type DeleteRecordsInput = z.infer<typeof DeleteRecordsInputSchema>;
export type DeleteRecordsOutput = z.infer<typeof DeleteRecordsOutputSchema>;

// Derived TypeScript types
export type Record = z.infer<typeof RecordSchema>;
export type RecordId = z.infer<typeof RecordIdSchema>;
export type ListRecordsInput = z.infer<typeof ListRecordsInputSchema>;
export type CreateRecordInput = z.infer<typeof CreateRecordInputSchema>;
export type UpdateRecordInput = z.infer<typeof UpdateRecordInputSchema>;
export type DeleteRecordInput = z.infer<typeof DeleteRecordInputSchema>;
export type GetRecordInput = z.infer<typeof GetRecordInputSchema>;
export type SearchRecordsInput = z.infer<typeof SearchRecordsInputSchema>;
export type ListRecordsOutput = z.infer<typeof ListRecordsOutputSchema>;
export type CreateRecordOutput = z.infer<typeof CreateRecordOutputSchema>;
export type UpdateRecordOutput = z.infer<typeof UpdateRecordOutputSchema>;
export type DeleteRecordOutput = z.infer<typeof DeleteRecordOutputSchema>;
export type GetRecordOutput = z.infer<typeof GetRecordOutputSchema>;
export type SearchRecordsOutput = z.infer<typeof SearchRecordsOutputSchema>;
