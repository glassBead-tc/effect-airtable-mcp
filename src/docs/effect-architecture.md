# Effect Architecture Guide

## Overview

This MCP server uses [Effect](https://effect.website/) to build a **contract-driven, type-safe architecture** for Airtable API interactions. Unlike traditional promise-based implementations, Effect provides composable, testable workflows with structured error handling.

## Core Philosophy

### Contract-Driven Design

Every tool operation follows a strict validation contract:

```
Input → Validation → Operation → Validation → Output
  ↓         ↓            ↓           ↓          ↓
Raw      Zod         Effect       Zod      Typed
JSON    Schema      Workflow     Schema    Result
```

**Benefits:**
- Catches invalid inputs before API calls (saves quota)
- Detects API changes at validation boundaries (early warning)
- Provides clear error messages with context
- Ensures type safety end-to-end

### Why Effect?

| Feature | Traditional Promises | Effect-based |
|---------|---------------------|--------------|
| Type Safety | Limited | Full end-to-end |
| Error Handling | try/catch, mixed errors | Typed errors in signature |
| Composition | Callback chaining | Pure function composition |
| Testing | Requires mocking | No mocks needed |
| Retries | Manual implementation | Built-in with policies |
| Tracing | Manual logging | Structured context |

## Architecture Components

### 1. ToolExecutor (Core Framework)

Located in `src/execution/tool-executor.ts`

Generic execution framework that all 12 tools use:

```typescript
class ToolExecutor<I, O, E extends ToolError> {
  constructor({
    name: string,
    inputSchema: z.ZodSchema<I>,
    outputSchema: z.ZodSchema<O>,
    operation: (input: I) => Effect<unknown, E>,
    postconditions?: Array<(output: O) => Effect<void, PostconditionError>>
  })

  execute(rawInput: unknown): Effect<O, InputValidationError | OutputValidationError | PostconditionError | E>
}
```

**Pipeline:**
1. **Input Validation**: Parse `rawInput` against `inputSchema` → `I` or `InputValidationError`
2. **Operation Execution**: Run `operation(I)` → `unknown` or `E`
3. **Output Validation**: Parse result against `outputSchema` → `O` or `OutputValidationError`
4. **Postcondition Checks**: Verify business rules → `void` or `PostconditionError`
5. **Return**: `O` (success) or structured error

### 2. MCP Adapter

Located in `src/adapters/mcp-adapter.ts`

Bridges Effect workflows to MCP protocol:

```typescript
async function runToolEffect<O>(
  effect: Effect<O, ToolError>
): Promise<MCPToolResponse>
```

**Responsibilities:**
- Execute Effect workflow via `Effect.runPromise`
- Convert Effect errors to MCP errors with appropriate codes
- Serialize successful output as JSON text content

**Error Mapping:**

| ToolError Type | MCP Error Code | Meaning |
|----------------|----------------|---------|
| `InputValidationError` | `InvalidParams` | User provided invalid arguments |
| `OutputValidationError` | `InternalError` | API response doesn't match schema |
| `AirtableApiError` (4xx) | `InvalidParams` | Bad request/not found |
| `AirtableApiError` (401/403) | `InvalidRequest` | Authentication issue |
| `AirtableApiError` (429/5xx) | `InternalError` | Rate limit/server error |
| `PostconditionError` | `InternalError` | Business rule violation |

### 3. Schema Modules

Located in `src/schemas/`

Zod schemas for all Airtable entities:

```
schemas/
├── index.ts          # Re-exports all schemas
├── bases.ts          # Base operations (list_bases, etc.)
├── tables.ts         # Table operations (create_table, update_table)
├── fields.ts         # Field operations (create_field, update_field)
└── records.ts        # Record operations (CRUD, search)
```

**Example:**

```typescript
// src/schemas/records.ts
export const CreateRecordInputSchema = z.object({
  base_id: z.string().min(1),
  table_name: z.string().min(1),
  fields: z.record(z.unknown())
});

export const CreateRecordOutputSchema = z.object({
  id: z.string(),
  fields: z.record(z.unknown()),
  createdTime: z.string()
});
```

### 4. Tool Modules

Located in `src/tools/`

Pure Effect-based operations:

```typescript
// src/tools/create-record.ts
export const createRecordExecutor = new ToolExecutor({
  name: "create_record",
  inputSchema: CreateRecordInputSchema,
  outputSchema: CreateRecordOutputSchema,
  operation: (input) => 
    Effect.tryPromise({
      try: () => axiosInstance.post(...),
      catch: (error) => new AirtableApiError(...)
    })
});
```

**Key Points:**
- No direct axios calls in tool code (wrapped in Effect)
- All errors are typed (no throwing)
- Operations are pure until executed by MCP adapter
- Testable without mocking (use Effect test utilities)

### 5. Error Types

Located in `src/errors/tool-errors.ts`

Structured error hierarchy:

```typescript
// All tool errors extend this base
type ToolError =
  | InputValidationError
  | OutputValidationError
  | AirtableApiError
  | PostconditionError;

// Example: Input validation error
class InputValidationError extends Data.TaggedError("InputValidationError")<{
  toolName: string;
  issues: ZodIssue[];
  context?: Record<string, unknown>;
}> {}
```

**Benefits:**
- Type-safe error handling (no `unknown` catches)
- Structured context for debugging
- Discriminated unions for exhaustive handling
- Automatic serialization to MCP format

## Tool Implementation Pattern

Every tool follows this pattern:

### Step 1: Define Schemas

```typescript
// src/schemas/my-operation.ts
import { z } from "zod";

export const MyOperationInputSchema = z.object({
  base_id: z.string(),
  // ... other fields
});

export const MyOperationOutputSchema = z.object({
  id: z.string(),
  // ... other fields
});

export type MyOperationInput = z.infer<typeof MyOperationInputSchema>;
export type MyOperationOutput = z.infer<typeof MyOperationOutputSchema>;
```

### Step 2: Create Tool Executor

```typescript
// src/tools/my-operation.ts
import { Effect } from "effect";
import { ToolExecutor } from "../execution/tool-executor.js";
import { AirtableApiError } from "../errors/tool-errors.js";
import { MyOperationInputSchema, MyOperationOutputSchema } from "../schemas/my-operation.js";
import type { AxiosInstance } from "axios";

export function createMyOperationExecutor(axiosInstance: AxiosInstance) {
  return new ToolExecutor({
    name: "my_operation",
    inputSchema: MyOperationInputSchema,
    outputSchema: MyOperationOutputSchema,
    operation: (input) =>
      Effect.tryPromise({
        try: async () => {
          const response = await axiosInstance.post(
            `/v0/${input.base_id}/myEndpoint`,
            { ...input }
          );
          return response.data;
        },
        catch: (error) => {
          return new AirtableApiError({
            message: error.message,
            statusCode: error.response?.status,
            context: { operation: "my_operation", input }
          });
        }
      })
  });
}
```

### Step 3: Register in MCP Server

```typescript
// src/index.ts
case "my_operation": {
  return await runToolEffect(
    myOperationExecutor.execute(request.params.arguments)
  );
}
```

## Testing with Effect

Effect enables testing without mocks:

```typescript
import { describe, it, expect } from "vitest";
import { Effect } from "effect";
import { createRecordExecutor } from "../tools/create-record.js";

describe("create_record", () => {
  it("validates input schema", async () => {
    const result = await Effect.runPromise(
      Effect.either(
        createRecordExecutor.execute({ /* invalid input */ })
      )
    );
    
    expect(result._tag).toBe("Left");
    expect(result.left._tag).toBe("InputValidationError");
  });
  
  it("creates record with valid input", async () => {
    const result = await Effect.runPromise(
      createRecordExecutor.execute({
        base_id: "appXXX",
        table_name: "Tasks",
        fields: { Name: "Test" }
      })
    );
    
    expect(result).toHaveProperty("id");
  });
});
```

## Performance Considerations

### Validation Overhead

Zod validation adds ~1-5ms per operation. This is negligible compared to:
- Network latency (50-500ms)
- Airtable API processing (100-1000ms)

**Trade-off:** Minimal overhead for significant reliability gains.

### Effect Runtime

Effect's runtime is optimized for:
- Zero-cost abstractions (compiled away)
- Efficient error handling (no try/catch overhead)
- Lazy evaluation (only runs when executed)

## Migration from Traditional Implementation

### Before (Promise-based)

```typescript
async function createRecord(input: any) {
  try {
    // No input validation
    const response = await axios.post(...);
    // No output validation
    return response.data;
  } catch (error) {
    // Untyped error
    throw new Error("Something went wrong");
  }
}
```

### After (Effect-based)

```typescript
const createRecordExecutor = new ToolExecutor({
  name: "create_record",
  inputSchema: CreateRecordInputSchema,    // ✅ Input validation
  outputSchema: CreateRecordOutputSchema,  // ✅ Output validation
  operation: (input) =>                    // ✅ Typed input
    Effect.tryPromise({
      try: () => axios.post(...),
      catch: (e) => new AirtableApiError(e) // ✅ Typed error
    })
});
```

## Best Practices

### 1. Keep Operations Pure

```typescript
// ❌ Bad: Side effects in operation
operation: (input) => {
  console.log("Creating record...");  // Side effect
  return Effect.tryPromise(...);
}

// ✅ Good: Pure operation
operation: (input) =>
  Effect.tryPromise(...)
  .pipe(
    Effect.tap((result) => Effect.log(`Created: ${result.id}`))
  )
```

### 2. Use Structured Errors

```typescript
// ❌ Bad: Generic error
throw new Error("API call failed");

// ✅ Good: Structured error with context
return new AirtableApiError({
  message: "Failed to create record",
  statusCode: response.status,
  context: { base_id, table_name, fields }
});
```

### 3. Validate Incrementally

```typescript
// For complex table creation, validate in stages:
1. Create table with basic fields (validated)
2. Add complex fields one by one (validated)
3. Verify final state (postcondition)
```

### 4. Leverage Type Inference

```typescript
// Let TypeScript infer types from schemas
type Input = z.infer<typeof MyInputSchema>;
type Output = z.infer<typeof MyOutputSchema>;

// No need for separate interface definitions
```

## Debugging

### Enable Effect Logging

```typescript
import { Effect } from "effect";

// Add to tool operation
Effect.tap((result) => Effect.log("Operation result", result))
```

### Inspect Error Context

```typescript
if (result._tag === "Left") {
  console.log("Error type:", result.left._tag);
  console.log("Context:", result.left.context);
  console.log("Issues:", result.left.issues);
}
```

### Use MCP Inspector

```bash
npm run inspector
# Opens interactive tool debugger
```

## Resources

- [Effect Documentation](https://effect.website/docs/introduction)
- [Zod Documentation](https://zod.dev/)
- [MCP Protocol Spec](https://modelcontextprotocol.io/)
- [Airtable Web API](https://airtable.com/developers/web/api/introduction)

## Questions?

See also:
- [`error-handling.md`](./error-handling.md) - Deep dive on error types
- [`schema-validation.md`](./schema-validation.md) - Schema design patterns
- [`testing-guide.md`](./testing-guide.md) - Effect-based testing strategies
