import { Effect, Data, pipe } from "effect";
import { z } from "zod";
import axios, { AxiosInstance } from "axios";
import {
  CreateRecordInputSchema,
  CreateRecordOutputSchema,
  type CreateRecordInput,
  type CreateRecordOutput,
} from "../schemas/index.js";

/**
 * Proof of Concept: Contract-Driven Tool Execution
 * 
 * This demonstrates the full stack for create_record operation:
 * 1. Runtime input validation with Zod
 * 2. Effect-TS workflow with typed errors
 * 3. Output validation before returning to model
 * 4. Type safety from input → API → output
 * 
 * Pattern can be generalized to all tools via ToolExecutor abstraction.
 */

// ============================================================================
// Error Types (Phase 2: Error Architecture)
// ============================================================================

export class InputValidationError extends Data.TaggedError("InputValidationError")<{
  toolName: string;
  issues: z.ZodIssue[];
  context?: Record<string, unknown>;
}> {}

export class OutputValidationError extends Data.TaggedError("OutputValidationError")<{
  toolName: string;
  issues: z.ZodIssue[];
  rawOutput: unknown;
}> {}

export class AirtableApiError extends Data.TaggedError("AirtableApiError")<{
  statusCode?: number;
  message: string;
  cause?: unknown;
  context?: Record<string, unknown>;
}> {}

export class PostconditionError extends Data.TaggedError("PostconditionError")<{
  toolName: string;
  condition: string;
  actualState: unknown;
}> {}

type CreateRecordError =
  | InputValidationError
  | OutputValidationError
  | AirtableApiError
  | PostconditionError;

// ============================================================================
// Validation Functions
// ============================================================================

/**
 * Validate input against Zod schema
 */
const validateInput = (
  rawInput: unknown
): Effect.Effect<CreateRecordInput, InputValidationError> =>
  Effect.try({
    try: () => CreateRecordInputSchema.parse(rawInput),
    catch: (error) =>
      new InputValidationError({
        toolName: "create_record",
        issues: (error as z.ZodError).issues,
        context: { rawInput },
      }),
  });

/**
 * Validate output against Zod schema
 */
const validateOutput = (
  rawOutput: unknown
): Effect.Effect<CreateRecordOutput, OutputValidationError> =>
  Effect.try({
    try: () => CreateRecordOutputSchema.parse(rawOutput),
    catch: (error) =>
      new OutputValidationError({
        toolName: "create_record",
        issues: (error as z.ZodError).issues,
        rawOutput,
      }),
  });

// ============================================================================
// API Interaction
// ============================================================================

/**
 * Call Airtable API to create record
 */
const callAirtableApi =
  (axiosInstance: AxiosInstance) =>
  (input: CreateRecordInput): Effect.Effect<unknown, AirtableApiError> =>
    Effect.tryPromise({
      try: async () => {
        const response = await axiosInstance.post(
          `/${input.base_id}/${input.table_name}`,
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
            },
          });
        }
        return new AirtableApiError({
          message: "Unknown error during API call",
          cause: error,
        });
      },
    });

// ============================================================================
// Postcondition Checks
// ============================================================================

/**
 * Verify record was actually created (has ID and createdTime)
 */
const checkPostconditions = (
  output: CreateRecordOutput
): Effect.Effect<void, PostconditionError> => {
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
};

// ============================================================================
// Main Execution Workflow
// ============================================================================

/**
 * Execute create_record with full contract validation
 * 
 * Flow:
 * 1. Validate raw input → CreateRecordInput
 * 2. Call Airtable API
 * 3. Validate raw output → CreateRecordOutput
 * 4. Check postconditions (record exists)
 * 5. Return typed result
 * 
 * @param rawInput - Unvalidated input from MCP tool call
 * @param axiosInstance - Configured Axios instance for Airtable API
 * @returns Effect that produces validated output or typed error
 */
export const executeCreateRecord = (
  rawInput: unknown,
  axiosInstance: AxiosInstance
): Effect.Effect<CreateRecordOutput, CreateRecordError> =>
  pipe(
    validateInput(rawInput),
    Effect.flatMap(callAirtableApi(axiosInstance)),
    Effect.flatMap(validateOutput),
    Effect.tap(checkPostconditions)
  );

// ============================================================================
// Usage Example (for reference)
// ============================================================================

/*
import axios from "axios";

const axiosInstance = axios.create({
  baseURL: "https://api.airtable.com/v0",
  headers: {
    Authorization: `Bearer ${process.env.AIRTABLE_API_KEY}`,
  },
});

const rawInput = {
  base_id: "appXXXXXXXXXXXXXX",
  table_name: "Tasks",
  fields: {
    Name: "Test Task",
    Status: "In Progress",
    Priority: 5,
  },
};

// Execute with Effect runtime
const program = executeCreateRecord(rawInput, axiosInstance);

// Run and handle errors
Effect.runPromise(program)
  .then((result) => console.log("Success:", result))
  .catch((error) => {
    // Error is typed union: InputValidationError | OutputValidationError | AirtableApiError | PostconditionError
    console.error("Error:", error);
  });
*/
