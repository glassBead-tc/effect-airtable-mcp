import { Effect } from "effect";
import axios, { AxiosInstance } from "axios";
import {
  UpdateRecordInputSchema,
  UpdateRecordOutputSchema,
  type UpdateRecordInput,
  type UpdateRecordOutput,
} from "../schemas/index.js";
import { ToolExecutor } from "../execution/tool-executor.js";
import { AirtableApiError } from "../errors/tool-errors.js";

/**
 * Update Record Tool - Contract-driven implementation
 * 
 * Updates an existing record in an Airtable table.
 * Returns the updated record with all fields.
 */

/**
 * Call Airtable API to update a record
 */
function callAirtableApi(
  axiosInstance: AxiosInstance
): (input: UpdateRecordInput) => Effect.Effect<unknown, AirtableApiError> {
  return (input: UpdateRecordInput) =>
    Effect.tryPromise({
      try: async () => {
        const response = await axiosInstance.patch(
          `/${input.base_id}/${input.table_name}/${input.record_id}`,
          {
            fields: input.fields,
            typecast: input.typecast,
          }
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
 * Create and configure the ToolExecutor for update_record
 */
export function updateRecordExecutor(axiosInstance: AxiosInstance): ToolExecutor<
  UpdateRecordInput,
  UpdateRecordOutput,
  AirtableApiError
> {
  return new ToolExecutor({
    name: "update_record",
    inputSchema: UpdateRecordInputSchema,
    outputSchema: UpdateRecordOutputSchema,
    operation: callAirtableApi(axiosInstance),
    // No postconditions - update returns full validated record
  });
}
