import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerAllTools } from "./tools/registry.js";

const server = new McpServer({
  name: "fattureincloud-claude-connector",
  version: "1.1.0",
});

registerAllTools(server);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Fatture in Cloud connector: MCP server avviato su stdio.");
}

main().catch((err) => {
  console.error("Errore fatale nell'avvio del connettore Fatture in Cloud:", err);
  process.exit(1);
});
