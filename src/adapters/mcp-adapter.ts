import { Effect } from "effect";
import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";
import {
  InputValidationError,
  OutputValidationError,
  AirtableApiError,
  PostconditionError,
  type ToolError,
} from "../errors/tool-errors.js";

/**
 * MCP Adapter - Bridges Effect-based tool execution to MCP protocol
 *
 * Converts:
 * - Effect<Output, ToolError> → MCP ToolResponse
 * - ToolError → McpError with appropriate error codes
 *
 * This adapter isolates Effect concerns from MCP protocol details,
 * making tool implementations pure and testable.
 */

/**
 * MCP tool response format (matching SDK CallToolResult)
 */
interface MCPToolResponse {
  content: Array<{
    type: "text" | "image" | "resource";
    text?: string;
    data?: string;
    mimeType?: string;
  }>;
  isError?: boolean;
}

/**
 * Map ToolError to appropriate MCP error code and message
 */
function mapToolErrorToMcpError(error: ToolError): McpError {
  switch (error._tag) {
    case "InputValidationError": {
      const issueMessages = error.issues.map(
        (issue) => `${issue.path.join(".")}: ${issue.message}`
      );
      return new McpError(
        ErrorCode.InvalidParams,
        `Input validation failed for ${error.toolName}: ${issueMessages.join(", ")}`,
        {
          toolName: error.toolName,
          issues: error.issues,
          context: error.context,
        }
      );
    }

    case "OutputValidationError": {
      const issueMessages = error.issues.map(
        (issue) => `${issue.path.join(".")}: ${issue.message}`
      );
      return new McpError(
        ErrorCode.InternalError,
        `Output validation failed for ${error.toolName}: ${issueMessages.join(", ")}. This may indicate an API schema change.`,
        {
          toolName: error.toolName,
          issues: error.issues,
        }
      );
    }

    case "AirtableApiError": {
      // Map HTTP status codes to MCP error codes
      let code = ErrorCode.InternalError;
      if (error.statusCode) {
        if (error.statusCode === 400 || error.statusCode === 404) {
          code = ErrorCode.InvalidParams;
        } else if (error.statusCode === 401 || error.statusCode === 403) {
          code = ErrorCode.InvalidRequest;
        } else if (error.statusCode === 429) {
          // Rate limit - treat as internal for now, could be specialized
          code = ErrorCode.InternalError;
        }
      }

      return new McpError(code, `Airtable API error: ${error.message}`, {
        statusCode: error.statusCode,
        context: error.context,
      });
    }

    case "PostconditionError": {
      return new McpError(
        ErrorCode.InternalError,
        `Postcondition failed for ${error.toolName}: ${error.condition}`,
        {
          toolName: error.toolName,
          condition: error.condition,
          actualState: error.actualState,
        }
      );
    }

    default: {
      // Exhaustiveness check - TypeScript will error if we miss a case
      const _exhaustive: never = error;
      return new McpError(
        ErrorCode.InternalError,
        `Unknown error type: ${(_exhaustive as ToolError)._tag}`
      );
    }
  }
}

/**
 * Run Effect-based tool and convert result to MCP response
 *
 * Handles:
 * - Success: Serialize output as JSON text content
 * - Failure: Convert ToolError to McpError with appropriate code
 *
 * @param effect - Effect workflow to execute
 * @returns Promise of MCP tool response
 * @throws McpError on failure
 *
 * @example
 * ```typescript
 * case "create_record": {
 *   return await runToolEffect(
 *     executor.execute(request.params.arguments)
 *   );
 * }
 * ```
 */
export async function runToolEffect<O>(effect: Effect.Effect<O, ToolError>) {
  const result = await Effect.runPromise(
    Effect.either(effect) // Convert to Either for error handling
  );

  if (result._tag === "Left") {
    // Effect failed - convert to MCP error
    throw mapToolErrorToMcpError(result.left);
  }

  // Effect succeeded - serialize output
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(result.right, null, 2),
      },
    ],
  };
}
