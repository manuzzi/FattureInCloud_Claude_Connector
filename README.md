# FattureInCloud_Claude_Connector

Connettore MCP per Claude Desktop che collega [Fatture in Cloud](https://fattureincloud.it) per:

- analizzare anagrafiche clienti/fornitori, catalogo prodotti/servizi, preventivi, fatture, corrispettivi e situazione incassi;
- creare nuovi **preventivi** e **fatture** per un cliente esistente.

Il connettore **non implementa mai** l'invio email o la trasmissione allo SDI: crea solo il documento. L'emissione definitiva resta un'azione manuale da completare direttamente in Fatture in Cloud.

## Installazione (Claude Desktop)

1. Genera un access token personale dal [developer hub di Fatture in Cloud](https://developers.fattureincloud.it) e recupera il `company_id` dell'azienda su cui vuoi operare.
2. Compila il pacchetto `.mcpb`:
   ```bash
   npm install
   npm run build
   npx @anthropic-ai/mcpb pack . fattureincloud-claude-connector.mcpb
   ```
3. In Claude Desktop: Settings → Extensions → Install Extension… e seleziona il file `.mcpb` generato.
4. Inserisci l'access token e il company id nelle impostazioni dell'estensione.

## Sviluppo locale

```bash
npm install
cp .env.example .env   # compila FIC_ACCESS_TOKEN e FIC_COMPANY_ID
npm run build
node --env-file=.env build/index.js
```

Per il type-check senza compilare: `npm run typecheck`.

## Tool disponibili

| Tool | Descrizione |
| --- | --- |
| `fic_list_clients` / `fic_get_client` | Anagrafica clienti |
| `fic_list_suppliers` / `fic_get_supplier` | Anagrafica fornitori |
| `fic_list_products` / `fic_get_product` | Catalogo prodotti/servizi e stock |
| `fic_list_vat_types` | Aliquote IVA configurate |
| `fic_list_quotes` / `fic_list_invoices` / `fic_get_document` | Lettura preventivi e fatture |
| `fic_create_quote` | Crea un preventivo |
| `fic_create_invoice_draft` | Crea una fattura (mai inviata/emessa in automatico) |
| `fic_list_receipts` | Corrispettivi |
| `fic_get_scadenzario` | Rate/pagamenti non ancora incassati |
| `fic_get_company_info` | Info azienda (utile come test di connessione) |
| `fic_get_revenue_summary` | Riepilogo fatturato per intervallo di date |
