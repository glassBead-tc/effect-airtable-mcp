import { Effect } from "effect";
import axios, { AxiosInstance } from "axios";
import {
  DeleteRecordInputSchema,
  DeleteRecordOutputSchema,
  type DeleteRecordInput,
  type DeleteRecordOutput,
} from "../schemas/index.js";
import { ToolExecutor } from "../execution/tool-executor.js";
import { AirtableApiError } from "../errors/tool-errors.js";

/**
 * Delete Record Tool - Contract-driven implementation
 *
 * Deletes a record from an Airtable table.
 * Returns confirmation of deletion with the deleted record ID.
 */

/**
 * Call Airtable API to delete a record
 */
function callAirtableApi(
  axiosInstance: AxiosInstance
): (input: DeleteRecordInput) => Effect.Effect<unknown, AirtableApiError> {
  return (input: DeleteRecordInput) =>
    Effect.tryPromise({
      try: async () => {
        const response = await axiosInstance.delete(
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
 * Create and configure the ToolExecutor for delete_record
 */
export function deleteRecordExecutor(
  axiosInstance: AxiosInstance
): ToolExecutor<DeleteRecordInput, DeleteRecordOutput, AirtableApiError> {
  return new ToolExecutor({
    name: "delete_record",
    inputSchema: DeleteRecordInputSchema,
    outputSchema: DeleteRecordOutputSchema,
    operation: callAirtableApi(axiosInstance),
    // No postconditions - delete confirmation is validated by schema
  });
}
