import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { fic, getCompanyId } from "../ficClient.js";
import { runTool } from "../format.js";
import { textSearch } from "../query.js";

const listPaginationShape = {
  page: z.number().int().positive().optional().describe("Numero di pagina (default 1)."),
  perPage: z.number().int().positive().max(100).optional().describe("Elementi per pagina, max 100 (default 20)."),
  query: z.string().optional().describe("Testo da cercare nel nome/ragione sociale."),
};

export function registerAnagraficheTools(server: McpServer): void {
  server.registerTool(
    "fic_list_clients",
    {
      title: "Elenca clienti",
      description: "Elenca i clienti dell'azienda Fatture in Cloud, con ricerca testuale e paginazione.",
      inputSchema: listPaginationShape,
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async ({ page, perPage, query }) =>
      runTool(() =>
        fic
          .clients()
          .listClients(getCompanyId(), undefined, "detailed", undefined, page, perPage, textSearch(["name"], query))
          .then((res) => res.data),
      ),
  );

  server.registerTool(
    "fic_get_client",
    {
      title: "Dettaglio cliente",
      description: "Recupera i dettagli completi di un cliente a partire dal suo id.",
      inputSchema: { clientId: z.number().int().positive().describe("Id del cliente.") },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async ({ clientId }) =>
      runTool(() =>
        fic
          .clients()
          .getClient(getCompanyId(), clientId, undefined, "detailed")
          .then((res) => res.data),
      ),
  );

  server.registerTool(
    "fic_list_suppliers",
    {
      title: "Elenca fornitori",
      description: "Elenca i fornitori dell'azienda Fatture in Cloud, con ricerca testuale e paginazione.",
      inputSchema: listPaginationShape,
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async ({ page, perPage, query }) =>
      runTool(() =>
        fic
          .suppliers()
          .listSuppliers(getCompanyId(), undefined, "detailed", undefined, page, perPage, textSearch(["name"], query))
          .then((res) => res.data),
      ),
  );

  server.registerTool(
    "fic_get_supplier",
    {
      title: "Dettaglio fornitore",
      description: "Recupera i dettagli completi di un fornitore a partire dal suo id.",
      inputSchema: { supplierId: z.number().int().positive().describe("Id del fornitore.") },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async ({ supplierId }) =>
      runTool(() =>
        fic
          .suppliers()
          .getSupplier(getCompanyId(), supplierId, undefined, "detailed")
          .then((res) => res.data),
      ),
  );
}
