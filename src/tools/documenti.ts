import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type {
  Client,
  CreateIssuedDocumentRequest,
  Entity,
  IssuedDocumentItemsListItem,
} from "@fattureincloud/fattureincloud-ts-sdk";
import { fic, getCompanyId } from "../ficClient.js";
import { runTool } from "../format.js";
import { assertDraftSafe } from "../safety.js";
import { and, dateRange, textSearch } from "../query.js";

const listDocumentsShape = {
  page: z.number().int().positive().optional().describe("Numero di pagina (default 1)."),
  perPage: z.number().int().positive().max(100).optional().describe("Elementi per pagina, max 100 (default 20)."),
  query: z.string().optional().describe("Testo da cercare nell'oggetto del documento (subject/visible_subject)."),
  dateFrom: z.string().optional().describe("Data minima nel formato YYYY-MM-DD (filtra su 'date')."),
  dateTo: z.string().optional().describe("Data massima nel formato YYYY-MM-DD (filtra su 'date')."),
};

function documentsQuery(query: string | undefined, dateFrom?: string, dateTo?: string): string | undefined {
  return and(textSearch(["subject", "visible_subject"], query), dateRange("date", dateFrom, dateTo));
}

const ENTITY_FIELDS_TO_COPY = [
  "id",
  "name",
  "first_name",
  "last_name",
  "type",
  "vat_number",
  "tax_code",
  "address_street",
  "address_postal_code",
  "address_city",
  "address_province",
  "address_extra",
  "country",
  "country_iso",
  "email",
  "certified_email",
  "phone",
] as const satisfies readonly (keyof Client)[];

function toDocumentEntity(client: Client): Entity {
  const entity: Record<string, unknown> = {};
  for (const field of ENTITY_FIELDS_TO_COPY) {
    if (client[field] !== undefined) entity[field] = client[field];
  }
  return entity as Entity;
}

const itemSchema = z.object({
  productId: z
    .number()
    .int()
    .positive()
    .optional()
    .describe("Id di un prodotto/servizio del catalogo (fic_list_products); se presente, FIC usa nome/prezzo del prodotto come base."),
  name: z.string().optional().describe("Descrizione della riga (obbligatoria se productId non è specificato)."),
  qty: z.number().positive().default(1).describe("Quantità."),
  netPrice: z
    .number()
    .nonnegative()
    .optional()
    .describe("Prezzo unitario netto; se assente viene usato il prezzo di listino del prodotto indicato."),
  vatId: z
    .number()
    .int()
    .positive()
    .optional()
    .describe("Id dell'aliquota IVA (vedi fic_list_vat_types); se assente viene usata l'aliquota predefinita del prodotto/azienda."),
});

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function buildItemsList(items: z.infer<typeof itemSchema>[]): IssuedDocumentItemsListItem[] {
  return items.map((item) => ({
    ...(item.productId !== undefined ? { product_id: item.productId } : {}),
    ...(item.name !== undefined ? { name: item.name } : {}),
    qty: round2(item.qty),
    ...(item.netPrice !== undefined ? { net_price: round2(item.netPrice) } : {}),
    ...(item.vatId !== undefined ? { vat: { id: item.vatId } } : {}),
  }));
}

const createDocumentShape = {
  clientId: z.number().int().positive().describe("Id del cliente destinatario (vedi fic_list_clients / fic_get_client)."),
  date: z.string().optional().describe("Data documento YYYY-MM-DD (default: oggi)."),
  subject: z.string().optional().describe("Oggetto del documento (non stampato sul PDF)."),
  visibleSubject: z.string().optional().describe("Oggetto visibile, stampato sul PDF."),
  notes: z.string().optional().describe("Note aggiuntive in calce al documento."),
  items: z.array(itemSchema).min(1).describe("Righe del documento: prodotti/servizi con quantità e prezzo."),
};

async function createDraftDocument(
  type: "quote" | "invoice",
  params: {
    clientId: number;
    date?: string;
    subject?: string;
    visibleSubject?: string;
    notes?: string;
    items: z.infer<typeof itemSchema>[];
  },
) {
  const companyId = getCompanyId();
  // Fatture in Cloud non autocompleta l'entity dai dati del cliente salvato:
  // vanno copiati esplicitamente, altrimenti il documento risulta senza intestatario.
  const client = await fic.clients().getClient(companyId, params.clientId, undefined, "detailed");
  if (!client.data.data) {
    throw new Error(`Cliente con id ${params.clientId} non trovato.`);
  }
  // FIC valida visible_subject/notes/subject come stringhe: null esplicito viene rifiutato
  // ("must be a string"), va omessa la chiave se il valore non è specificato.
  const data: CreateIssuedDocumentRequest["data"] = {
    type,
    entity: toDocumentEntity(client.data.data),
    ...(params.date !== undefined ? { date: params.date } : {}),
    ...(params.subject !== undefined ? { subject: params.subject } : {}),
    ...(params.visibleSubject !== undefined ? { visible_subject: params.visibleSubject } : {}),
    ...(params.notes !== undefined ? { notes: params.notes } : {}),
    items_list: buildItemsList(params.items),
    e_invoice: false,
  };
  assertDraftSafe(data as Record<string, unknown>);
  const response = await fic.issuedDocuments().createIssuedDocument(companyId, { data });
  return response.data;
}

export function registerDocumentiTools(server: McpServer): void {
  server.registerTool(
    "fic_list_quotes",
    {
      title: "Elenca preventivi",
      description: "Elenca i preventivi dell'azienda, con ricerca testuale, intervallo di date e paginazione.",
      inputSchema: listDocumentsShape,
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async ({ page, perPage, query, dateFrom, dateTo }) =>
      runTool(() =>
        fic
          .issuedDocuments()
          .listIssuedDocuments(
            getCompanyId(),
            "quote",
            undefined,
            "detailed",
            undefined,
            page,
            perPage,
            documentsQuery(query, dateFrom, dateTo),
          )
          .then((res) => res.data),
      ),
  );

  server.registerTool(
    "fic_list_invoices",
    {
      title: "Elenca fatture",
      description: "Elenca le fatture dell'azienda, con ricerca testuale, intervallo di date e paginazione.",
      inputSchema: listDocumentsShape,
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async ({ page, perPage, query, dateFrom, dateTo }) =>
      runTool(() =>
        fic
          .issuedDocuments()
          .listIssuedDocuments(
            getCompanyId(),
            "invoice",
            undefined,
            "detailed",
            undefined,
            page,
            perPage,
            documentsQuery(query, dateFrom, dateTo),
          )
          .then((res) => res.data),
      ),
  );

  server.registerTool(
    "fic_get_document",
    {
      title: "Dettaglio documento",
      description: "Recupera i dettagli completi di un documento emesso (preventivo, fattura, ecc.) a partire dal suo id.",
      inputSchema: { documentId: z.number().int().positive().describe("Id del documento.") },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async ({ documentId }) =>
      runTool(() =>
        fic
          .issuedDocuments()
          .getIssuedDocument(getCompanyId(), documentId, undefined, "detailed")
          .then((res) => res.data),
      ),
  );

  server.registerTool(
    "fic_create_quote",
    {
      title: "Crea preventivo",
      description:
        "Crea un nuovo preventivo per un cliente esistente. Il documento viene solo creato: non viene mai inviato via email né emesso.",
      inputSchema: createDocumentShape,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    async (params) => runTool(() => createDraftDocument("quote", params)),
  );

  server.registerTool(
    "fic_create_invoice_draft",
    {
      title: "Crea bozza fattura",
      description:
        "Crea una nuova fattura per un cliente esistente, come semplice creazione del documento: non viene mai inviata via email né trasmessa allo SDI. L'invio resta un'azione manuale da completare direttamente in Fatture in Cloud.",
      inputSchema: createDocumentShape,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    async (params) => runTool(() => createDraftDocument("invoice", params)),
  );
}
