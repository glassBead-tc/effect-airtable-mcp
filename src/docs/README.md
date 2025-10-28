# Effect Airtable MCP - Technical Documentation

This directory contains comprehensive documentation for the Effect-based architecture of the Airtable MCP server.

## Documentation Files

### 📘 [effect-architecture.md](./effect-architecture.md)
**Overview of the Effect-based design patterns and architecture**

Topics covered:
- Contract-driven design philosophy
- ToolExecutor framework
- MCP adapter layer
- Schema organization
- Tool implementation patterns
- Testing without mocks
- Performance considerations
- Best practices

**Read this first** if you're new to the codebase or want to understand why Effect was chosen.

### 🚨 [error-handling.md](./error-handling.md)
**Comprehensive guide to structured error types and handling**

Topics covered:
- Error type hierarchy (InputValidationError, OutputValidationError, AirtableApiError, PostconditionError)
- MCP error code mapping
- Error handling patterns
- Common error scenarios
- Testing error conditions
- Debugging techniques

**Essential reading** for understanding how errors flow through the system and how to handle them effectively.

## Quick Navigation

### For Contributors

1. **Adding a new tool?** → Start with [effect-architecture.md](./effect-architecture.md#tool-implementation-pattern)
2. **Handling errors?** → See [error-handling.md](./error-handling.md#error-handling-patterns)
3. **Writing tests?** → Check [effect-architecture.md](./effect-architecture.md#testing-with-effect)
4. **Debugging issues?** → Review [error-handling.md](./error-handling.md#debugging-errors)

### For Users

1. **Understanding validation errors?** → [error-handling.md](./error-handling.md#1-inputvalidationerror)
2. **API call failures?** → [error-handling.md](./error-handling.md#3-airtableapierror)
3. **Common scenarios?** → [error-handling.md](./error-handling.md#common-error-scenarios)

## Architecture at a Glance

```
User Input (JSON)
    ↓
[InputValidationError possible]
    ↓
Zod Schema Validation
    ↓
Effect Operation (API call)
    ↓
[AirtableApiError possible]
    ↓
Zod Schema Validation
    ↓
[OutputValidationError possible]
    ↓
Postcondition Checks
    ↓
[PostconditionError possible]
    ↓
Typed Output (Success!)
```

## Key Benefits of This Architecture

| Benefit | Description |
|---------|-------------|
| **Type Safety** | End-to-end type inference from schema to output |
| **Error Clarity** | Every error has context and a discriminated tag |
| **Validation** | Both input and output validated against schemas |
| **Testing** | Pure functions testable without mocks |
| **Composability** | Effect workflows compose naturally |
| **Debugging** | Structured errors with full context |

## External Resources

- [Effect Official Documentation](https://effect.website/)
- [Zod Documentation](https://zod.dev/)
- [Model Context Protocol Spec](https://modelcontextprotocol.io/)
- [Airtable Web API Documentation](https://airtable.com/developers/web/api/introduction)

## Contributing to Documentation

If you find gaps in the documentation or have suggestions:

1. Open an issue describing what's unclear
2. Submit a PR with documentation improvements
3. Add examples of real-world usage patterns

Good documentation examples:
- ✅ Show both correct and incorrect approaches
- ✅ Include copy-pasteable code snippets
- ✅ Explain the "why" not just the "what"
- ✅ Link to related sections and external resources
- ✅ Include common pitfalls and solutions

---

**Questions?** Open an issue at https://github.com/glassBead-tc/effect-airtable-mcp/issues
