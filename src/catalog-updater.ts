import type { ProviderRecord } from "./registry";

export const UPSTREAM_CATALOG_URL = "https://raw.githubusercontent.com/mnfst/awesome-free-llm-apis/main/data.json";

export type CatalogUpdate = {
  sourceUpdatedAt: string;
  fetchedAt: string;
  candidates: ProviderRecord[];
};

type RawModel = {
  id?: unknown;
  name?: unknown;
  rateLimit?: unknown;
};

type RawProvider = {
  name?: unknown;
  category?: unknown;
  url?: unknown;
  baseUrl?: unknown;
  description?: unknown;
  models?: unknown;
};

function cleanText(value: unknown, limit: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const text = value.trim();
  return text.length > 0 && text.length <= limit ? text : undefined;
}

function safeHttpsUrl(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 2_048) return false;
  try {
    const parsed = new URL(value.replace(/\{[a-zA-Z0-9_]+\}/g, "placeholder"));
    return parsed.protocol === "https:" && !parsed.username && !parsed.password;
  } catch {
    return false;
  }
}

function providerId(name: string): string {
  const slug = name.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48);
  return `upstream-${slug || "provider"}`;
}

function modelLabels(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 24).flatMap((raw) => {
    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return [];
    const model = raw as RawModel;
    const name = cleanText(model.name, 180) ?? cleanText(model.id, 180);
    if (!name) return [];
    const rateLimit = cleanText(model.rateLimit, 180);
    return [rateLimit ? `${name} · ${rateLimit}` : name];
  });
}

function isFreeCandidate(description: string): boolean {
  const text = description.toLowerCase();
  if (!/(\bfree\b|no charge|no-cost|\$0)/i.test(text)) return false;
  if (/free\s+["']?trial["']?\s+(?:api\s+)?key|trial[- ]only|one[- ]time\s+(?:free\s+)?credits?|promotional\s+credits?/i.test(text)) return false;
  return true;
}

function toCandidate(raw: RawProvider, sourceUpdatedAt: string): ProviderRecord | undefined {
  const name = cleanText(raw.name, 120);
  const endpoint = cleanText(raw.baseUrl, 2_048);
  const keyUrl = cleanText(raw.url, 2_048);
  const description = cleanText(raw.description, 1_000);
  if (!name || !endpoint || !keyUrl || !description || !safeHttpsUrl(endpoint) || !safeHttpsUrl(keyUrl)) return undefined;
  if (!isFreeCandidate(description)) return undefined;

  const models = modelLabels(raw.models);
  const category = typeof raw.category === "string" && /router/i.test(raw.category) ? "router" : "hosted-inference";
  return {
    id: providerId(name),
    name,
    category,
    endpoint,
    keyUrl,
    quotaUrl: keyUrl,
    quota: {
      summary: description,
      scope: "Mô tả từ danh sách tổng hợp upstream; hãy đối chiếu trang chính thức của provider.",
      reset: "Danh sách upstream không đảm bảo quota tài khoản hiện tại.",
      models,
      notes: ["Nguồn này là ứng viên khám phá, chưa được FreeModel Lab xác minh độc lập."]
    },
    sourceUrl: UPSTREAM_CATALOG_URL,
    verifiedAt: sourceUpdatedAt,
    catalogSource: "upstream"
  };
}

export async function refreshFreeCatalog(existing: ProviderRecord[] = []): Promise<CatalogUpdate> {
  const response = await fetch(UPSTREAM_CATALOG_URL, {
    headers: { "Accept": "application/json", "User-Agent": "FreeModel-Lab/0.3" },
    redirect: "error",
    signal: AbortSignal.timeout(15_000)
  });
  if (!response.ok) throw new Error(`Upstream catalog returned HTTP ${response.status}.`);
  const contentLength = Number(response.headers.get("content-length") ?? 0);
  if (contentLength > 5 * 1024 * 1024) throw new Error("Upstream catalog is larger than the 5 MiB limit.");
  const text = await response.text();
  if (Buffer.byteLength(text, "utf8") > 5 * 1024 * 1024) throw new Error("Upstream catalog is larger than the 5 MiB limit.");

  let parsed: unknown;
  try { parsed = JSON.parse(text); } catch { throw new Error("Upstream catalog returned invalid JSON."); }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) throw new Error("Upstream catalog has an invalid format.");
  const root = parsed as Record<string, unknown>;
  if (!Array.isArray(root.providers)) throw new Error("Upstream catalog does not contain a provider list.");
  const sourceUpdatedAt = typeof root.lastUpdated === "string" && /^\d{4}-\d{2}-\d{2}$/.test(root.lastUpdated)
    ? root.lastUpdated
    : "unknown";
  const knownIds = new Set(existing.map((provider) => provider.id));
  const knownEndpoints = new Set(existing.map((provider) => provider.endpoint.replace(/\/$/, "").toLowerCase()));
  const candidates: ProviderRecord[] = [];
  for (const raw of root.providers.slice(0, 500)) {
    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) continue;
    const candidate = toCandidate(raw as RawProvider, sourceUpdatedAt);
    if (!candidate) continue;
    const normalizedEndpoint = candidate.endpoint.replace(/\/$/, "").toLowerCase();
    if (knownIds.has(candidate.id) || knownEndpoints.has(normalizedEndpoint)) continue;
    knownIds.add(candidate.id);
    knownEndpoints.add(normalizedEndpoint);
    candidates.push(candidate);
    if (candidates.length >= 100) break;
  }

  return { sourceUpdatedAt, fetchedAt: new Date().toISOString(), candidates };
}
