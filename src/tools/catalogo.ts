import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Product } from "@fattureincloud/fattureincloud-ts-sdk";
import { fic, getCompanyId } from "../ficClient.js";
import { runTool } from "../format.js";
import { textSearch } from "../query.js";

const productFieldsShape = {
  name: z.string().min(1).optional().describe("Nome del prodotto/servizio."),
  code: z.string().optional().describe("Codice/SKU del prodotto/servizio."),
  netPrice: z.number().nonnegative().optional().describe("Prezzo di vendita netto."),
  netCost: z.number().nonnegative().optional().describe("Costo di acquisto netto."),
  measure: z.string().optional().describe("Unità di misura (es. pz, kg, ora)."),
  description: z.string().optional().describe("Descrizione estesa del prodotto/servizio."),
  category: z.string().optional().describe("Categoria del prodotto/servizio."),
  notes: z.string().optional().describe("Note interne aggiuntive."),
  inStock: z.boolean().optional().describe("Se true, FIC tiene traccia della giacenza di magazzino per questo prodotto."),
  stockInitial: z.number().nonnegative().optional().describe("Giacenza iniziale di magazzino, rilevante solo se inStock è true."),
  defaultVatId: z
    .number()
    .int()
    .positive()
    .optional()
    .describe("Id dell'aliquota IVA predefinita (vedi fic_list_vat_types); se assente FIC applica l'aliquota di default dell'azienda."),
};

const createProductShape = {
  ...productFieldsShape,
  name: z.string().min(1).describe("Nome del prodotto/servizio."),
};

const updateProductShape = {
  productId: z.number().int().positive().describe("Id del prodotto/servizio da modificare (vedi fic_list_products)."),
  ...productFieldsShape,
};

function buildProductData(params: {
  name?: string;
  code?: string;
  netPrice?: number;
  netCost?: number;
  measure?: string;
  description?: string;
  category?: string;
  notes?: string;
  inStock?: boolean;
  stockInitial?: number;
  defaultVatId?: number;
}): Product {
  return {
    ...(params.name !== undefined ? { name: params.name } : {}),
    ...(params.code !== undefined ? { code: params.code } : {}),
    ...(params.netPrice !== undefined ? { net_price: params.netPrice } : {}),
    ...(params.netCost !== undefined ? { net_cost: params.netCost } : {}),
    ...(params.measure !== undefined ? { measure: params.measure } : {}),
    ...(params.description !== undefined ? { description: params.description } : {}),
    ...(params.category !== undefined ? { category: params.category } : {}),
    ...(params.notes !== undefined ? { notes: params.notes } : {}),
    ...(params.inStock !== undefined ? { in_stock: params.inStock } : {}),
    ...(params.stockInitial !== undefined ? { stock_initial: params.stockInitial } : {}),
    ...(params.defaultVatId !== undefined ? { default_vat: { id: params.defaultVatId } } : {}),
  };
}

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

  server.registerTool(
    "fic_create_product",
    {
      title: "Crea prodotto/servizio",
      description: "Crea un nuovo prodotto/servizio nel catalogo dell'azienda.",
      inputSchema: createProductShape,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    async (params) =>
      runTool(() =>
        fic
          .products()
          .createProduct(getCompanyId(), { data: buildProductData(params) })
          .then((res) => res.data),
      ),
  );

  server.registerTool(
    "fic_update_product",
    {
      title: "Modifica prodotto/servizio",
      description: "Modifica i campi indicati di un prodotto/servizio esistente. I campi non specificati restano invariati.",
      inputSchema: updateProductShape,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async ({ productId, ...fields }) =>
      runTool(() =>
        fic
          .products()
          .modifyProduct(getCompanyId(), productId, { data: buildProductData(fields) })
          .then((res) => res.data),
      ),
  );

  server.registerTool(
    "fic_delete_product",
    {
      title: "Elimina prodotto/servizio",
      description:
        "Elimina definitivamente un prodotto/servizio dal catalogo. L'operazione non è reversibile: usarla solo dopo conferma esplicita dell'utente.",
      inputSchema: { productId: z.number().int().positive().describe("Id del prodotto/servizio da eliminare.") },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
    },
    async ({ productId }) =>
      runTool(() =>
        fic
          .products()
          .deleteProduct(getCompanyId(), productId)
          .then(() => ({ deleted: true, productId })),
      ),
  );
}
