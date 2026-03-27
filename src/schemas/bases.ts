import { z } from "zod";

/**
 * Base Schemas - Airtable Base entities and operations
 * Source: Airtable Web API /meta/bases endpoint
 */

// Core entity schemas
export const BaseSchema = z.object({
  id: z.string().describe("Unique identifier for the base (e.g., 'appXXXXXXXXXXXXXX')"),
  name: z.string().describe("Human-readable name of the base"),
  permissionLevel: z
    .enum(["none", "read", "comment", "edit", "create"])
    .describe("User's permission level for this base"),
});

export const BaseIdSchema = z
  .string()
  .regex(/^app[a-zA-Z0-9]{14}$/, "Base ID must be in format 'appXXXXXXXXXXXXXX'");

// Tool input schemas
export const ListBasesInputSchema = z.object({
  offset: z.string().optional().describe("Pagination token for the next page"),
});

// Tool output schemas
export const ListBasesOutputSchema = z.object({
  bases: z.array(BaseSchema),
  offset: z.string().optional().describe("Pagination token for the next page"),
});

// Derived TypeScript types
export type Base = z.infer<typeof BaseSchema>;
export type BaseId = z.infer<typeof BaseIdSchema>;
export type ListBasesInput = z.infer<typeof ListBasesInputSchema>;
export type ListBasesOutput = z.infer<typeof ListBasesOutputSchema>;
