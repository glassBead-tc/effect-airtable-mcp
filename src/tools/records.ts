import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { AxiosError, type AxiosInstance } from "axios";
import { z } from "zod";
import { AirtableApiError } from "../airtable-client.js";

export function registerRecordsTools(server: McpServer, client: AxiosInstance): void {
  server.tool(
    "list_records",
    "List records in a table with filtering, sorting, field selection, and pagination",
    {
      base_id: z.string().describe("ID of the base"),
      table_name: z.string().describe("Table name or ID"),
      max_records: z.number().optional().describe("Maximum number of records to return"),
      page_size: z.number().optional().describe("Number of records per page (max 100)"),
      offset: z.string().optional().describe("Pagination offset from a previous response"),
      view: z.string().optional().describe("Name or ID of a view to filter by"),
      filter_by_formula: z.string().optional().describe("Airtable formula to filter records"),
      cell_format: z.enum(["json", "string"]).optional().describe("Format for cell values"),
      time_zone: z.string().optional().describe("Time zone for date/time fields"),
      user_locale: z.string().optional().describe("Locale for date/time formatting"),
      fields: z.array(z.string()).optional().describe("Field names or IDs to include"),
      sort: z
        .array(
          z.object({
            field: z.string().describe("Field name to sort by"),
            direction: z.enum(["asc", "desc"]).optional().describe("Sort direction"),
          })
        )
        .optional()
        .describe("Sort configuration"),
    },
    async ({
      base_id,
      table_name,
      max_records,
      page_size,
      offset,
      view,
      filter_by_formula,
      cell_format,
      time_zone,
      user_locale,
      fields,
      sort,
    }) => {
      try {
        const params: Record<string, unknown> = {};
        if (max_records !== undefined) params["maxRecords"] = max_records;
        if (page_size !== undefined) params["pageSize"] = page_size;
        if (offset !== undefined) params["offset"] = offset;
        if (view !== undefined) params["view"] = view;
        if (filter_by_formula !== undefined) params["filterByFormula"] = filter_by_formula;
        if (cell_format !== undefined) params["cellFormat"] = cell_format;
        if (time_zone !== undefined) params["timeZone"] = time_zone;
        if (user_locale !== undefined) params["userLocale"] = user_locale;
        if (fields !== undefined) {
          fields.forEach((f, i) => {
            params[`fields[${i}]`] = f;
          });
        }
        if (sort !== undefined) {
          sort.forEach((s, i) => {
            params[`sort[${i}][field]`] = s.field;
            if (s.direction !== undefined) params[`sort[${i}][direction]`] = s.direction;
          });
        }
        const response = await client.get(`/${base_id}/${table_name}`, { params });
        return { content: [{ type: "text", text: JSON.stringify(response.data, null, 2) }] };
      } catch (error) {
        throw new AirtableApiError(error as AxiosError);
      }
    }
  );

  server.tool(
    "get_record",
    "Get a single record by ID",
    {
      base_id: z.string().describe("ID of the base"),
      table_name: z.string().describe("Table name or ID"),
      record_id: z.string().describe("ID of the record to retrieve"),
    },
    async ({ base_id, table_name, record_id }) => {
      try {
        const response = await client.get(`/${base_id}/${table_name}/${record_id}`);
        return { content: [{ type: "text", text: JSON.stringify(response.data, null, 2) }] };
      } catch (error) {
        throw new AirtableApiError(error as AxiosError);
      }
    }
  );

  server.tool(
    "create_record",
    "Create a single record in a table",
    {
      base_id: z.string().describe("ID of the base"),
      table_name: z.string().describe("Table name or ID"),
      fields: z.record(z.string(), z.any()).describe("Field values for the new record"),
      typecast: z
        .boolean()
        .optional()
        .describe("If true, Airtable will attempt to convert string values to appropriate types"),
    },
    async ({ base_id, table_name, fields, typecast }) => {
      try {
        const response = await client.post(`/${base_id}/${table_name}`, { fields, typecast });
        return { content: [{ type: "text", text: JSON.stringify(response.data, null, 2) }] };
      } catch (error) {
        throw new AirtableApiError(error as AxiosError);
      }
    }
  );

  server.tool(
    "update_record",
    "Update a single record's fields (partial update)",
    {
      base_id: z.string().describe("ID of the base"),
      table_name: z.string().describe("Table name or ID"),
      record_id: z.string().describe("ID of the record to update"),
      fields: z.record(z.string(), z.any()).describe("Field values to update"),
      typecast: z
        .boolean()
        .optional()
        .describe("If true, Airtable will attempt to convert string values to appropriate types"),
    },
    async ({ base_id, table_name, record_id, fields, typecast }) => {
      try {
        const response = await client.patch(`/${base_id}/${table_name}/${record_id}`, {
          fields,
          typecast,
        });
        return { content: [{ type: "text", text: JSON.stringify(response.data, null, 2) }] };
      } catch (error) {
        throw new AirtableApiError(error as AxiosError);
      }
    }
  );

  server.tool(
    "delete_record",
    "Delete a single record from a table",
    {
      base_id: z.string().describe("ID of the base"),
      table_name: z.string().describe("Table name or ID"),
      record_id: z.string().describe("ID of the record to delete"),
    },
    async ({ base_id, table_name, record_id }) => {
      try {
        const response = await client.delete(`/${base_id}/${table_name}/${record_id}`);
        return { content: [{ type: "text", text: JSON.stringify(response.data, null, 2) }] };
      } catch (error) {
        throw new AirtableApiError(error as AxiosError);
      }
    }
  );

  server.tool(
    "search_records",
    "Search for records where a field matches a value (uses filterByFormula)",
    {
      base_id: z.string().describe("ID of the base"),
      table_name: z.string().describe("Table name or ID"),
      field_name: z.string().describe("Name of the field to search in"),
      value: z.string().describe("Value to search for"),
    },
    async ({ base_id, table_name, field_name, value }) => {
      try {
        const filterByFormula = `{${field_name}} = "${value}"`;
        const response = await client.get(`/${base_id}/${table_name}`, {
          params: { filterByFormula },
        });
        return { content: [{ type: "text", text: JSON.stringify(response.data, null, 2) }] };
      } catch (error) {
        throw new AirtableApiError(error as AxiosError);
      }
    }
  );
}
