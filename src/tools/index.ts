import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { AxiosInstance } from "axios";
import { createOperationsCatalog } from "../code-mode/operations.js";
import { registerCodeModeTools } from "../code-mode/tools.js";

export function registerAllTools(server: McpServer, client: AxiosInstance): void {
  const catalog = createOperationsCatalog(client);
  registerCodeModeTools(server, catalog);
}
