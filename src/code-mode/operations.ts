import type { Effect } from "effect";
import type { AirtableClient, ListRecordsOptions, SortSpec } from "../airtable-client.js";
import type { AirtableError } from "../errors.js";
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
  handler: (params: Record<string, unknown>) => Effect.Effect<unknown, AirtableError>;
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

export function createOperationsCatalog(client: AirtableClient): Operation[] {
  return [
    {
      name: "list_bases",
      description: "List all accessible Airtable bases. Returns up to 1000 bases per page.",
      parameters: [p("offset", "string", false, "Pagination offset from a previous response")],
      handler: (params) => client.listBases({ offset: params["offset"] as string | undefined }),
    },
    {
      name: "get_base",
      description: "Get schema details for a single Airtable base",
      parameters: [p("base_id", "string", true, "ID of the base")],
      handler: (params) => client.getBase(str(params["base_id"])),
    },
    {
      name: "list_tables",
      description: "List all tables and their schemas in a base",
      parameters: [p("base_id", "string", true, "ID of the base")],
      handler: (params) => client.listTables(str(params["base_id"])),
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
      handler: (params): Effect.Effect<unknown, AirtableError> => {
        const rawFields = params["fields"] as FieldOption[] | undefined;
        return client.createTable(str(params["base_id"]), {
          name: params["table_name"],
          description: params["description"],
          fields: rawFields?.map((f) => validateField(f)),
        });
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
      handler: (params): Effect.Effect<unknown, AirtableError> => {
        const body: Record<string, string> = {};
        if (params["name"] !== undefined) body["name"] = str(params["name"]);
        if (params["description"] !== undefined) body["description"] = str(params["description"]);
        return client.updateTable(str(params["base_id"]), str(params["table_id"]), body);
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
      handler: (params) =>
        client.createField(
          str(params["base_id"]),
          str(params["table_id"]),
          validateField({
            name: str(params["name"]),
            type: str(params["type"]) as FieldOption["type"],
            description: params["description"] as string | undefined,
            options: params["options"] as FieldOption["options"],
          })
        ),
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
      handler: (params) =>
        client.updateField(
          str(params["base_id"]),
          str(params["table_id"]),
          str(params["field_id"]),
          params["updates"]
        ),
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
      handler: (params): Effect.Effect<unknown, AirtableError> => {
        const options: ListRecordsOptions = {
          maxRecords: params["max_records"] as number | undefined,
          pageSize: params["page_size"] as number | undefined,
          offset: params["offset"] as string | undefined,
          view: params["view"] as string | undefined,
          filterByFormula: params["filter_by_formula"] as string | undefined,
          cellFormat: params["cell_format"] as string | undefined,
          timeZone: params["time_zone"] as string | undefined,
          userLocale: params["user_locale"] as string | undefined,
          fields: params["fields"] as string[] | undefined,
          sort: params["sort"] as SortSpec[] | undefined,
        };
        return client.listRecords(str(params["base_id"]), str(params["table_name"]), options);
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
      handler: (params) =>
        client.getRecord(
          str(params["base_id"]),
          str(params["table_name"]),
          str(params["record_id"])
        ),
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
      handler: (params) =>
        client.createRecord(str(params["base_id"]), str(params["table_name"]), {
          fields: params["fields"],
          typecast: params["typecast"],
        }),
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
      handler: (params) =>
        client.updateRecord(
          str(params["base_id"]),
          str(params["table_name"]),
          str(params["record_id"]),
          { fields: params["fields"], typecast: params["typecast"] }
        ),
    },
    {
      name: "delete_record",
      description: "Delete a single record from a table",
      parameters: [
        p("base_id", "string", true, "ID of the base"),
        p("table_name", "string", true, "Table name or ID"),
        p("record_id", "string", true, "ID of the record to delete"),
      ],
      handler: (params) =>
        client.deleteRecord(
          str(params["base_id"]),
          str(params["table_name"]),
          str(params["record_id"])
        ),
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
      handler: (params) =>
        client.searchRecords(
          str(params["base_id"]),
          str(params["table_name"]),
          `{${str(params["field_name"])}} = "${str(params["value"])}"`
        ),
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
      handler: (params) =>
        client.createRecords(str(params["base_id"]), str(params["table_name"]), {
          records: params["records"],
          typecast: params["typecast"],
        }),
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
      handler: (params): Effect.Effect<unknown, AirtableError> => {
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
        return client.updateRecords(str(params["base_id"]), str(params["table_name"]), body);
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
      handler: (params) =>
        client.deleteRecords(
          str(params["base_id"]),
          str(params["table_name"]),
          params["record_ids"] as string[]
        ),
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
