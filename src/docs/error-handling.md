# Error Handling Guide

## Overview

This server uses **structured, typed errors** throughout the Effect pipeline. Every error is an instance of a specific error class with rich context, making debugging and error handling predictable and type-safe.

## Error Type Hierarchy

```typescript
type ToolError =
  | InputValidationError
  | OutputValidationError
  | AirtableApiError
  | PostconditionError;
```

All tool errors are discriminated unions with a `_tag` property for pattern matching.

## Error Types

### 1. InputValidationError

**When:** User provides invalid arguments to a tool

**Structure:**
```typescript
class InputValidationError extends Data.TaggedError("InputValidationError")<{
  toolName: string;
  issues: ZodIssue[];
  context?: Record<string, unknown>;
}> {}
```

**Example:**
```typescript
// User calls create_record without required base_id
{
  _tag: "InputValidationError",
  toolName: "create_record",
  issues: [
    {
      code: "invalid_type",
      expected: "string",
      received: "undefined",
      path: ["base_id"],
      message: "Required"
    }
  ],
  context: {
    rawInput: { table_name: "Tasks" }
  }
}
```

**MCP Error Code:** `InvalidParams`

**User Action:** Fix the tool arguments

### 2. OutputValidationError

**When:** Airtable API returns data that doesn't match expected schema

**Structure:**
```typescript
class OutputValidationError extends Data.TaggedError("OutputValidationError")<{
  toolName: string;
  issues: ZodIssue[];
  rawOutput: unknown;
}> {}
```

**Example:**
```typescript
// API returns record without 'id' field (schema change)
{
  _tag: "OutputValidationError",
  toolName: "create_record",
  issues: [
    {
      code: "invalid_type",
      expected: "string",
      received: "undefined",
      path: ["id"],
      message: "Required"
    }
  ],
  rawOutput: {
    fields: { Name: "Task 1" },
    createdTime: "2025-01-15T12:00:00.000Z"
    // missing 'id'
  }
}
```

**MCP Error Code:** `InternalError`

**User Action:** This indicates an API breaking change. Report to maintainers.

**Developer Action:** Update output schema to match new API contract

### 3. AirtableApiError

**When:** HTTP request to Airtable fails

**Structure:**
```typescript
class AirtableApiError extends Data.TaggedError("AirtableApiError")<{
  message: string;
  statusCode?: number;
  context?: Record<string, unknown>;
}> {}
```

**Examples:**

#### 400 Bad Request
```typescript
{
  _tag: "AirtableApiError",
  message: "Invalid field configuration",
  statusCode: 400,
  context: {
    operation: "create_field",
    base_id: "appXXX",
    table_id: "tblYYY",
    field: { name: "Price", type: "currency", options: {} }
  }
}
```

**MCP Error Code:** `InvalidParams`

#### 401 Unauthorized
```typescript
{
  _tag: "AirtableApiError",
  message: "Authentication required",
  statusCode: 401,
  context: {
    operation: "list_bases"
  }
}
```

**MCP Error Code:** `InvalidRequest`

**User Action:** Check `AIRTABLE_API_KEY` environment variable

#### 404 Not Found
```typescript
{
  _tag: "AirtableApiError",
  message: "Table not found",
  statusCode: 404,
  context: {
    operation: "list_records",
    base_id: "appXXX",
    table_name: "NonexistentTable"
  }
}
```

**MCP Error Code:** `InvalidParams`

#### 429 Rate Limit
```typescript
{
  _tag: "AirtableApiError",
  message: "Rate limit exceeded",
  statusCode: 429,
  context: {
    operation: "create_record",
    retryAfter: 30
  }
}
```

**MCP Error Code:** `InternalError`

**Handling:** Automatic retry with exponential backoff (if retry logic is enabled)

#### 500 Internal Server Error
```typescript
{
  _tag: "AirtableApiError",
  message: "Internal server error",
  statusCode: 500,
  context: {
    operation: "update_field"
  }
}
```

**MCP Error Code:** `InternalError`

**User Action:** Retry the operation. If persistent, check Airtable status page.

### 4. PostconditionError

**When:** Business rule validation fails after successful API call

**Structure:**
```typescript
class PostconditionError extends Data.TaggedError("PostconditionError")<{
  toolName: string;
  condition: string;
  actualState: unknown;
}> {}
```

**Example:**
```typescript
// Created record but verification fails
{
  _tag: "PostconditionError",
  toolName: "create_record",
  condition: "Record must be retrievable after creation",
  actualState: {
    recordId: "recXXX",
    verificationAttempts: 3,
    lastError: "404 Not Found"
  }
}
```

**MCP Error Code:** `InternalError`

**User Action:** This indicates eventual consistency issues or transient errors. Retry may succeed.

## Error Handling Patterns

### 1. Pattern Matching with Effect

```typescript
import { Effect, Match } from "effect";

const result = await Effect.runPromise(
  Effect.either(executor.execute(input))
);

if (result._tag === "Left") {
  Match.value(result.left).pipe(
    Match.tag("InputValidationError", (error) => {
      console.error("Invalid input:", error.issues);
      // Show user-friendly validation error
    }),
    Match.tag("OutputValidationError", (error) => {
      console.error("API schema mismatch:", error.issues);
      // Alert to potential breaking change
    }),
    Match.tag("AirtableApiError", (error) => {
      if (error.statusCode === 429) {
        // Handle rate limit
      } else if (error.statusCode === 401) {
        // Handle authentication
      }
    }),
    Match.tag("PostconditionError", (error) => {
      console.error("Business rule violated:", error.condition);
      // Retry or compensate
    }),
    Match.exhaustive
  );
}
```

### 2. Retry on Transient Errors

```typescript
import { Effect, Schedule } from "effect";

const withRetry = Effect.retry(
  executor.execute(input),
  Schedule.exponential("100 millis").pipe(
    Schedule.compose(Schedule.recurs(3))
  )
);
```

### 3. Fallback on Error

```typescript
import { Effect } from "effect";

const withFallback = executor.execute(input).pipe(
  Effect.catchTag("AirtableApiError", (error) => {
    if (error.statusCode === 429) {
      return Effect.succeed({ id: "pending", fields: {} });
    }
    return Effect.fail(error);
  })
);
```

### 4. Transform Errors

```typescript
import { Effect } from "effect";

const withTransformedError = executor.execute(input).pipe(
  Effect.mapError((error) => {
    if (error._tag === "InputValidationError") {
      return new UserFacingError({
        message: "Please check your input",
        details: error.issues
      });
    }
    return error;
  })
);
```

## MCP Error Code Mapping

| ToolError | HTTP Status | MCP Error Code | Meaning |
|-----------|-------------|----------------|---------|
| InputValidationError | N/A | InvalidParams | Client error - bad arguments |
| OutputValidationError | N/A | InternalError | Server error - schema mismatch |
| AirtableApiError | 400, 404 | InvalidParams | Client error - bad request |
| AirtableApiError | 401, 403 | InvalidRequest | Authentication/authorization |
| AirtableApiError | 429, 5xx | InternalError | Server error - rate limit/failure |
| PostconditionError | N/A | InternalError | Server error - business rule |

## Error Context Best Practices

### 1. Include Operation Details

```typescript
new AirtableApiError({
  message: error.message,
  statusCode: error.response?.status,
  context: {
    operation: "create_record",  // ✅ Which operation
    base_id: input.base_id,      // ✅ Which base
    table_name: input.table_name // ✅ Which table
  }
});
```

### 2. Include Input Snapshot

```typescript
new InputValidationError({
  toolName: "create_field",
  issues: zodError.issues,
  context: {
    rawInput: input,  // ✅ Full input for debugging
    timestamp: new Date().toISOString()
  }
});
```

### 3. Include State Information

```typescript
new PostconditionError({
  toolName: "create_table",
  condition: "Table must exist after creation",
  actualState: {
    tableId: response.id,
    verificationResult: verifyResult,  // ✅ What went wrong
    attempts: 3
  }
});
```

## Common Error Scenarios

### Scenario 1: Missing API Key

**Error:**
```typescript
AirtableApiError {
  statusCode: 401,
  message: "Authentication required"
}
```

**Solution:**
```bash
export AIRTABLE_API_KEY="your_key_here"
```

### Scenario 2: Invalid Field Options

**Error:**
```typescript
InputValidationError {
  issues: [{
    path: ["options", "precision"],
    message: "Required"
  }]
}
```

**Solution:**
```typescript
// Add required options
{
  name: "Price",
  type: "currency",
  options: {
    precision: 2,  // ✅ Required for currency
    symbol: "$"
  }
}
```

### Scenario 3: Rate Limit Exceeded

**Error:**
```typescript
AirtableApiError {
  statusCode: 429,
  message: "Rate limit exceeded"
}
```

**Solution:**
- Wait before retrying
- Implement exponential backoff
- Batch operations when possible

### Scenario 4: Schema Mismatch

**Error:**
```typescript
OutputValidationError {
  toolName: "list_records",
  issues: [{
    path: ["records", 0, "fields"],
    message: "Expected object, received null"
  }]
}
```

**Solution:**
- Check Airtable API changelog
- Update output schema
- Report breaking change to maintainers

## Testing Error Handling

### Test Input Validation

```typescript
it("rejects invalid input", async () => {
  const result = await Effect.runPromise(
    Effect.either(
      createRecordExecutor.execute({ /* missing base_id */ })
    )
  );
  
  expect(result._tag).toBe("Left");
  expect(result.left._tag).toBe("InputValidationError");
  expect(result.left.issues).toContainEqual(
    expect.objectContaining({
      path: ["base_id"],
      message: expect.stringContaining("Required")
    })
  );
});
```

### Test API Error Handling

```typescript
it("handles 404 not found", async () => {
  // Create executor with mock axios that returns 404
  const executor = createRecordExecutor(mock404Axios);
  
  const result = await Effect.runPromise(
    Effect.either(executor.execute(validInput))
  );
  
  expect(result._tag).toBe("Left");
  expect(result.left._tag).toBe("AirtableApiError");
  expect(result.left.statusCode).toBe(404);
});
```

### Test Postconditions

```typescript
it("fails postcondition when record not retrievable", async () => {
  const executor = new ToolExecutor({
    name: "create_record",
    inputSchema: CreateRecordInputSchema,
    outputSchema: CreateRecordOutputSchema,
    operation: createRecordOperation,
    postconditions: [
      (output) => verifyRecordExists(output.id)
    ]
  });
  
  // verifyRecordExists returns Effect.fail(PostconditionError)
  const result = await Effect.runPromise(
    Effect.either(executor.execute(validInput))
  );
  
  expect(result._tag).toBe("Left");
  expect(result.left._tag).toBe("PostconditionError");
});
```

## Debugging Errors

### Enable Detailed Logging

```typescript
import { Effect, Logger, LogLevel } from "effect";

Effect.runPromise(
  executor.execute(input).pipe(
    Effect.withLogLevel(LogLevel.Debug)
  )
);
```

### Inspect Error Chain

```typescript
const result = await Effect.runPromise(
  Effect.either(executor.execute(input))
);

if (result._tag === "Left") {
  console.log("Error type:", result.left._tag);
  console.log("Error details:", JSON.stringify(result.left, null, 2));
  
  if (result.left._tag === "InputValidationError") {
    result.left.issues.forEach((issue) => {
      console.log(`- ${issue.path.join(".")}: ${issue.message}`);
    });
  }
}
```

### Use MCP Inspector

```bash
npm run inspector
# Interactive tool debugging with full error context
```

## Resources

- [Effect Error Management](https://effect.website/docs/error-management/expected-errors)
- [Zod Error Handling](https://zod.dev/ERROR_HANDLING)
- [Airtable API Errors](https://airtable.com/developers/web/api/errors)
