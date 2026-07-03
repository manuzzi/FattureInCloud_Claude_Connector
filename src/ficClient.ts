import {
  ClientsApi,
  CompaniesApi,
  Configuration,
  InfoApi,
  IssuedDocumentsApi,
  ProductsApi,
  ReceiptsApi,
  SuppliersApi,
} from "@fattureincloud/fattureincloud-ts-sdk";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === "") {
    throw new Error(
      `Configurazione mancante: la variabile "${name}" non è impostata. ` +
        "Apri le impostazioni dell'estensione in Claude Desktop e inserisci il tuo access token e company id di Fatture in Cloud.",
    );
  }
  return value;
}

let configuration: Configuration | undefined;

function getConfiguration(): Configuration {
  if (!configuration) {
    configuration = new Configuration({ accessToken: requireEnv("FIC_ACCESS_TOKEN") });
  }
  return configuration;
}

let cachedCompanyId: number | undefined;

export function getCompanyId(): number {
  if (cachedCompanyId === undefined) {
    const raw = requireEnv("FIC_COMPANY_ID");
    const id = Number(raw);
    if (!Number.isInteger(id) || id <= 0) {
      throw new Error(`Il company id configurato ("${raw}") non è un numero valido.`);
    }
    cachedCompanyId = id;
  }
  return cachedCompanyId;
}

const apiInstances = new Map<string, unknown>();

function getApi<T>(key: string, factory: (config: Configuration) => T): T {
  const cached = apiInstances.get(key);
  if (cached) return cached as T;
  const instance = factory(getConfiguration());
  apiInstances.set(key, instance);
  return instance;
}

export const fic = {
  clients: () => getApi("clients", (c) => new ClientsApi(c)),
  suppliers: () => getApi("suppliers", (c) => new SuppliersApi(c)),
  products: () => getApi("products", (c) => new ProductsApi(c)),
  issuedDocuments: () => getApi("issuedDocuments", (c) => new IssuedDocumentsApi(c)),
  receipts: () => getApi("receipts", (c) => new ReceiptsApi(c)),
  companies: () => getApi("companies", (c) => new CompaniesApi(c)),
  info: () => getApi("info", (c) => new InfoApi(c)),
};
