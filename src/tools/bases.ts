import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { AxiosError, type AxiosInstance } from "axios";
import { z } from "zod";
import { AirtableApiError } from "../airtable-client.js";

export function registerBasesTools(server: McpServer, client: AxiosInstance): void {
  server.tool(
    "list_bases",
    "List all accessible Airtable bases. Returns up to 1000 bases per page.",
    {
      offset: z.string().optional().describe("Pagination offset from a previous response"),
    },
    async ({ offset }) => {
      try {
        const params: Record<string, string> = {};
        if (offset !== undefined) params["offset"] = offset;
        const response = await client.get("/meta/bases", { params });
        return { content: [{ type: "text", text: JSON.stringify(response.data, null, 2) }] };
      } catch (error) {
        throw new AirtableApiError(error as AxiosError);
      }
    }
  );
}
