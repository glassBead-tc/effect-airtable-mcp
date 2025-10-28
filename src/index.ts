#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ErrorCode,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import axios, { AxiosInstance } from "axios";
import {
  FieldOption,
  fieldRequiresOptions,
  getDefaultOptions,
  FieldValue,
  AirtableBase,
  AirtableTable,
  AirtableRecord,
  AirtableError,
} from "./types.js";
import { AirtableApiError, RateLimitError } from "./errors.js";
import { withRetry } from "./retry.js";
import { createRecordExecutor } from "./tools/create-record.js";
import { listBasesExecutor } from "./tools/list-bases.js";
import { listTablesExecutor } from "./tools/list-tables.js";
import { getRecordExecutor } from "./tools/get-record.js";
import { listRecordsExecutor } from "./tools/list-records.js";
import { updateTableExecutor } from "./tools/update-table.js";
import { updateFieldExecutor } from "./tools/update-field.js";
import { updateRecordExecutor } from "./tools/update-record.js";
import { deleteRecordExecutor } from "./tools/delete-record.js";
import { searchRecordsExecutor } from "./tools/search-records.js";
import { runToolEffect } from "./adapters/mcp-adapter.js";

const API_KEY = process.env.AIRTABLE_API_KEY;
if (API_KEY === undefined || API_KEY === "") {
  throw new Error("AIRTABLE_API_KEY environment variable is required");
}

class AirtableServer {
  private server: Server;
  private axiosInstance: AxiosInstance;

  constructor() {
    this.server = new Server(
      {
        name: "airtable-server",
        version: "0.2.0",
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.axiosInstance = axios.create({
      baseURL: "https://api.airtable.com/v0",
      headers: {
        Authorization: `Bearer ${API_KEY}`,
      },
    });

    this.setupToolHandlers();

    // Error handling
    this.server.onerror = (error: Error): void => console.error("[MCP Error]", error);
    process.on("SIGINT", () => {
      void this.server.close().then(() => {
        process.exit(0);
      });
    });
  }

  private validateField(field: FieldOption): FieldOption {
    const { type } = field;

    // Remove options for fields that don't need them
    if (!fieldRequiresOptions(type)) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { options, ...rest } = field;
      return rest;
    }

    // Add default options for fields that require them
    if (!field.options) {
      return {
        ...field,
        options: getDefaultOptions(type),
      };
    }

    return field;
  }

  private setupToolHandlers(): void {
    // Register available tools
    this.server.setRequestHandler(ListToolsRequestSchema, () =>
      Promise.resolve({
        tools: [
          {
            name: "list_bases",
            description: "List all accessible Airtable bases",
            inputSchema: {
              type: "object",
              properties: {},
              required: [],
            },
          },
          {
            name: "list_tables",
            description: "List all tables in a base",
            inputSchema: {
              type: "object",
              properties: {
                base_id: {
                  type: "string",
                  description: "ID of the base",
                },
              },
              required: ["base_id"],
            },
          },
          {
            name: "create_table",
            description: "Create a new table in a base",
            inputSchema: {
              type: "object",
              properties: {
                base_id: {
                  type: "string",
                  description: "ID of the base",
                },
                table_name: {
                  type: "string",
                  description: "Name of the new table",
                },
                description: {
                  type: "string",
                  description: "Description of the table",
                },
                fields: {
                  type: "array",
                  description: "Initial fields for the table",
                  items: {
                    type: "object",
                    properties: {
                      name: {
                        type: "string",
                        description: "Name of the field",
                      },
                      type: {
                        type: "string",
                        description:
                          "Type of the field (e.g., singleLineText, multilineText, number, etc.)",
                      },
                      description: {
                        type: "string",
                        description: "Description of the field",
                      },
                      options: {
                        type: "object",
                        description: "Field-specific options",
                      },
                    },
                    required: ["name", "type"],
                  },
                },
              },
              required: ["base_id", "table_name"],
            },
          },
          {
            name: "update_table",
            description: "Update a table's schema",
            inputSchema: {
              type: "object",
              properties: {
                base_id: {
                  type: "string",
                  description: "ID of the base",
                },
                table_id: {
                  type: "string",
                  description: "ID of the table to update",
                },
                name: {
                  type: "string",
                  description: "New name for the table",
                },
                description: {
                  type: "string",
                  description: "New description for the table",
                },
              },
              required: ["base_id", "table_id"],
            },
          },
          {
            name: "create_field",
            description: "Create a new field in a table",
            inputSchema: {
              type: "object",
              properties: {
                base_id: {
                  type: "string",
                  description: "ID of the base",
                },
                table_id: {
                  type: "string",
                  description: "ID of the table",
                },
                field: {
                  type: "object",
                  properties: {
                    name: {
                      type: "string",
                      description: "Name of the field",
                    },
                    type: {
                      type: "string",
                      description: "Type of the field",
                    },
                    description: {
                      type: "string",
                      description: "Description of the field",
                    },
                    options: {
                      type: "object",
                      description: "Field-specific options",
                    },
                  },
                  required: ["name", "type"],
                },
              },
              required: ["base_id", "table_id", "field"],
            },
          },
          {
            name: "update_field",
            description: "Update a field in a table",
            inputSchema: {
              type: "object",
              properties: {
                base_id: {
                  type: "string",
                  description: "ID of the base",
                },
                table_id: {
                  type: "string",
                  description: "ID of the table",
                },
                field_id: {
                  type: "string",
                  description: "ID of the field to update",
                },
                updates: {
                  type: "object",
                  properties: {
                    name: {
                      type: "string",
                      description: "New name for the field",
                    },
                    description: {
                      type: "string",
                      description: "New description for the field",
                    },
                    options: {
                      type: "object",
                      description: "New field-specific options",
                    },
                  },
                },
              },
              required: ["base_id", "table_id", "field_id", "updates"],
            },
          },
          {
            name: "list_records",
            description: "List records in a table",
            inputSchema: {
              type: "object",
              properties: {
                base_id: {
                  type: "string",
                  description: "ID of the base",
                },
                table_name: {
                  type: "string",
                  description: "Name of the table",
                },
                max_records: {
                  type: "number",
                  description: "Maximum number of records to return",
                },
              },
              required: ["base_id", "table_name"],
            },
          },
          {
            name: "create_record",
            description: "Create a new record in a table",
            inputSchema: {
              type: "object",
              properties: {
                base_id: {
                  type: "string",
                  description: "ID of the base",
                },
                table_name: {
                  type: "string",
                  description: "Name of the table",
                },
                fields: {
                  type: "object",
                  description: "Record fields as key-value pairs",
                },
              },
              required: ["base_id", "table_name", "fields"],
            },
          },
          {
            name: "update_record",
            description: "Update an existing record in a table",
            inputSchema: {
              type: "object",
              properties: {
                base_id: {
                  type: "string",
                  description: "ID of the base",
                },
                table_name: {
                  type: "string",
                  description: "Name of the table",
                },
                record_id: {
                  type: "string",
                  description: "ID of the record to update",
                },
                fields: {
                  type: "object",
                  description: "Record fields to update as key-value pairs",
                },
              },
              required: ["base_id", "table_name", "record_id", "fields"],
            },
          },
          {
            name: "delete_record",
            description: "Delete a record from a table",
            inputSchema: {
              type: "object",
              properties: {
                base_id: {
                  type: "string",
                  description: "ID of the base",
                },
                table_name: {
                  type: "string",
                  description: "Name of the table",
                },
                record_id: {
                  type: "string",
                  description: "ID of the record to delete",
                },
              },
              required: ["base_id", "table_name", "record_id"],
            },
          },
          {
            name: "search_records",
            description: "Search for records in a table",
            inputSchema: {
              type: "object",
              properties: {
                base_id: {
                  type: "string",
                  description: "ID of the base",
                },
                table_name: {
                  type: "string",
                  description: "Name of the table",
                },
                field_name: {
                  type: "string",
                  description: "Name of the field to search in",
                },
                value: {
                  type: "string",
                  description: "Value to search for",
                },
              },
              required: ["base_id", "table_name", "field_name", "value"],
            },
          },
          {
            name: "get_record",
            description: "Get a single record by its ID",
            inputSchema: {
              type: "object",
              properties: {
                base_id: {
                  type: "string",
                  description: "ID of the base",
                },
                table_name: {
                  type: "string",
                  description: "Name of the table",
                },
                record_id: {
                  type: "string",
                  description: "ID of the record to retrieve",
                },
              },
              required: ["base_id", "table_name", "record_id"],
            },
          },
        ],
      })
    );

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      try {
        switch (request.params.name) {
          case "list_bases": {
            // Use Effect-based implementation with full validation
            const executor = listBasesExecutor(this.axiosInstance);
            return await runToolEffect(executor.execute(request.params.arguments));
          }

          case "list_tables": {
            // Use Effect-based implementation with full validation
            const executor = listTablesExecutor(this.axiosInstance);
            return await runToolEffect(executor.execute(request.params.arguments));
          }

          case "create_table": {
            const { base_id, table_name, description, fields } = request.params.arguments as {
              base_id: string;
              table_name: string;
              description?: string;
              fields?: FieldOption[];
            };

            // Validate and prepare fields
            const validatedFields = fields?.map((field) => this.validateField(field));

            const response = await this.axiosInstance.post(`/meta/bases/${base_id}/tables`, {
              name: table_name,
              description,
              fields: validatedFields,
            });

            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(response.data, null, 2),
                },
              ],
            };
          }

          case "update_table": {
            // Use Effect-based implementation with full validation
            const executor = updateTableExecutor(this.axiosInstance);
            return await runToolEffect(executor.execute(request.params.arguments));
          }

          case "create_field": {
            const { base_id, table_id, field } = request.params.arguments as {
              base_id: string;
              table_id: string;
              field: FieldOption;
            };

            // Validate field before creation
            const validatedField = this.validateField(field);

            const response = await this.axiosInstance.post(
              `/meta/bases/${base_id}/tables/${table_id}/fields`,
              validatedField
            );

            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(response.data, null, 2),
                },
              ],
            };
          }

          case "update_field": {
            // Use Effect-based implementation with full validation
            const executor = updateFieldExecutor(this.axiosInstance);
            return await runToolEffect(executor.execute(request.params.arguments));
          }

          case "list_records": {
            // Use Effect-based implementation with full validation
            const executor = listRecordsExecutor(this.axiosInstance);
            return await runToolEffect(executor.execute(request.params.arguments));
          }

          case "create_record": {
            // Use Effect-based implementation with full validation
            const executor = createRecordExecutor(this.axiosInstance);
            return await runToolEffect(executor.execute(request.params.arguments));
          }

          case "update_record": {
            // Use Effect-based implementation with full validation
            const executor = updateRecordExecutor(this.axiosInstance);
            return await runToolEffect(executor.execute(request.params.arguments));
          }

          case "delete_record": {
            // Use Effect-based implementation with full validation
            const executor = deleteRecordExecutor(this.axiosInstance);
            return await runToolEffect(executor.execute(request.params.arguments));
          }

          case "search_records": {
            // Use Effect-based implementation with full validation
            const executor = searchRecordsExecutor(this.axiosInstance);
            return await runToolEffect(executor.execute(request.params.arguments));
          }

          case "get_record": {
            // Use Effect-based implementation with full validation
            const executor = getRecordExecutor(this.axiosInstance);
            return await runToolEffect(executor.execute(request.params.arguments));
          }

          default:
            throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${request.params.name}`);
        }
      } catch (error) {
        if (axios.isAxiosError(error)) {
          const airtableError = error.response?.data as AirtableError | undefined;
          const statusCode = error.response?.status;
          
          // Handle rate limiting
          if (statusCode === 429) {
            const retryAfter = error.response?.headers["retry-after"] as string | undefined;
            throw new RateLimitError(
              retryAfter !== undefined ? parseInt(retryAfter as string, 10) : undefined
            );
          }
          
          // Handle other API errors
          throw new AirtableApiError(
            airtableError?.error?.message ?? error.message,
            statusCode
          );
        }
        throw error;
      }
    });
  }

  async run(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error("Airtable MCP server running on stdio");
  }
}

const server = new AirtableServer();
server.run().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});
