import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { AxiosError, type AxiosInstance } from "axios";
import { z } from "zod";
import { AirtableApiError } from "../airtable-client.js";
import { fieldRequiresOptions, getDefaultOptions, type FieldOption } from "../types.js";

function validateField(field: FieldOption): FieldOption {
  const { type } = field;
  if (!fieldRequiresOptions(type)) {
    return { name: field.name, type: field.type, description: field.description };
  }
  if (!field.options) {
    return { ...field, options: getDefaultOptions(type) };
  }
  return field;
}

const FieldSchema = z.object({
  name: z.string().describe("Name of the field"),
  type: z.string().describe("Field type (e.g. singleLineText, number, singleSelect)"),
  description: z.string().optional().describe("Description of the field"),
  options: z.record(z.string(), z.any()).optional().describe("Field-type-specific options"),
});

export function registerTablesTools(server: McpServer, client: AxiosInstance): void {
  server.tool(
    "list_tables",
    "List all tables and their schemas in a base",
    {
      base_id: z.string().describe("ID of the base"),
    },
    async ({ base_id }) => {
      try {
        const response = await client.get(`/meta/bases/${base_id}/tables`);
        return { content: [{ type: "text", text: JSON.stringify(response.data, null, 2) }] };
      } catch (error) {
        throw new AirtableApiError(error as AxiosError);
      }
    }
  );

  server.tool(
    "create_table",
    "Create a new table in a base with optional initial fields",
    {
      base_id: z.string().describe("ID of the base"),
      table_name: z.string().describe("Name for the new table"),
      description: z.string().optional().describe("Description of the table"),
      fields: z.array(FieldSchema).optional().describe("Initial fields for the table"),
    },
    async ({ base_id, table_name, description, fields }) => {
      try {
        const validatedFields = fields?.map((f) => validateField(f as FieldOption));
        const response = await client.post(`/meta/bases/${base_id}/tables`, {
          name: table_name,
          description,
          fields: validatedFields,
        });
        return { content: [{ type: "text", text: JSON.stringify(response.data, null, 2) }] };
      } catch (error) {
        throw new AirtableApiError(error as AxiosError);
      }
    }
  );

  server.tool(
    "update_table",
    "Update a table's name or description",
    {
      base_id: z.string().describe("ID of the base"),
      table_id: z.string().describe("ID of the table to update"),
      name: z.string().optional().describe("New name for the table"),
      description: z.string().optional().describe("New description for the table"),
    },
    async ({ base_id, table_id, name, description }) => {
      try {
        const body: Record<string, string> = {};
        if (name !== undefined) body["name"] = name;
        if (description !== undefined) body["description"] = description;
        const response = await client.patch(`/meta/bases/${base_id}/tables/${table_id}`, body);
        return { content: [{ type: "text", text: JSON.stringify(response.data, null, 2) }] };
      } catch (error) {
        throw new AirtableApiError(error as AxiosError);
      }
    }
  );
}
