import { Effect } from "effect";
import axios, { AxiosInstance } from "axios";
import {
  UpdateFieldInputSchema,
  UpdateFieldOutputSchema,
  type UpdateFieldInput,
  type UpdateFieldOutput,
} from "../schemas/index.js";
import { ToolExecutor } from "../execution/tool-executor.js";
import { AirtableApiError } from "../errors/tool-errors.js";

/**
 * Update Field Tool - Contract-driven implementation
 * 
 * Updates field metadata (name, description, and/or options) in an Airtable table.
 * Returns the updated field structure.
 */

/**
 * Call Airtable API to update field metadata
 */
function callAirtableApi(
  axiosInstance: AxiosInstance
): (input: UpdateFieldInput) => Effect.Effect<unknown, AirtableApiError> {
  return (input: UpdateFieldInput) =>
    Effect.tryPromise({
      try: async () => {
        const response = await axiosInstance.patch(
          `/meta/bases/${input.base_id}/tables/${input.table_id}/fields/${input.field_id}`,
          input.updates
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
              field_id: input.field_id,
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
 * Create and configure the ToolExecutor for update_field
 */
export function updateFieldExecutor(axiosInstance: AxiosInstance): ToolExecutor<
  UpdateFieldInput,
  UpdateFieldOutput,
  AirtableApiError
> {
  return new ToolExecutor({
    name: "update_field",
    inputSchema: UpdateFieldInputSchema,
    outputSchema: UpdateFieldOutputSchema,
    operation: callAirtableApi(axiosInstance),
    // No postconditions - update returns full validated field
  });
}
