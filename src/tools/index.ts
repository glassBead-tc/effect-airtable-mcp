import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { AxiosInstance } from "axios";
import { registerBasesTools } from "./bases.js";
import { registerTablesTools } from "./tables.js";
import { registerFieldsTools } from "./fields.js";
import { registerRecordsTools } from "./records.js";
import { registerBatchRecordsTools } from "./batch-records.js";

export function registerAllTools(server: McpServer, client: AxiosInstance): void {
  registerBasesTools(server, client);
  registerTablesTools(server, client);
  registerFieldsTools(server, client);
  registerRecordsTools(server, client);
  registerBatchRecordsTools(server, client);
}
