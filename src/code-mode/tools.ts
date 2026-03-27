import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { type Operation, searchCatalog } from "./operations.js";
import { executeSandbox } from "./sandbox.js";

export function registerCodeModeTools(server: McpServer, catalog: Operation[]): void {
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
      const callTool = async (name: string, params: Record<string, unknown>): Promise<unknown> => {
        const handler = dispatch.get(name);
        if (!handler) {
          throw new Error(
            `Unknown operation: "${name}". Use the search tool to find available operations.`
          );
        }
        return handler(params);
      };

      const result = await executeSandbox(code, callTool);
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    }
  );
}
