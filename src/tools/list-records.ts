import { Effect } from "effect";
import axios, { AxiosInstance } from "axios";
import {
  ListRecordsInputSchema,
  ListRecordsOutputSchema,
  type ListRecordsInput,
  type ListRecordsOutput,
} from "../schemas/index.js";
import { ToolExecutor } from "../execution/tool-executor.js";
import { AirtableApiError } from "../errors/tool-errors.js";

/**
 * List Records Tool - Contract-driven implementation
 * 
 * Lists records from an Airtable table with optional filtering and pagination.
 * This is a read-only operation with no postconditions.
 */

/**
 * Call Airtable API to list records
 */
function callAirtableApi(
  axiosInstance: AxiosInstance
): (input: ListRecordsInput) => Effect.Effect<unknown, AirtableApiError> {
  return (input: ListRecordsInput) =>
    Effect.tryPromise({
      try: async () => {
        const params: Record<string, unknown> = {};
        
        if (input.max_records !== undefined && input.max_records > 0) {
          params.maxRecords = input.max_records;
        }
        
        const response = await axiosInstance.get(`/${input.base_id}/${input.table_name}`, {
          params: Object.keys(params).length > 0 ? params : undefined,
        });
        return response.data;
      },
      catch: (error) => {
        if (axios.isAxiosError(error)) {
          return new AirtableApiError({
            statusCode: error.response?.status,
            message: error.response?.data?.error?.message || error.message,
            cause: error,
            context: {
              base_id: input.base_id,
              table_name: input.table_name,
            },
          });
        }
        return new AirtableApiError({
          message: "Unknown error during API call",
          cause: error,
        });
      },
    });
}

/**
 * Create and configure the ToolExecutor for list_records
 */
export function listRecordsExecutor(axiosInstance: AxiosInstance): ToolExecutor<
  ListRecordsInput,
  ListRecordsOutput,
  AirtableApiError
> {
  return new ToolExecutor({
    name: "list_records",
    inputSchema: ListRecordsInputSchema,
    outputSchema: ListRecordsOutputSchema,
    operation: callAirtableApi(axiosInstance),
    // No postconditions for read-only operation
  });
}
