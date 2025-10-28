import { Effect } from "effect";
import axios, { AxiosInstance } from "axios";
import {
  ListTablesInputSchema,
  ListTablesOutputSchema,
  type ListTablesInput,
  type ListTablesOutput,
} from "../schemas/index.js";
import { ToolExecutor } from "../execution/tool-executor.js";
import { AirtableApiError } from "../errors/tool-errors.js";

/**
 * List Tables Tool - Contract-driven implementation
 * 
 * Lists all tables in a specified Airtable base.
 * This is a read-only operation with no postconditions.
 */

/**
 * Call Airtable API to list tables in a base
 */
function callAirtableApi(
  axiosInstance: AxiosInstance
): (input: ListTablesInput) => Effect.Effect<unknown, AirtableApiError> {
  return (input: ListTablesInput) =>
    Effect.tryPromise({
      try: async () => {
        const response = await axiosInstance.get(`/meta/bases/${input.base_id}/tables`);
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
 * Create and configure the ToolExecutor for list_tables
 */
export function listTablesExecutor(axiosInstance: AxiosInstance): ToolExecutor<
  ListTablesInput,
  ListTablesOutput,
  AirtableApiError
> {
  return new ToolExecutor({
    name: "list_tables",
    inputSchema: ListTablesInputSchema,
    outputSchema: ListTablesOutputSchema,
    operation: callAirtableApi(axiosInstance),
    // No postconditions for read-only operation
  });
}
