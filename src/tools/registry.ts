import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerAnagraficheTools } from "./anagrafiche.js";
import { registerCatalogoTools } from "./catalogo.js";
import { registerDocumentiTools } from "./documenti.js";
import { registerIncassiTools } from "./incassi.js";
import { registerReportTools } from "./report.js";

export function registerAllTools(server: McpServer): void {
  registerAnagraficheTools(server);
  registerCatalogoTools(server);
  registerDocumentiTools(server);
  registerIncassiTools(server);
  registerReportTools(server);
}
