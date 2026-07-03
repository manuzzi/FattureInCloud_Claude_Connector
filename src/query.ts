/**
 * Helper per costruire espressioni valide per il parametro "q" di Fatture in Cloud,
 * che è un linguaggio simile a una WHERE SQL (vedi
 * https://developers.fattureincloud.it/docs/basics/filter-results/queries/):
 * operatori =, >, >=, <, <=, <>/!=, like, contains, starts with, ends with, is null,
 * stringhe tra apici singoli, combinazione con and/or e parentesi.
 */

export function quoteString(value: string): string {
  return `'${value.replace(/'/g, "\\'")}'`;
}

export function and(...parts: (string | undefined)[]): string | undefined {
  const clauses = parts.filter((p): p is string => !!p);
  if (clauses.length === 0) return undefined;
  if (clauses.length === 1) return clauses[0];
  return clauses.map((c) => `(${c})`).join(" and ");
}

export function dateRange(field: string, from?: string, to?: string): string | undefined {
  return and(from ? `${field} >= ${quoteString(from)}` : undefined, to ? `${field} <= ${quoteString(to)}` : undefined);
}

export function textSearch(fields: string[], text?: string): string | undefined {
  if (!text) return undefined;
  const escaped = quoteString(text);
  return fields.map((field) => `${field} contains ${escaped}`).join(" or ");
}
