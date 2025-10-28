import { Effect } from "effect";
import axios, { AxiosInstance } from "axios";
import {
  UpdateTableInputSchema,
  UpdateTableOutputSchema,
  type UpdateTableInput,
  type UpdateTableOutput,
} from "../schemas/index.js";
import { ToolExecutor } from "../execution/tool-executor.js";
import { AirtableApiError } from "../errors/tool-errors.js";

/**
 * Update Table Tool - Contract-driven implementation
 * 
 * Updates table metadata (name and/or description) in an Airtable base.
 * Returns the updated table structure with all fields and views.
 */

/**
 * Call Airtable API to update table metadata
 */
function callAirtableApi(
  axiosInstance: AxiosInstance
): (input: UpdateTableInput) => Effect.Effect<unknown, AirtableApiError> {
  return (input: UpdateTableInput) =>
    Effect.tryPromise({
      try: async () => {
        const updates: { name?: string; description?: string } = {};
        if (input.name) updates.name = input.name;
        if (input.description) updates.description = input.description;

        const response = await axiosInstance.patch(
          `/meta/bases/${input.base_id}/tables/${input.table_id}`,
          updates
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
              table_id: input.table_id,
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
 * Create and configure the ToolExecutor for update_table
 */
export function updateTableExecutor(axiosInstance: AxiosInstance): ToolExecutor<
  UpdateTableInput,
  UpdateTableOutput,
  AirtableApiError
> {
  return new ToolExecutor({
    name: "update_table",
    inputSchema: UpdateTableInputSchema,
    outputSchema: UpdateTableOutputSchema,
    operation: callAirtableApi(axiosInstance),
    // No postconditions - update returns full validated table
  });
}
