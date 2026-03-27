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

export function registerFieldsTools(server: McpServer, client: AxiosInstance): void {
  server.tool(
    "create_field",
    "Create a new field (column) in a table",
    {
      base_id: z.string().describe("ID of the base"),
      table_id: z.string().describe("ID of the table"),
      name: z.string().describe("Name of the new field"),
      type: z.string().describe("Field type (e.g. singleLineText, number, singleSelect)"),
      description: z.string().optional().describe("Description of the field"),
      options: z.record(z.string(), z.any()).optional().describe("Field-type-specific options"),
    },
    async ({ base_id, table_id, name, type, description, options }) => {
      try {
        const field = validateField({ name, type, description, options } as FieldOption);
        const response = await client.post(
          `/meta/bases/${base_id}/tables/${table_id}/fields`,
          field
        );
        return { content: [{ type: "text", text: JSON.stringify(response.data, null, 2) }] };
      } catch (error) {
        throw new AirtableApiError(error as AxiosError);
      }
    }
  );

  server.tool(
    "update_field",
    "Update a field's name, description, or options",
    {
      base_id: z.string().describe("ID of the base"),
      table_id: z.string().describe("ID of the table"),
      field_id: z.string().describe("ID of the field to update"),
      updates: z
        .object({
          name: z.string().optional().describe("New name for the field"),
          description: z.string().optional().describe("New description for the field"),
          options: z.record(z.string(), z.any()).optional().describe("New field-specific options"),
        })
        .describe("Fields to update"),
    },
    async ({ base_id, table_id, field_id, updates }) => {
      try {
        const response = await client.patch(
          `/meta/bases/${base_id}/tables/${table_id}/fields/${field_id}`,
          updates
        );
        return { content: [{ type: "text", text: JSON.stringify(response.data, null, 2) }] };
      } catch (error) {
        throw new AirtableApiError(error as AxiosError);
      }
    }
  );
}
