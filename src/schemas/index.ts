/**
 * Schemas - Centralized Zod schema exports
 *
 * This module provides runtime-validated schemas and TypeScript types
 * for all Airtable API operations. Schemas serve as the authoritative
 * contracts between the API and our application.
 *
 * Organization:
 * - bases.ts: Base entities and operations
 * - tables.ts: Table entities, views, and operations
 * - fields.ts: Field types, options, and operations
 * - records.ts: Record entities and CRUD operations
 */

// Base schemas
export {
  BaseSchema,
  BaseIdSchema,
  ListBasesInputSchema,
  ListBasesOutputSchema,
  type Base,
  type BaseId,
  type ListBasesInput,
  type ListBasesOutput,
} from "./bases.js";

// Table schemas
export {
  TableSchema,
  TableIdSchema,
  ViewSchema,
  ListTablesInputSchema,
  CreateTableInputSchema,
  UpdateTableInputSchema,
  ListTablesOutputSchema,
  CreateTableOutputSchema,
  UpdateTableOutputSchema,
  type Table,
  type TableId,
  type View,
  type ListTablesInput,
  type CreateTableInput,
  type UpdateTableInput,
  type ListTablesOutput,
  type CreateTableOutput,
  type UpdateTableOutput,
} from "./tables.js";

// Field schemas
export {
  FieldSchema,
  FieldIdSchema,
  FieldTypeSchema,
  FieldOptionsSchema,
  FieldValueSchema,
  NumberFieldOptionsSchema,
  CurrencyFieldOptionsSchema,
  PercentFieldOptionsSchema,
  DateFieldOptionsSchema,
  DateTimeFieldOptionsSchema,
  SingleSelectFieldOptionsSchema,
  MultiSelectFieldOptionsSchema,
  RatingFieldOptionsSchema,
  DurationFieldOptionsSchema,
  SelectChoiceSchema,
  CreateFieldInputSchema,
  UpdateFieldInputSchema,
  CreateFieldOutputSchema,
  UpdateFieldOutputSchema,
  type Field,
  type FieldId,
  type FieldType,
  type FieldOptions,
  type FieldValue,
  type NumberFieldOptions,
  type CurrencyFieldOptions,
  type PercentFieldOptions,
  type DateFieldOptions,
  type DateTimeFieldOptions,
  type SingleSelectFieldOptions,
  type MultiSelectFieldOptions,
  type RatingFieldOptions,
  type DurationFieldOptions,
  type SelectChoice,
  type CreateFieldInput,
  type UpdateFieldInput,
  type CreateFieldOutput,
  type UpdateFieldOutput,
} from "./fields.js";

// Record schemas
export {
  RecordSchema,
  RecordIdSchema,
  ListRecordsInputSchema,
  CreateRecordInputSchema,
  UpdateRecordInputSchema,
  DeleteRecordInputSchema,
  GetRecordInputSchema,
  SearchRecordsInputSchema,
  ListRecordsOutputSchema,
  CreateRecordOutputSchema,
  UpdateRecordOutputSchema,
  DeleteRecordOutputSchema,
  GetRecordOutputSchema,
  SearchRecordsOutputSchema,
  CreateRecordsInputSchema,
  CreateRecordsOutputSchema,
  UpdateRecordsInputSchema,
  UpdateRecordsOutputSchema,
  DeleteRecordsInputSchema,
  DeleteRecordsOutputSchema,
  type Record,
  type RecordId,
  type ListRecordsInput,
  type CreateRecordInput,
  type UpdateRecordInput,
  type DeleteRecordInput,
  type GetRecordInput,
  type SearchRecordsInput,
  type ListRecordsOutput,
  type CreateRecordOutput,
  type UpdateRecordOutput,
  type DeleteRecordOutput,
  type GetRecordOutput,
  type SearchRecordsOutput,
  type CreateRecordsInput,
  type CreateRecordsOutput,
  type UpdateRecordsInput,
  type UpdateRecordsOutput,
  type DeleteRecordsInput,
  type DeleteRecordsOutput,
} from "./records.js";
