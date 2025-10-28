import { Data } from "effect";
import { z } from "zod";

/**
 * Tool Errors - Typed error hierarchy for contract-driven tool execution
 *
 * All errors extend Data.TaggedError for discriminated union support in Effect workflows.
 * Each error carries context to aid debugging and provide actionable feedback.
 */

/**
 * Input validation failed - the tool received invalid parameters
 *
 * Occurs when: Raw input doesn't match the tool's input schema
 * Resolution: Fix the input parameters to match the expected schema
 * MCP Error Code: InvalidParams
 */
export class InputValidationError extends Data.TaggedError("InputValidationError")<{
  toolName: string;
  issues: z.ZodIssue[];
  context?: Record<string, unknown>;
}> {}

/**
 * Output validation failed - the API returned unexpected data shape
 *
 * Occurs when: Airtable API response doesn't match expected output schema
 * Resolution: This indicates either schema drift or API change - investigate and update schema
 * MCP Error Code: InternalError
 */
export class OutputValidationError extends Data.TaggedError("OutputValidationError")<{
  toolName: string;
  issues: z.ZodIssue[];
  rawOutput: unknown;
}> {}

/**
 * Airtable API error - the API request failed
 *
 * Occurs when: HTTP request to Airtable fails (network, auth, rate limit, etc.)
 * Resolution: Check status code and message for specific issue
 * MCP Error Code: Varies by status (404 → InvalidParams, 500 → InternalError, etc.)
 */
export class AirtableApiError extends Data.TaggedError("AirtableApiError")<{
  statusCode?: number;
  message: string;
  cause?: unknown;
  context?: Record<string, unknown>;
}> {}

/**
 * Postcondition check failed - operation completed but violated business rule
 *
 * Occurs when: API returns success but response doesn't satisfy expected invariants
 * Example: create_record succeeded but returned record has no ID
 * Resolution: Investigate API behavior, may indicate partial failure
 * MCP Error Code: InternalError
 */
export class PostconditionError extends Data.TaggedError("PostconditionError")<{
  toolName: string;
  condition: string;
  actualState: unknown;
}> {}

/**
 * Union of all possible tool execution errors
 */
export type ToolError =
  | InputValidationError
  | OutputValidationError
  | AirtableApiError
  | PostconditionError;
