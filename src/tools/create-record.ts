import { Effect } from "effect";
import axios, { AxiosInstance } from "axios";
import {
  CreateRecordInputSchema,
  CreateRecordOutputSchema,
  type CreateRecordInput,
  type CreateRecordOutput,
} from "../schemas/index.js";
import { ToolExecutor } from "../execution/tool-executor.js";
import { AirtableApiError, PostconditionError } from "../errors/tool-errors.js";

/**
 * Create Record Tool - Contract-driven implementation
 *
 * Demonstrates the ToolExecutor pattern:
 * - Input validation via Zod schema
 * - Typed API operation
 * - Output validation
 * - Postcondition checks
 */

/**
 * Call Airtable API to create a record
 */
function callAirtableApi(
  axiosInstance: AxiosInstance
): (input: CreateRecordInput) => Effect.Effect<unknown, AirtableApiError> {
  return (input: CreateRecordInput) =>
    Effect.tryPromise({
      try: async () => {
        const response = await axiosInstance.post(`/${input.base_id}/${input.table_name}`, {
          fields: input.fields,
          typecast: input.typecast,
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
 * Verify record was actually created (has ID and createdTime)
 */
function checkRecordExists(output: CreateRecordOutput): Effect.Effect<void, PostconditionError> {
  if (!output.id || !output.createdTime) {
    return Effect.fail(
      new PostconditionError({
        toolName: "create_record",
        condition: "Record must have id and createdTime",
        actualState: output,
      })
    );
  }
  return Effect.succeed(void 0);
}

/**
 * Create and configure the ToolExecutor for create_record
 *
 * @param axiosInstance - Configured Axios instance for Airtable API
 * @returns Configured ToolExecutor ready for execution
 */
export function createRecordExecutor(axiosInstance: AxiosInstance): ToolExecutor<
  CreateRecordInput,
  CreateRecordOutput,
  AirtableApiError
> {
  return new ToolExecutor({
    name: "create_record",
    inputSchema: CreateRecordInputSchema,
    outputSchema: CreateRecordOutputSchema,
    operation: callAirtableApi(axiosInstance),
    postconditions: [checkRecordExists],
  });
}
