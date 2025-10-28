import { Effect } from "effect";
import axios, { AxiosInstance } from "axios";
import {
  GetRecordInputSchema,
  GetRecordOutputSchema,
  type GetRecordInput,
  type GetRecordOutput,
} from "../schemas/index.js";
import { ToolExecutor } from "../execution/tool-executor.js";
import { AirtableApiError } from "../errors/tool-errors.js";

/**
 * Get Record Tool - Contract-driven implementation
 *
 * Retrieves a single record by ID from an Airtable table.
 * This is a read-only operation with no postconditions.
 */

/**
 * Call Airtable API to get a specific record
 */
function callAirtableApi(
  axiosInstance: AxiosInstance
): (input: GetRecordInput) => Effect.Effect<unknown, AirtableApiError> {
  return (input: GetRecordInput) =>
    Effect.tryPromise({
      try: async () => {
        const response = await axiosInstance.get(
          `/${input.base_id}/${input.table_name}/${input.record_id}`
        );
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
              record_id: input.record_id,
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
 * Create and configure the ToolExecutor for get_record
 */
export function getRecordExecutor(
  axiosInstance: AxiosInstance
): ToolExecutor<GetRecordInput, GetRecordOutput, AirtableApiError> {
  return new ToolExecutor({
    name: "get_record",
    inputSchema: GetRecordInputSchema,
    outputSchema: GetRecordOutputSchema,
    operation: callAirtableApi(axiosInstance),
    // No postconditions for read-only operation
  });
}
