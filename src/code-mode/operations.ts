import { AxiosError, type AxiosInstance } from "axios";
import { AirtableApiError } from "../airtable-client.js";
import { fieldRequiresOptions, getDefaultOptions, type FieldOption } from "../types.js";

export interface OperationParam {
  name: string;
  type: string;
  required: boolean;
  description: string;
}

export interface Operation {
  name: string;
  description: string;
  parameters: OperationParam[];
  handler: (params: Record<string, unknown>) => Promise<unknown>;
}

export interface SearchResult {
  name: string;
  description: string;
  parameters?: OperationParam[];
}

function p(name: string, type: string, required: boolean, description: string): OperationParam {
  return { name, type, required, description };
}

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

function str(v: unknown): string {
  return v as string;
}

export function createOperationsCatalog(client: AxiosInstance): Operation[] {
  return [
    {
      name: "list_bases",
      description: "List all accessible Airtable bases. Returns up to 1000 bases per page.",
      parameters: [p("offset", "string", false, "Pagination offset from a previous response")],
      handler: async (params): Promise<unknown> => {
        try {
          const qp: Record<string, string> = {};
          if (params["offset"] !== undefined) qp["offset"] = str(params["offset"]);
          const response = await client.get("/meta/bases", { params: qp });
          return response.data as unknown;
        } catch (error) {
          throw new AirtableApiError(error as AxiosError);
        }
      },
    },
    {
      name: "get_base",
      description: "Get schema details for a single Airtable base",
      parameters: [p("base_id", "string", true, "ID of the base")],
      handler: async (params): Promise<unknown> => {
        try {
          const response = await client.get(`/meta/bases/${str(params["base_id"])}`);
          return response.data as unknown;
        } catch (error) {
          throw new AirtableApiError(error as AxiosError);
        }
      },
    },
    {
      name: "list_tables",
      description: "List all tables and their schemas in a base",
      parameters: [p("base_id", "string", true, "ID of the base")],
      handler: async (params): Promise<unknown> => {
        try {
          const response = await client.get(`/meta/bases/${str(params["base_id"])}/tables`);
          return response.data as unknown;
        } catch (error) {
          throw new AirtableApiError(error as AxiosError);
        }
      },
    },
    {
      name: "create_table",
      description: "Create a new table in a base with optional initial fields",
      parameters: [
        p("base_id", "string", true, "ID of the base"),
        p("table_name", "string", true, "Name for the new table"),
        p("description", "string", false, "Description of the table"),
        p("fields", "array", false, "Initial fields for the table"),
      ],
      handler: async (params): Promise<unknown> => {
        try {
          const rawFields = params["fields"] as FieldOption[] | undefined;
          const validatedFields = rawFields?.map((f) => validateField(f));
          const response = await client.post(`/meta/bases/${str(params["base_id"])}/tables`, {
            name: params["table_name"],
            description: params["description"],
            fields: validatedFields,
          });
          return response.data as unknown;
        } catch (error) {
          throw new AirtableApiError(error as AxiosError);
        }
      },
    },
    {
      name: "update_table",
      description: "Update a table's name or description",
      parameters: [
        p("base_id", "string", true, "ID of the base"),
        p("table_id", "string", true, "ID of the table to update"),
        p("name", "string", false, "New name for the table"),
        p("description", "string", false, "New description for the table"),
      ],
      handler: async (params): Promise<unknown> => {
        try {
          const body: Record<string, string> = {};
          if (params["name"] !== undefined) body["name"] = str(params["name"]);
          if (params["description"] !== undefined) body["description"] = str(params["description"]);
          const response = await client.patch(
            `/meta/bases/${str(params["base_id"])}/tables/${str(params["table_id"])}`,
            body
          );
          return response.data as unknown;
        } catch (error) {
          throw new AirtableApiError(error as AxiosError);
        }
      },
    },
    {
      name: "create_field",
      description: "Create a new field (column) in a table",
      parameters: [
        p("base_id", "string", true, "ID of the base"),
        p("table_id", "string", true, "ID of the table"),
        p("name", "string", true, "Name of the new field"),
        p("type", "string", true, "Field type (e.g. singleLineText, number, singleSelect)"),
        p("description", "string", false, "Description of the field"),
        p("options", "object", false, "Field-type-specific options"),
      ],
      handler: async (params): Promise<unknown> => {
        try {
          const field = validateField({
            name: str(params["name"]),
            type: str(params["type"]) as FieldOption["type"],
            description: params["description"] as string | undefined,
            options: params["options"] as FieldOption["options"],
          });
          const response = await client.post(
            `/meta/bases/${str(params["base_id"])}/tables/${str(params["table_id"])}/fields`,
            field
          );
          return response.data as unknown;
        } catch (error) {
          throw new AirtableApiError(error as AxiosError);
        }
      },
    },
    {
      name: "update_field",
      description: "Update a field's name, description, or options",
      parameters: [
        p("base_id", "string", true, "ID of the base"),
        p("table_id", "string", true, "ID of the table"),
        p("field_id", "string", true, "ID of the field to update"),
        p("updates", "object", true, "Fields to update (name, description, options)"),
      ],
      handler: async (params): Promise<unknown> => {
        try {
          const response = await client.patch(
            `/meta/bases/${str(params["base_id"])}/tables/${str(params["table_id"])}/fields/${str(params["field_id"])}`,
            params["updates"]
          );
          return response.data as unknown;
        } catch (error) {
          throw new AirtableApiError(error as AxiosError);
        }
      },
    },
    {
      name: "list_records",
      description:
        "List records in a table with filtering, sorting, field selection, and pagination",
      parameters: [
        p("base_id", "string", true, "ID of the base"),
        p("table_name", "string", true, "Table name or ID"),
        p("max_records", "number", false, "Maximum number of records to return"),
        p("page_size", "number", false, "Number of records per page (max 100)"),
        p("offset", "string", false, "Pagination offset from a previous response"),
        p("view", "string", false, "Name or ID of a view to filter by"),
        p("filter_by_formula", "string", false, "Airtable formula to filter records"),
        p("cell_format", "string", false, "Format for cell values (json or string)"),
        p("time_zone", "string", false, "Time zone for date/time fields"),
        p("user_locale", "string", false, "Locale for date/time formatting"),
        p("fields", "array", false, "Field names or IDs to include"),
        p("sort", "array", false, "Sort configuration [{field, direction}]"),
      ],
      handler: async (params): Promise<unknown> => {
        try {
          const qp: Record<string, unknown> = {};
          if (params["max_records"] !== undefined) qp["maxRecords"] = params["max_records"];
          if (params["page_size"] !== undefined) qp["pageSize"] = params["page_size"];
          if (params["offset"] !== undefined) qp["offset"] = params["offset"];
          if (params["view"] !== undefined) qp["view"] = params["view"];
          if (params["filter_by_formula"] !== undefined)
            qp["filterByFormula"] = params["filter_by_formula"];
          if (params["cell_format"] !== undefined) qp["cellFormat"] = params["cell_format"];
          if (params["time_zone"] !== undefined) qp["timeZone"] = params["time_zone"];
          if (params["user_locale"] !== undefined) qp["userLocale"] = params["user_locale"];
          const fields = params["fields"] as string[] | undefined;
          if (fields !== undefined) {
            fields.forEach((f, i) => {
              qp[`fields[${i}]`] = f;
            });
          }
          const sort = params["sort"] as Array<{ field: string; direction?: string }> | undefined;
          if (sort !== undefined) {
            sort.forEach((s, i) => {
              qp[`sort[${i}][field]`] = s.field;
              if (s.direction !== undefined) qp[`sort[${i}][direction]`] = s.direction;
            });
          }
          const response = await client.get(
            `/${str(params["base_id"])}/${str(params["table_name"])}`,
            { params: qp }
          );
          return response.data as unknown;
        } catch (error) {
          throw new AirtableApiError(error as AxiosError);
        }
      },
    },
    {
      name: "get_record",
      description: "Get a single record by ID",
      parameters: [
        p("base_id", "string", true, "ID of the base"),
        p("table_name", "string", true, "Table name or ID"),
        p("record_id", "string", true, "ID of the record to retrieve"),
      ],
      handler: async (params): Promise<unknown> => {
        try {
          const response = await client.get(
            `/${str(params["base_id"])}/${str(params["table_name"])}/${str(params["record_id"])}`
          );
          return response.data as unknown;
        } catch (error) {
          throw new AirtableApiError(error as AxiosError);
        }
      },
    },
    {
      name: "create_record",
      description: "Create a single record in a table",
      parameters: [
        p("base_id", "string", true, "ID of the base"),
        p("table_name", "string", true, "Table name or ID"),
        p("fields", "object", true, "Field values for the new record"),
        p("typecast", "boolean", false, "Convert string values to appropriate types"),
      ],
      handler: async (params): Promise<unknown> => {
        try {
          const response = await client.post(
            `/${str(params["base_id"])}/${str(params["table_name"])}`,
            { fields: params["fields"], typecast: params["typecast"] }
          );
          return response.data as unknown;
        } catch (error) {
          throw new AirtableApiError(error as AxiosError);
        }
      },
    },
    {
      name: "update_record",
      description: "Update a single record's fields (partial update)",
      parameters: [
        p("base_id", "string", true, "ID of the base"),
        p("table_name", "string", true, "Table name or ID"),
        p("record_id", "string", true, "ID of the record to update"),
        p("fields", "object", true, "Field values to update"),
        p("typecast", "boolean", false, "Convert string values to appropriate types"),
      ],
      handler: async (params): Promise<unknown> => {
        try {
          const response = await client.patch(
            `/${str(params["base_id"])}/${str(params["table_name"])}/${str(params["record_id"])}`,
            { fields: params["fields"], typecast: params["typecast"] }
          );
          return response.data as unknown;
        } catch (error) {
          throw new AirtableApiError(error as AxiosError);
        }
      },
    },
    {
      name: "delete_record",
      description: "Delete a single record from a table",
      parameters: [
        p("base_id", "string", true, "ID of the base"),
        p("table_name", "string", true, "Table name or ID"),
        p("record_id", "string", true, "ID of the record to delete"),
      ],
      handler: async (params): Promise<unknown> => {
        try {
          const response = await client.delete(
            `/${str(params["base_id"])}/${str(params["table_name"])}/${str(params["record_id"])}`
          );
          return response.data as unknown;
        } catch (error) {
          throw new AirtableApiError(error as AxiosError);
        }
      },
    },
    {
      name: "search_records",
      description: "Search for records where a field matches a value (uses filterByFormula)",
      parameters: [
        p("base_id", "string", true, "ID of the base"),
        p("table_name", "string", true, "Table name or ID"),
        p("field_name", "string", true, "Name of the field to search in"),
        p("value", "string", true, "Value to search for"),
      ],
      handler: async (params): Promise<unknown> => {
        try {
          const filterByFormula = `{${str(params["field_name"])}} = "${str(params["value"])}"`;
          const response = await client.get(
            `/${str(params["base_id"])}/${str(params["table_name"])}`,
            { params: { filterByFormula } }
          );
          return response.data as unknown;
        } catch (error) {
          throw new AirtableApiError(error as AxiosError);
        }
      },
    },
    {
      name: "create_records",
      description: "Create multiple records in a table (up to 10 per call)",
      parameters: [
        p("base_id", "string", true, "ID of the base"),
        p("table_name", "string", true, "Table name or ID"),
        p("records", "array", true, "Records to create (1–10), each with a fields object"),
        p("typecast", "boolean", false, "Convert string values to appropriate types"),
      ],
      handler: async (params): Promise<unknown> => {
        try {
          const response = await client.post(
            `/${str(params["base_id"])}/${str(params["table_name"])}`,
            { records: params["records"], typecast: params["typecast"] }
          );
          return response.data as unknown;
        } catch (error) {
          throw new AirtableApiError(error as AxiosError);
        }
      },
    },
    {
      name: "update_records",
      description: "Update multiple records (up to 10). Supports upsert via perform_upsert option.",
      parameters: [
        p("base_id", "string", true, "ID of the base"),
        p("table_name", "string", true, "Table name or ID"),
        p("records", "array", true, "Records to update (1–10), each with id and fields"),
        p("typecast", "boolean", false, "Convert string values to appropriate types"),
        p(
          "perform_upsert",
          "object",
          false,
          "If provided, performs upsert. Must include fields_to_merge_on array."
        ),
      ],
      handler: async (params): Promise<unknown> => {
        try {
          const body: Record<string, unknown> = {
            records: params["records"],
            typecast: params["typecast"],
          };
          const performUpsert = params["perform_upsert"] as
            | { fields_to_merge_on: string[] }
            | undefined;
          if (performUpsert !== undefined) {
            body["performUpsert"] = { fieldsToMergeOn: performUpsert.fields_to_merge_on };
          }
          const response = await client.patch(
            `/${str(params["base_id"])}/${str(params["table_name"])}`,
            body
          );
          return response.data as unknown;
        } catch (error) {
          throw new AirtableApiError(error as AxiosError);
        }
      },
    },
    {
      name: "delete_records",
      description: "Delete multiple records from a table (up to 10 per call)",
      parameters: [
        p("base_id", "string", true, "ID of the base"),
        p("table_name", "string", true, "Table name or ID"),
        p("record_ids", "array", true, "IDs of records to delete (1–10)"),
      ],
      handler: async (params): Promise<unknown> => {
        try {
          const recordIds = params["record_ids"] as string[];
          const qp: Record<string, string> = {};
          recordIds.forEach((id, i) => {
            qp[`records[${i}]`] = id;
          });
          const response = await client.delete(
            `/${str(params["base_id"])}/${str(params["table_name"])}`,
            { params: qp }
          );
          return response.data as unknown;
        } catch (error) {
          throw new AirtableApiError(error as AxiosError);
        }
      },
    },
  ];
}

export function searchCatalog(
  catalog: Operation[],
  query: string,
  detail: "brief" | "detailed" = "brief"
): SearchResult[] {
  const q = query.toLowerCase();
  const matches = catalog.filter(
    (op) => op.name.toLowerCase().includes(q) || op.description.toLowerCase().includes(q)
  );
  if (detail === "detailed") {
    return matches.map((op) => ({
      name: op.name,
      description: op.description,
      parameters: op.parameters,
    }));
  }
  return matches.map((op) => ({ name: op.name, description: op.description }));
}
