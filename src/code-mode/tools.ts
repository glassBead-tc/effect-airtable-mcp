import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Cause, Effect, type ConfigError, type ManagedRuntime } from "effect";
import { z } from "zod";
import type { AirtableClient } from "../airtable-client.js";
import type { AirtableError } from "../errors.js";
import { type Operation, searchCatalog } from "./operations.js";
import { executeSandbox, type CallToolFn } from "./sandbox.js";

export type AppRuntime = ManagedRuntime.ManagedRuntime<AirtableClient, ConfigError.ConfigError>;

function errorResult(text: string): {
  isError: true;
  content: Array<{ type: "text"; text: string }>;
} {
  return { isError: true, content: [{ type: "text", text }] };
}

function renderAirtableError(error: AirtableError): string {
  if (error._tag === "RateLimitError") {
    return `Rate limited by Airtable; retries exhausted (Retry-After: ${error.retryAfterSeconds}s)`;
  }
  const status =
    error.statusCode !== undefined && !error.message.includes(`HTTP ${error.statusCode}`)
      ? ` (HTTP ${error.statusCode})`
      : "";
  return `${error.message}${status}`;
}

export function registerCodeModeTools(
  server: McpServer,
  catalog: Operation[],
  runtime: AppRuntime
): void {
  // SEARCH TOOL
  server.tool(
    "search",
    `Search for available Airtable operations by keyword. Returns matching operations from a catalog of ${catalog.length} tools. Use detail="detailed" to see parameter schemas when you're ready to write code.`,
    {
      query: z
        .string()
        .describe("Keyword to search (e.g. 'record', 'table', 'field', 'base', 'delete')"),
      detail: z
        .enum(["brief", "detailed"])
        .optional()
        .describe("'brief' (default) = name + description, 'detailed' = includes parameters"),
    },
    ({ query, detail }) => {
      const results = searchCatalog(catalog, query, detail ?? "brief");
      const output = {
        matches: results,
        showing: `${results.length} of ${catalog.length} operations`,
      };
      return Promise.resolve({
        content: [{ type: "text" as const, text: JSON.stringify(output, null, 2) }],
      });
    }
  );

  // Build dispatch map
  const dispatch = new Map<string, Operation["handler"]>();
  for (const op of catalog) {
    dispatch.set(op.name, op.handler);
  }

  // EXECUTE TOOL
  server.tool(
    "execute",
    `Execute JavaScript code that orchestrates Airtable API calls. The code runs in a sandbox with callTool(name, params) as the only callable. Use await callTool("operation_name", { ...params }) to call operations found via search. Must use return to produce a result.

Example:
const bases = await callTool("list_bases", {});
const tables = await callTool("list_tables", { base_id: bases.bases[0].id });
return tables.tables.map(t => t.name);`,
    {
      code: z
        .string()
        .describe("Async JavaScript code. Use await callTool(name, params) and return the result."),
    },
    async ({ code }) => {
      const callTool: CallToolFn = (name, params, signal) => {
        const handler = dispatch.get(name);
        if (!handler) {
          return Promise.reject(
            new Error(
              `Unknown operation: "${name}". Use the search tool to find available operations.`
            )
          );
        }
        // Sandbox code must see plain, catchable JS Errors — not FiberFailure wrappers.
        return runtime.runPromise(
          handler(params).pipe(Effect.mapError((e) => new Error(renderAirtableError(e)))),
          signal !== undefined ? { signal } : undefined
        );
      };

      const program = executeSandbox(code, callTool).pipe(
        Effect.map((result) => ({
          content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        })),
        Effect.catchTags({
          SandboxError: (e) => Effect.succeed(errorResult(`Code execution failed: ${e.message}`)),
          TimeoutException: () => Effect.succeed(errorResult("Execution timed out")),
        }),
        Effect.catchAllCause((cause) =>
          Effect.succeed(errorResult(`Unexpected failure:\n${Cause.pretty(cause)}`))
        )
      );

      return runtime.runPromise(program);
    }
  );
}
