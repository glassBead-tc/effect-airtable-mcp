# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Project Overview

Airtable MCP Server is a Model Context Protocol server that enables programmatic interaction with Airtable's API. It features a specialized staged table creation workflow designed to minimize failures when building complex tables through LLM agents.

## Common Development Commands

### Building and Running

```bash
# Build TypeScript source to build/ directory
npm run build

# Watch mode for development (rebuilds on file changes)
npm run watch

# Run the built server locally
node build/index.js

# Test with MCP inspector (interactive debugging)
npm run inspector
```

### Testing

```bash
# Run tests in watch mode
npm test

# Run tests once (for CI)
npm run test:run

# Run tests with UI interface
npm run test:ui

# Generate coverage report
npm run test:coverage
```

### Code Quality

```bash
# Lint TypeScript files
npm run lint

# Auto-fix linting issues
npm run lint:fix

# Format code with Prettier
npm run format

# Check code formatting
npm run format:check
```

### Git Hooks

The repository uses Husky for pre-commit hooks with lint-staged:
- Automatically runs `eslint --fix` and `prettier --write` on staged `.ts` files
- Formats staged JSON, JS, JSX, and MD files

## Architecture

### Core Components

**Server Entry Point (`src/index.ts`)**
- Initializes MCP server with stdio transport
- Configures Axios instance for Airtable API with Bearer authentication
- Implements tool handlers for all Airtable operations
- Uses retry logic with exponential backoff for API calls

**Type System (`src/types.ts`)**
- Defines Airtable data structures (bases, tables, fields, records)
- Field type definitions: `singleLineText`, `multilineText`, `number`, `singleSelect`, `multiSelect`, `date`, `checkbox`, `email`, `phoneNumber`, `currency`
- Type guards: `fieldRequiresOptions()` determines if field needs configuration
- Default options factory: `getDefaultOptions()` provides sensible defaults

**Error Handling (`src/errors.ts`)**
- `AirtableApiError`: Wraps Airtable API errors with context
- `RateLimitError`: Specialized handling for rate limit responses

**Retry Logic (`src/retry.ts`)**
- `withRetry()`: Exponential backoff for transient failures
- Handles rate limiting automatically

### Staged Table Creation Strategy

The server implements a unique workflow to prevent failures when creating complex tables:

1. **Initial Table Creation** - Create table with basic fields only (singleLineText, multilineText, email, phoneNumber)
2. **Incremental Field Addition** - Add complex fields one at a time using `create_field` tool
3. **Field Validation** - Validate each field's options match type requirements before proceeding
4. **Order of Operations** - Add fields in complexity order: basic → numeric → date/time → select → computed → relationships

This approach is documented in `prompts/system-prompt.md` and `prompts/project-knowledge.md` for LLM guidance.

### MCP Tools

**Base Management**
- `list_bases` - Enumerate accessible bases
- `list_tables` - List tables in a base
- `create_table` - Create new table with initial fields
- `update_table` - Modify table name/description

**Field Management**
- `create_field` - Add single field to existing table
- `update_field` - Modify field configuration

**Record Operations**
- `list_records` - Query records with filtering/sorting
- `create_record` - Insert new records
- `update_record` - Modify existing records
- `delete_record` - Remove records
- `search_records` - Find records by criteria
- `get_record` - Retrieve single record by ID

## Configuration

### Environment Variables

- `AIRTABLE_API_KEY` - Personal access token from Airtable (required)

### TypeScript Configuration

- Target: ES2022
- Module system: Node16 (ESM)
- Strict mode enabled
- Output: `build/` directory
- Source: `src/` directory

### Code Style

**ESLint Rules:**
- Explicit function return types required
- No `any` types allowed
- Strict boolean expressions
- Unused variables error (except prefixed with `_`)

**Prettier:**
- Semicolons: required
- Single quotes: false (use double quotes)
- Print width: 100
- Tab width: 2 spaces
- Trailing commas: ES5 style
- Line endings: LF

## Testing Strategy

Uses Vitest with:
- Node environment
- V8 coverage provider
- Coverage reports: text, JSON, HTML
- Excludes: `node_modules/`, `build/`, `scripts/`

Tests located in `tests/unit/` and `tests/integration/`

## Key Dependencies

- `@modelcontextprotocol/sdk@0.6.0` - MCP protocol implementation
- `axios@^1.7.9` - HTTP client for Airtable API
- Node.js >= 16.0.0

## Working with Airtable API

### Rate Limiting
- The server implements automatic retry with exponential backoff
- Respect Airtable's rate limits to avoid throttling
- Allow time between operations when creating multiple fields

### Field Options Requirements

Complex field types require specific options:
- **number/currency/percent**: `precision` (0-8)
- **date/dateTime**: `dateFormat` with name property
- **singleSelect/multiSelect**: `choices` array with name and color
- **rating**: `max` (1-10), `icon`, `color`

Use `fieldRequiresOptions()` and `getDefaultOptions()` helpers in `src/types.ts` for validation.

### Common Pitfalls

- Don't create tables with all fields at once - use staged creation
- Validate field options before submission to avoid API errors
- Handle async operations properly - verify completion before next step
- Check for rate limit errors and implement backoff
