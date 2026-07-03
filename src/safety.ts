/**
 * Guardia per il vincolo "solo bozze, mai invio/emissione":
 * - Il connettore non importa né chiama mai `IssuedEinvoicesApi`, `EmailsApi`,
 *   `IssuedDocumentsApi.scheduleEmail` o `IssuedDocumentsApi.getEmailData` in nessun tool.
 * - `assertDraftSafe` è una seconda barriera esplicita sul payload di creazione,
 *   per evitare regressioni se in futuro si aggiungono campi ai tool di scrittura.
 */
export function assertDraftSafe(payload: Record<string, unknown>): void {
  if (payload["e_invoice"] === true) {
    throw new Error(
      "Operazione non consentita: questo connettore può creare solo bozze e non deve mai marcare un documento come fattura elettronica da inviare allo SDI.",
    );
  }
}
