import express from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { ManagedRuntime } from "effect";
import { AirtableClient } from "./airtable-client.js";
import { createOperationsCatalog } from "./code-mode/operations.js";
import { registerAllTools } from "./tools/index.js";

const PORT = parseInt(process.env.PORT ?? "3030", 10);

const runtime = ManagedRuntime.make(AirtableClient.Default);

async function main(): Promise<void> {
  // The runtime builds its layer lazily — resolve the service now so a
  // missing AIRTABLE_API_KEY fails at startup, not on the first request.
  const client = await runtime.runPromise(AirtableClient);
  const catalog = createOperationsCatalog(client);

  const app = express();
  app.use(express.json());

  app.post("/mcp", async (req, res) => {
    const server = new McpServer({
      name: "airtable-mcp",
      version: "1.0.0",
    });
    registerAllTools(server, catalog, runtime);
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });
    res.on("close", () => {
      transport.close().catch(console.error);
      server.close().catch(console.error);
    });
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  });

  app.get("/mcp", (_req, res) => {
    res.status(405).end();
  });
  app.delete("/mcp", (_req, res) => {
    res.status(405).end();
  });
  app.put("/mcp", (_req, res) => {
    res.status(405).end();
  });

  app.get("/health", (_req, res) => {
    res.json({ status: "ok", server: "airtable-mcp", version: "1.0.0" });
  });

  const httpServer = app.listen(PORT, "127.0.0.1", () => {
    console.log(`Airtable MCP server listening on http://127.0.0.1:${PORT}/mcp`);
  });

  const shutdown = (): void => {
    httpServer.close(() => {
      runtime.dispose().then(
        () => process.exit(0),
        () => process.exit(1)
      );
    });
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((error: unknown) => {
  console.error("Fatal startup error:", error);
  process.exit(1);
});
