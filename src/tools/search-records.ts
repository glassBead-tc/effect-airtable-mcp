import { Effect } from "effect";
import axios, { AxiosInstance } from "axios";
import {
  SearchRecordsInputSchema,
  SearchRecordsOutputSchema,
  type SearchRecordsInput,
  type SearchRecordsOutput,
} from "../schemas/index.js";
import { ToolExecutor } from "../execution/tool-executor.js";
import { AirtableApiError } from "../errors/tool-errors.js";

/**
 * Search Records Tool - Contract-driven implementation
 * 
 * Searches for records in an Airtable table using a filter formula.
 * Returns matching records.
 */

/**
 * Call Airtable API to search records
 */
function callAirtableApi(
  axiosInstance: AxiosInstance
): (input: SearchRecordsInput) => Effect.Effect<unknown, AirtableApiError> {
  return (input: SearchRecordsInput) =>
    Effect.tryPromise({
      try: async () => {
        const response = await axiosInstance.get(`/${input.base_id}/${input.table_name}`, {
          params: {
            filterByFormula: `{${input.field_name}} = "${input.value}"`,
          },
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
              field_name: input.field_name,
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
 * Create and configure the ToolExecutor for search_records
 */
export function searchRecordsExecutor(axiosInstance: AxiosInstance): ToolExecutor<
  SearchRecordsInput,
  SearchRecordsOutput,
  AirtableApiError
> {
  return new ToolExecutor({
    name: "search_records",
    inputSchema: SearchRecordsInputSchema,
    outputSchema: SearchRecordsOutputSchema,
    operation: callAirtableApi(axiosInstance),
    // No postconditions for read-only search operation
  });
}
