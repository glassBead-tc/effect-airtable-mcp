import express from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createAirtableClient } from "./airtable-client.js";
import { registerAllTools } from "./tools/index.js";

const PORT = parseInt(process.env.PORT ?? "3000", 10);

function createServer(): McpServer {
  const server = new McpServer({
    name: "airtable-mcp",
    version: "1.0.0",
  });
  const client = createAirtableClient();
  registerAllTools(server, client);
  return server;
}

const app = express();
app.use(express.json());

app.post("/mcp", async (req, res) => {
  const server = createServer();
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

app.listen(PORT, "127.0.0.1", () => {
  console.log(`Airtable MCP server listening on http://127.0.0.1:${PORT}/mcp`);
});
