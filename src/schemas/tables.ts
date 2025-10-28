import { z } from "zod";
import { FieldSchema } from "./fields.js";

/**
 * Table Schemas - Airtable Table entities and operations
 * Source: Airtable Web API /meta/bases/{baseId}/tables endpoint
 */

// View entity schema
export const ViewSchema = z.object({
  id: z.string().describe("Unique view identifier (e.g., 'viwXXXXXXXXXXXXXX')"),
  name: z.string().describe("View name"),
  type: z
    .enum(["grid", "form", "calendar", "gallery", "kanban", "timeline", "gantt"])
    .describe("View type"),
});

// Core table entity schema
export const TableSchema = z.object({
  id: z.string().describe("Unique table identifier (e.g., 'tblXXXXXXXXXXXXXX')"),
  name: z.string().describe("Table name"),
  description: z.string().optional().describe("Table description"),
  primaryFieldId: z.string().describe("ID of the primary field"),
  fields: z.array(FieldSchema).describe("Array of field definitions"),
  views: z.array(ViewSchema).describe("Array of view definitions"),
});

// Table ID schema with validation
export const TableIdSchema = z
  .string()
  .regex(/^tbl[a-zA-Z0-9]{14}$/, "Table ID must be in format 'tblXXXXXXXXXXXXXX'");

// Input schemas for table operations
export const ListTablesInputSchema = z.object({
  base_id: z.string().describe("Base ID to list tables from"),
});

export const CreateTableInputSchema = z.object({
  base_id: z.string().describe("Base ID to create table in"),
  table_name: z.string().describe("Name for the new table"),
  description: z.string().optional().describe("Table description"),
  fields: z
    .array(
      z.object({
        name: z.string().describe("Field name"),
        type: z.string().describe("Field type"),
        description: z.string().optional().describe("Field description"),
        options: z.any().optional().describe("Field-specific options"),
      })
    )
    .optional()
    .describe("Initial fields for the table"),
});

export const UpdateTableInputSchema = z.object({
  base_id: z.string().describe("Base ID"),
  table_id: z.string().describe("Table ID to update"),
  name: z.string().optional().describe("New table name"),
  description: z.string().optional().describe("New table description"),
});

// Output schemas
export const ListTablesOutputSchema = z.object({
  tables: z.array(TableSchema),
});

export const CreateTableOutputSchema = TableSchema;
export const UpdateTableOutputSchema = TableSchema;

// Derived TypeScript types
export type View = z.infer<typeof ViewSchema>;
export type Table = z.infer<typeof TableSchema>;
export type TableId = z.infer<typeof TableIdSchema>;
export type ListTablesInput = z.infer<typeof ListTablesInputSchema>;
export type CreateTableInput = z.infer<typeof CreateTableInputSchema>;
export type UpdateTableInput = z.infer<typeof UpdateTableInputSchema>;
export type ListTablesOutput = z.infer<typeof ListTablesOutputSchema>;
export type CreateTableOutput = z.infer<typeof CreateTableOutputSchema>;
export type UpdateTableOutput = z.infer<typeof UpdateTableOutputSchema>;
