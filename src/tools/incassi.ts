import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { IssuedDocument } from "@fattureincloud/fattureincloud-ts-sdk";
import { fic, getCompanyId } from "../ficClient.js";
import { runTool } from "../format.js";
import { dateRange, textSearch } from "../query.js";

interface PendingPayment {
  documentId: number | null | undefined;
  documentNumber: number | null | undefined;
  client: string | null | undefined;
  dueDate: string | null | undefined;
  amount: number | null | undefined;
  overdue: boolean;
}

function flattenPendingPayments(documents: IssuedDocument[], today: string): PendingPayment[] {
  const pending: PendingPayment[] = [];
  for (const doc of documents) {
    for (const payment of doc.payments_list ?? []) {
      if (payment.status !== "not_paid") continue;
      pending.push({
        documentId: doc.id,
        documentNumber: doc.number,
        client: doc.entity?.name,
        dueDate: payment.due_date,
        amount: payment.amount,
        overdue: !!payment.due_date && payment.due_date < today,
      });
    }
  }
  return pending.sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? ""));
}

export function registerIncassiTools(server: McpServer): void {
  server.registerTool(
    "fic_list_receipts",
    {
      title: "Elenca corrispettivi",
      description: "Elenca i corrispettivi (ricevute/incassi giornalieri) registrati sull'azienda.",
      inputSchema: {
        page: z.number().int().positive().optional().describe("Numero di pagina (default 1)."),
        perPage: z.number().int().positive().max(100).optional().describe("Elementi per pagina, max 100 (default 20)."),
        query: z.string().optional().describe("Testo da cercare nella descrizione del corrispettivo."),
      },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async ({ page, perPage, query }) =>
      runTool(() =>
        fic
          .receipts()
          .listReceipts(getCompanyId(), undefined, "detailed", page, perPage, undefined, textSearch(["description"], query))
          .then((res) => res.data),
      ),
  );

  server.registerTool(
    "fic_get_scadenzario",
    {
      title: "Scadenzario incassi",
      description:
        "Calcola l'elenco delle rate/pagamenti non ancora incassati sulle fatture emesse in un intervallo di date, evidenziando quelli scaduti. Utile per analizzare la situazione crediti verso clienti.",
      inputSchema: {
        dateFrom: z.string().describe("Data minima delle fatture da considerare, formato YYYY-MM-DD."),
        dateTo: z.string().describe("Data massima delle fatture da considerare, formato YYYY-MM-DD."),
        onlyOverdue: z.boolean().optional().describe("Se true, restituisce solo le rate già scadute (default false)."),
      },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async ({ dateFrom, dateTo, onlyOverdue }) =>
      runTool(async () => {
        const today = new Date().toISOString().slice(0, 10);
        const response = await fic
          .issuedDocuments()
          .listIssuedDocuments(
            getCompanyId(),
            "invoice",
            undefined,
            "detailed",
            undefined,
            1,
            100,
            dateRange("date", dateFrom, dateTo),
          );
        const documents = response.data.data ?? [];
        const payments = flattenPendingPayments(documents, today);
        return onlyOverdue ? payments.filter((p) => p.overdue) : payments;
      }),
  );
}
