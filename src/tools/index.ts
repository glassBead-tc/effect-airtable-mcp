import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Operation } from "../code-mode/operations.js";
import { registerCodeModeTools, type AppRuntime } from "../code-mode/tools.js";

export function registerAllTools(
  server: McpServer,
  catalog: Operation[],
  runtime: AppRuntime
): void {
  registerCodeModeTools(server, catalog, runtime);
}
