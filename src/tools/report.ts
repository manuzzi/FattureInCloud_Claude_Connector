import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { IssuedDocument } from "@fattureincloud/fattureincloud-ts-sdk";
import { fic, getCompanyId } from "../ficClient.js";
import { runTool } from "../format.js";
import { dateRange } from "../query.js";

export function registerReportTools(server: McpServer): void {
  server.registerTool(
    "fic_get_company_info",
    {
      title: "Informazioni azienda",
      description:
        "Recupera le informazioni dell'azienda configurata (ragione sociale, regime fiscale, ecc.). Utile anche come test di connessione al connettore.",
      inputSchema: {},
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async () =>
      runTool(() =>
        fic
          .companies()
          .getCompanyInfo(getCompanyId())
          .then((res) => res.data),
      ),
  );

  server.registerTool(
    "fic_get_revenue_summary",
    {
      title: "Riepilogo fatturato",
      description:
        "Calcola un riepilogo del fatturato (totale, numero fatture, importo medio, totali per cliente) sulle fatture emesse in un intervallo di date.",
      inputSchema: {
        dateFrom: z.string().describe("Data minima delle fatture da considerare, formato YYYY-MM-DD."),
        dateTo: z.string().describe("Data massima delle fatture da considerare, formato YYYY-MM-DD."),
      },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async ({ dateFrom, dateTo }) =>
      runTool(async () => {
        const documents: IssuedDocument[] = [];
        let page = 1;
        for (;;) {
          const response = await fic
            .issuedDocuments()
            .listIssuedDocuments(
              getCompanyId(),
              "invoice",
              undefined,
              "detailed",
              undefined,
              page,
              100,
              dateRange("date", dateFrom, dateTo),
            );
          const pageData = response.data.data ?? [];
          documents.push(...pageData);
          const lastPage = response.data.last_page ?? page;
          if (page >= lastPage || pageData.length === 0) break;
          page += 1;
        }

        const byClient = new Map<string, { client: string; total: number; count: number }>();
        let totalGross = 0;
        for (const doc of documents) {
          const clientName = doc.entity?.name ?? "Cliente sconosciuto";
          const amount = doc.amount_gross ?? 0;
          totalGross += amount;
          const entry = byClient.get(clientName) ?? { client: clientName, total: 0, count: 0 };
          entry.total += amount;
          entry.count += 1;
          byClient.set(clientName, entry);
        }

        return {
          dateFrom,
          dateTo,
          invoiceCount: documents.length,
          totalGross,
          averageGross: documents.length > 0 ? totalGross / documents.length : 0,
          byClient: [...byClient.values()].sort((a, b) => b.total - a.total),
        };
      }),
  );
}
