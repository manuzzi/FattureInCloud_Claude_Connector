import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { fic, getCompanyId } from "../ficClient.js";
import { runTool } from "../format.js";
import { textSearch } from "../query.js";

export function registerCatalogoTools(server: McpServer): void {
  server.registerTool(
    "fic_list_products",
    {
      title: "Elenca prodotti/servizi",
      description:
        "Elenca il catalogo prodotti/servizi dell'azienda, inclusi prezzo, aliquota IVA predefinita e livello di magazzino se gestito.",
      inputSchema: {
        page: z.number().int().positive().optional().describe("Numero di pagina (default 1)."),
        perPage: z.number().int().positive().max(100).optional().describe("Elementi per pagina, max 100 (default 20)."),
        query: z.string().optional().describe("Testo da cercare nel nome del prodotto/servizio."),
      },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async ({ page, perPage, query }) =>
      runTool(() =>
        fic
          .products()
          .listProducts(getCompanyId(), undefined, "detailed", undefined, page, perPage, textSearch(["name"], query))
          .then((res) => res.data),
      ),
  );

  server.registerTool(
    "fic_get_product",
    {
      title: "Dettaglio prodotto/servizio",
      description: "Recupera i dettagli completi di un prodotto/servizio a partire dal suo id, incluso lo stock corrente.",
      inputSchema: { productId: z.number().int().positive().describe("Id del prodotto/servizio.") },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async ({ productId }) =>
      runTool(() =>
        fic
          .products()
          .getProduct(getCompanyId(), productId, undefined, "detailed")
          .then((res) => res.data),
      ),
  );

  server.registerTool(
    "fic_list_vat_types",
    {
      title: "Elenca aliquote IVA",
      description:
        "Elenca le aliquote IVA configurate sull'azienda, con i relativi id. Utile per comporre le righe di preventivi/fatture con l'aliquota corretta.",
      inputSchema: {},
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async () =>
      runTool(() =>
        fic
          .info()
          .listVatTypes(getCompanyId(), "detailed")
          .then((res) => res.data),
      ),
  );
}
