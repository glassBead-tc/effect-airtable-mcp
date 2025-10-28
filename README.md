# Effect Airtable MCP Server

A **production-ready** Model Context Protocol server for Airtable, built with [Effect](https://effect.website/) for type-safe, composable, and robust API interactions. This server enables programmatic management of Airtable bases, tables, fields, and records through Claude Desktop or other MCP clients.

## Why Effect?

This server leverages the Effect library to provide:

- **Type Safety**: Full end-to-end type safety from input validation to output serialization
- **Error Handling**: Structured error types with automatic validation and retries
- **Composability**: Modular tool architecture with reusable validation pipelines
- **Testability**: Pure functions and Effect-based testing without mocking
- **Reliability**: Contract-driven design catches API changes at validation boundaries

Unlike traditional implementations, this server features:
- **Staged Table Creation**: Builds complex tables incrementally to minimize API failures
- **Schema Validation**: Zod schemas ensure correctness at runtime
- **Automatic Retries**: Effect-based retry logic for transient failures
- **Developer Experience**: Comprehensive error messages and type inference

## Requirements: Node.js

1. Install Node.js (version 18 or higher) and npm from [nodejs.org](https://nodejs.org/)
2. Verify installation:
   ```bash
   node --version
   npm --version
   ```

⚠️ **Important**: Before running, make sure to setup your Airtable API key

## Obtaining an Airtable API Key

1. Log in to your Airtable account at [airtable.com](https://airtable.com)
2. Create a personal access token at [Airtable's Builder Hub](https://airtable.com/create/tokens)
3. In the Personal access token section select these scopes: 
     - data.records:read
     - data.records:write
     - schema.bases:read
     - schema.bases:write
4. Select the workspace or bases you want to give access to the personal access token
5. Keep this key secure - you'll need it for configuration

## Installation

### Method 1: Using npx (Recommended)
1. Navigate to the Claude configuration directory:

   - Windows: `C:\Users\NAME\AppData\Roaming\Claude`
   - macOS: `~/Library/Application Support/Claude/`
   
   You can also find these directories inside the Claude Desktop app: Claude Desktop > Settings > Developer > Edit Config

2. Create or edit `claude_desktop_config.json`:
```json
{
  "mcpServers": {
    "airtable-effect": {
      "command": "npx",
      "args": ["@kastalien-research/effect-airtable-mcp"],
      "env": {
        "AIRTABLE_API_KEY": "your_api_key_here"
      }
    }
  }
}
```
Note: For Windows paths, use double backslashes (\\) or forward slashes (/).

### Method 2: Local Development Installation
If you want to contribute or modify the code:
```bash
# Clone the repository
git clone https://github.com/glassBead-tc/effect-airtable-mcp.git
cd effect-airtable-mcp

# Install dependencies
npm install

# Build the server
npm run build

# Run tests
npm test

# Run locally
node build/index.js
```
Then modify the Claude Desktop configuration file to use the local installation:
```json
{
  "mcpServers": {
    "airtable-effect": {
      "command": "node",
      "args": ["/absolute/path/to/effect-airtable-mcp/build/index.js"],
      "env": {
        "AIRTABLE_API_KEY": "your_api_key_here"
      }
    }
  }
}
```

### Verifying Installation

1. Start Claude Desktop
2. The Airtable MCP server should be listed in the "Connected MCP Servers" section
3. Test with a simple command:
```
List all bases
```

## Architecture

### Effect-Based Design

This server uses a **contract-driven architecture** powered by Effect:

```typescript
// Every tool follows this pattern:
ToolExecutor {
  1. Validate Input (Zod schema)
  2. Execute Operation (Effect workflow)
  3. Validate Output (Zod schema)
  4. Check Postconditions (business rules)
  → Return typed result or structured error
}
```

**Key Components:**

- **`ToolExecutor`**: Generic execution framework with validation pipeline
- **`mcp-adapter`**: Bridges Effect workflows to MCP protocol
- **Schema Modules**: Zod schemas for all inputs/outputs (bases, tables, fields, records)
- **Tool Modules**: Pure Effect-based operations with no side effects until execution

**Error Handling:**

- `InputValidationError`: Invalid tool arguments
- `OutputValidationError`: Unexpected API response (catches breaking changes)
- `AirtableApiError`: HTTP errors with context and retry logic
- `PostconditionError`: Business rule violations

See [`src/docs/effect-architecture.md`](src/docs/effect-architecture.md) for detailed documentation.

## Features

### Available Operations

#### Base Management
- `list_bases`: List all accessible Airtable bases
- `list_tables`: List all tables in a base
- `create_table`: Create a new table with fields
- `update_table`: Update a table's name or description

#### Field Management
- `create_field`: Add a new field to a table
- `update_field`: Modify an existing field

#### Record Operations
- `list_records`: Retrieve records from a table
- `create_record`: Add a new record
- `update_record`: Modify an existing record
- `delete_record`: Remove a record
- `search_records`: Find records matching criteria
- `get_record`: Get a single record by its ID

### Field Types
- `singleLineText`: Single line text field
- `multilineText`: Multi-line text area
- `email`: Email address field
- `phoneNumber`: Phone number field
- `number`: Numeric field with optional precision
- `currency`: Money field with currency symbol
- `date`: Date field with format options
- `singleSelect`: Single choice from options
- `multiSelect`: Multiple choices from options

### Field Colors
Available colors for select fields:
- `blueBright`, `redBright`, `greenBright`
- `yellowBright`, `purpleBright`, `pinkBright`
- `grayBright`, `cyanBright`, `orangeBright`
- `blueDark1`, `greenDark1`

## Contributing

We welcome contributions to improve the Effect Airtable MCP server!

### Quick Start

1. Fork and clone:
   ```bash
   git clone https://github.com/your-username/effect-airtable-mcp.git
   cd effect-airtable-mcp
   npm install
   ```

2. Create a feature branch:
   ```bash
   git checkout -b feature/your-feature-name
   ```

3. Make your changes following Effect patterns (see `src/docs/effect-architecture.md`)

4. Run tests and linting:
   ```bash
   npm test
   npm run lint
   npm run format:check
   ```

5. Commit and push:
   ```bash
   git add .
   git commit -m "feat: add your feature description"
   git push origin feature/your-feature-name
   ```

6. Open a Pull Request at https://github.com/glassBead-tc/effect-airtable-mcp

### Development Guidelines

- **Use Effect patterns**: All tools use `ToolExecutor` with Zod validation
- **Type safety**: No `any` types, strict TypeScript enabled
- **Testing**: Write Effect-based tests (no mocking needed)
- **Error handling**: Use structured `ToolError` types
- **Documentation**: Update schemas and tool descriptions
- **Commits**: Follow semantic commit messages (feat/fix/docs/refactor)

### Getting Help

- Open an issue for bugs or feature requests
- Join discussions in existing issues
- Ask questions in pull requests

Your contributions help make this tool better for everyone. Whether it's:
- Adding new features
- Fixing bugs
- Improving documentation
- Suggesting enhancements

We appreciate your help in making the Airtable MCP server more powerful and user-friendly!

## License

[MIT](LICENSE)

---

Made with ❤️ by the Airtable MCP community
