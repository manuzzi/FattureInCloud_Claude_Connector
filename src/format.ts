import axios from "axios";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

export function jsonResult(data: unknown): CallToolResult {
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
}

export function errorResult(message: string): CallToolResult {
  return { content: [{ type: "text", text: message }], isError: true };
}

function describeError(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const status = err.response?.status;
    const body = err.response?.data as { error?: { message?: string } } | undefined;
    const apiMessage = body?.error?.message;
    switch (status) {
      case 401:
        return "Autenticazione fallita: l'access token di Fatture in Cloud non è valido o è scaduto. Verifica il token configurato nell'estensione.";
      case 403:
        return "Accesso negato da Fatture in Cloud: il token non ha i permessi necessari per questa operazione.";
      case 404:
        return "Risorsa non trovata su Fatture in Cloud (id errato o non più esistente).";
      case 422:
        return `Richiesta non valida per Fatture in Cloud${apiMessage ? `: ${apiMessage}` : "."}`;
      case 429:
        return "Limite di richieste raggiunto (rate limit) su Fatture in Cloud: riprova tra qualche istante.";
      default:
        return `Errore dall'API di Fatture in Cloud${status ? ` (HTTP ${status})` : ""}${apiMessage ? `: ${apiMessage}` : "."}`;
    }
  }
  return err instanceof Error ? err.message : String(err);
}

export async function runTool(fn: () => Promise<unknown>): Promise<CallToolResult> {
  try {
    const data = await fn();
    return jsonResult(data);
  } catch (err) {
    return errorResult(describeError(err));
  }
}
