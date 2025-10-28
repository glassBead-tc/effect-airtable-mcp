import { Effect } from "effect";
import axios, { AxiosInstance } from "axios";
import {
  ListBasesInputSchema,
  ListBasesOutputSchema,
  type ListBasesOutput,
} from "../schemas/index.js";
import { ToolExecutor } from "../execution/tool-executor.js";
import { AirtableApiError } from "../errors/tool-errors.js";

/**
 * List Bases Tool - Contract-driven implementation
 *
 * Lists all Airtable bases the authenticated user has access to.
 * This is a read-only operation with no postconditions.
 */

/**
 * Call Airtable API to list accessible bases
 */
function callAirtableApi(
  axiosInstance: AxiosInstance
): () => Effect.Effect<unknown, AirtableApiError> {
  return () =>
    Effect.tryPromise({
      try: async () => {
        const response = await axiosInstance.get("/meta/bases");
        return response.data;
      },
      catch: (error) => {
        if (axios.isAxiosError(error)) {
          return new AirtableApiError({
            statusCode: error.response?.status,
            message: error.response?.data?.error?.message || error.message,
            cause: error,
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
 * Create and configure the ToolExecutor for list_bases
 */
export function listBasesExecutor(
  axiosInstance: AxiosInstance
): ToolExecutor<Record<string, never>, ListBasesOutput, AirtableApiError> {
  return new ToolExecutor({
    name: "list_bases",
    inputSchema: ListBasesInputSchema,
    outputSchema: ListBasesOutputSchema,
    operation: callAirtableApi(axiosInstance),
    // No postconditions for read-only operation
  });
}
