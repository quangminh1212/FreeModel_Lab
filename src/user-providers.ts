import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync, chmodSync, rmSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import type { ProviderRecord } from "./registry";

function dataDirectory(): string {
  if (process.platform === "win32") {
    return join(process.env.APPDATA || join(homedir(), "AppData", "Roaming"), "FreeModel Lab");
  }
  if (process.platform === "darwin") return join(homedir(), "Library", "Application Support", "FreeModel Lab");
  return join(process.env.XDG_DATA_HOME || join(homedir(), ".local", "share"), "freemodel-lab");
}

function catalogPath(): string {
  return join(dataDirectory(), "providers.json");
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

function validateProvider(value: unknown): ProviderRecord | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return undefined;
  const record = value as Record<string, unknown>;
  const quotaValue = record.quota;
  if (typeof quotaValue !== "object" || quotaValue === null || Array.isArray(quotaValue)) return undefined;
  const quota = quotaValue as Record<string, unknown>;
  if (typeof record.id !== "string" || !/^[a-z0-9-]{1,64}$/.test(record.id)) return undefined;
  if (typeof record.name !== "string" || record.name.length < 1 || record.name.length > 120) return undefined;
  if (record.category !== "hosted-inference" && record.category !== "router") return undefined;
  if (!safeHttpsUrl(record.endpoint) || !safeHttpsUrl(record.keyUrl) || !safeHttpsUrl(record.quotaUrl) || !safeHttpsUrl(record.sourceUrl)) return undefined;
  if (typeof quota.summary !== "string" || quota.summary.length > 1_000) return undefined;
  if (typeof quota.scope !== "string" || typeof quota.reset !== "string") return undefined;
  const models = Array.isArray(quota.models) && quota.models.every((item) => typeof item === "string")
    ? quota.models.slice(0, 24)
    : undefined;
  const notes = Array.isArray(quota.notes) && quota.notes.every((item) => typeof item === "string")
    ? quota.notes.slice(0, 8)
    : undefined;
  if (typeof record.verifiedAt !== "string" || (record.verifiedAt !== "unknown" && !/^\d{4}-\d{2}-\d{2}$/.test(record.verifiedAt))) return undefined;
  if (record.catalogSource !== "upstream" || typeof record.addedAt !== "string") return undefined;
  return {
    id: record.id,
    name: record.name,
    category: record.category,
    endpoint: record.endpoint,
    keyUrl: record.keyUrl,
    quotaUrl: record.quotaUrl,
    quota: {
      summary: quota.summary,
      scope: quota.scope,
      reset: quota.reset,
      models,
      notes
    },
    sourceUrl: record.sourceUrl,
    verifiedAt: record.verifiedAt,
    catalogSource: "upstream",
    addedAt: record.addedAt
  };
}

export function listUserProviders(): ProviderRecord[] {
  const path = catalogPath();
  if (!existsSync(path)) return [];
  let value: unknown;
  try {
    value = JSON.parse(readFileSync(path, "utf8"));
  } catch {
    throw new Error("The saved provider catalog could not be read. No data was changed.");
  }
  if (!Array.isArray(value)) throw new Error("The saved provider catalog has an invalid format. No data was changed.");
  const providers = value.map(validateProvider);
  if (providers.some((provider) => provider === undefined)) {
    throw new Error("The saved provider catalog contains an invalid entry. No data was changed.");
  }
  return providers as ProviderRecord[];
}

export function addUserProvider(provider: ProviderRecord): ProviderRecord {
  const candidate: ProviderRecord = {
    ...provider,
    catalogSource: "upstream",
    addedAt: new Date().toISOString()
  };
  if (!validateProvider(candidate)) throw new Error("Provider metadata is incomplete or invalid.");
  const current = listUserProviders();
  if (current.some((item) => item.id === candidate.id)) throw new Error("This provider is already in your catalog.");

  const directory = dataDirectory();
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  if (process.platform !== "win32") chmodSync(directory, 0o700);
  const path = catalogPath();
  const temporaryPath = join(directory, `.providers-${randomUUID()}.tmp`);
  const serialized = `${JSON.stringify([...current, candidate], null, 2)}\n`;
  try {
    writeFileSync(temporaryPath, serialized, { encoding: "utf8", mode: 0o600, flag: "wx" });
    renameSync(temporaryPath, path);
  } catch {
    try { rmSync(temporaryPath, { force: true }); } catch { /* Best-effort cleanup of a metadata-only temporary file. */ }
    throw new Error("Could not save provider metadata in your user data folder.");
  }
  return candidate;
}
