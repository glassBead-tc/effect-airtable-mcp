import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { AxiosError, type AxiosInstance } from "axios";
import { z } from "zod";
import { AirtableApiError } from "../airtable-client.js";

export function registerBatchRecordsTools(server: McpServer, client: AxiosInstance): void {
  server.tool(
    "create_records",
    "Create multiple records in a table (up to 10 per call)",
    {
      base_id: z.string().describe("ID of the base"),
      table_name: z.string().describe("Table name or ID"),
      records: z
        .array(
          z.object({
            fields: z.record(z.string(), z.any()).describe("Field values for the record"),
          })
        )
        .min(1)
        .max(10)
        .describe("Records to create (1–10)"),
      typecast: z
        .boolean()
        .optional()
        .describe("If true, Airtable will attempt to convert string values to appropriate types"),
    },
    async ({ base_id, table_name, records, typecast }) => {
      try {
        const response = await client.post(`/${base_id}/${table_name}`, { records, typecast });
        return { content: [{ type: "text", text: JSON.stringify(response.data, null, 2) }] };
      } catch (error) {
        throw new AirtableApiError(error as AxiosError);
      }
    }
  );

  server.tool(
    "update_records",
    "Update multiple records (up to 10). Supports upsert via perform_upsert option.",
    {
      base_id: z.string().describe("ID of the base"),
      table_name: z.string().describe("Table name or ID"),
      records: z
        .array(
          z.object({
            id: z.string().describe("Record ID"),
            fields: z.record(z.string(), z.any()).describe("Field values to update"),
          })
        )
        .min(1)
        .max(10)
        .describe("Records to update (1–10)"),
      typecast: z
        .boolean()
        .optional()
        .describe("If true, Airtable will attempt to convert string values to appropriate types"),
      perform_upsert: z
        .object({
          fields_to_merge_on: z
            .array(z.string())
            .describe("Field names to match records for upsert"),
        })
        .optional()
        .describe("If provided, performs an upsert instead of a plain update"),
    },
    async ({ base_id, table_name, records, typecast, perform_upsert }) => {
      try {
        const body: Record<string, unknown> = { records, typecast };
        if (perform_upsert !== undefined) {
          body["performUpsert"] = { fieldsToMergeOn: perform_upsert.fields_to_merge_on };
        }
        const response = await client.patch(`/${base_id}/${table_name}`, body);
        return { content: [{ type: "text", text: JSON.stringify(response.data, null, 2) }] };
      } catch (error) {
        throw new AirtableApiError(error as AxiosError);
      }
    }
  );

  server.tool(
    "delete_records",
    "Delete multiple records from a table (up to 10 per call)",
    {
      base_id: z.string().describe("ID of the base"),
      table_name: z.string().describe("Table name or ID"),
      record_ids: z.array(z.string()).min(1).max(10).describe("IDs of records to delete (1–10)"),
    },
    async ({ base_id, table_name, record_ids }) => {
      try {
        const params: Record<string, string> = {};
        record_ids.forEach((id, i) => {
          params[`records[${i}]`] = id;
        });
        const response = await client.delete(`/${base_id}/${table_name}`, { params });
        return { content: [{ type: "text", text: JSON.stringify(response.data, null, 2) }] };
      } catch (error) {
        throw new AirtableApiError(error as AxiosError);
      }
    }
  );
}
