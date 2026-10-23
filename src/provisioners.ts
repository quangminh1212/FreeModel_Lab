import { spawnSync } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { getProvider, resolveEndpoint } from "./registry";
import { hasSecret, saveSecret } from "./secrets";

export type ProvisionInput = {
  name?: string;
  overwrite?: boolean;
  project?: string;
  serviceAccountEmail?: string;
  accountId?: string;
  bootstrapToken?: string;
  managementKey?: string;
  monthlyLimitUsd?: number;
  expiresOn?: string;
};

export type ProvisionResult = {
  providerId: string;
  endpoint: string;
  message: string;
};

const MAX_RESPONSE_BYTES = 1024 * 1024;
const REQUEST_TIMEOUT_MS = 30_000;

class ProviderRequestError extends Error {}

function uncertainCreate(provider: string): ProviderRequestError {
  return new ProviderRequestError(
    `${provider} did not return a usable response to the create request. The outcome is uncertain; check the provider's key page before retrying.`
  );
}

async function readResponseBody(response: Response, provider: string, method: string): Promise<string> {
  const contentLength = Number(response.headers.get("content-length") ?? 0);
  if (contentLength > MAX_RESPONSE_BYTES) {
    if (method !== "GET") throw uncertainCreate(provider);
    throw new ProviderRequestError(`${provider} response exceeded the safety limit.`);
  }
  const reader = response.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_RESPONSE_BYTES) {
        void reader.cancel().catch(() => undefined);
        if (method !== "GET") throw uncertainCreate(provider);
        throw new ProviderRequestError(`${provider} response exceeded the safety limit.`);
      }
      chunks.push(value);
    }
  } catch (error) {
    if (error instanceof ProviderRequestError) throw error;
    if (method !== "GET") throw uncertainCreate(provider);
    throw new ProviderRequestError(`Could not read the ${provider} response.`);
  } finally {
    reader.releaseLock();
  }
  return new TextDecoder().decode(Buffer.concat(chunks.map((chunk) => Buffer.from(chunk))));
}

function validateName(name: string | undefined, fallback: string, max: number): string {
  const value = name?.trim() || fallback;
  if (value.length < 1 || value.length > max || /[\u0000-\u001f\u007f]/.test(value)) {
    throw new Error(`Key name must contain 1 to ${max} printable characters.`);
  }
  return value;
}

function assertNoExistingKey(providerId: string, overwrite: boolean | undefined): void {
  if (hasSecret(providerId) && !overwrite) {
    throw new Error("A key is already saved for this provider. Replace was not selected, so no new key was created.");
  }
}

function objectResult(value: unknown, provider: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new ProviderRequestError(`${provider} returned an unexpected response.`);
  }
  return value as Record<string, unknown>;
}

async function requestJson(
  url: string,
  provider: string,
  options: { method?: string; token?: string; payload?: Record<string, unknown> } = {}
): Promise<Record<string, unknown>> {
  const parsed = new URL(url);
  if (parsed.protocol !== "https:") throw new ProviderRequestError("Refusing a non-HTTPS provider request.");
  const headers: Record<string, string> = { Accept: "application/json" };
  if (options.token) headers.Authorization = `Bearer ${options.token}`;
  let body: string | undefined;
  if (options.payload) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(options.payload);
  }
  const method = options.method ?? "GET";
  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers,
      body,
      redirect: "error",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
    });
  } catch {
    if (method !== "GET") {
      throw new ProviderRequestError(`${provider} did not return a response to the create request. The outcome is uncertain; check the provider's key page before retrying.`);
    }
    throw new ProviderRequestError(`Could not reach ${provider}. No automatic retry was made.`);
  }
  const raw = await readResponseBody(response, provider, method);
  if (!response.ok) {
    if (method !== "GET" && response.status >= 500) {
      throw new ProviderRequestError(`${provider} returned HTTP ${response.status} to the create request. The outcome is uncertain; check the provider's key page before retrying.`);
    }
    throw new ProviderRequestError(`${provider} returned HTTP ${response.status}. Check account access and permissions; no automatic retry was made.`);
  }
  try {
    return objectResult(JSON.parse(raw), provider);
  } catch (error) {
    if (method !== "GET" && response.ok) throw uncertainCreate(provider);
    if (error instanceof ProviderRequestError) throw error;
    throw new ProviderRequestError(`${provider} returned invalid JSON.`);
  }
}

function gcloudAccessToken(): string {
  const result = spawnSync("gcloud", ["auth", "print-access-token"], {
    encoding: "utf8",
    timeout: REQUEST_TIMEOUT_MS,
    windowsHide: true,
    stdio: ["ignore", "pipe", "ignore"]
  });
  const token = result.stdout?.trim();
  if (result.error || result.status !== 0 || !token) {
    throw new Error("No gcloud access token is available. Install Google Cloud CLI and run `gcloud auth login` first.");
  }
  return token;
}

async function provisionGemini(input: ProvisionInput): Promise<string> {
  const project = input.project?.trim() ?? "";
  if (!/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(project)) throw new Error("Google Gemini provisioning needs a valid project ID.");
  const serviceAccountEmail = input.serviceAccountEmail?.trim() ?? "";
  if (!/^[^\s@]+@[^\s@]+\.iam\.gserviceaccount\.com$/.test(serviceAccountEmail)) {
    throw new Error("Google Gemini provisioning needs an existing service account email.");
  }
  const token = gcloudAccessToken();
  const parent = `projects/${encodeURIComponent(project)}/locations/global`;
  const created = await requestJson(`https://apikeys.googleapis.com/v2/${parent}/keys`, "Google API Keys", {
    method: "POST",
    token,
    payload: {
      displayName: validateName(input.name, "FreeModel Lab Gemini key", 63),
      serviceAccountEmail,
      restrictions: { apiTargets: [{ service: "generativelanguage.googleapis.com" }] }
    }
  });
  const operationName = created.name;
  if (typeof operationName !== "string" || !operationName.startsWith("operations/")) {
    throw new Error("Google accepted the request but returned no operation ID. Check the project API Keys page before retrying.");
  }
  const operationUrl = `https://apikeys.googleapis.com/v2/${encodeURIComponent(operationName).replaceAll("%2F", "/")}`;
  let completed: Record<string, unknown> | undefined;
  for (let attempt = 0; attempt < 60; attempt += 1) {
    completed = await requestJson(operationUrl, "Google API Keys", { token });
    if (completed.done === true) break;
    await delay(1000);
  }
  if (completed?.done !== true) throw new Error("Google key creation is still running. Check Google Cloud before retrying to avoid creating a duplicate.");
  if (completed.error) throw new Error("Google could not create the key. Check the enabled APIs and IAM permissions.");
  const response = objectResult(completed.response, "Google API Keys");
  const resourceName = response.name;
  if (typeof resourceName !== "string" || !resourceName.startsWith("projects/")) {
    throw new Error("Google completed the operation without a key resource name. Check the project before retrying.");
  }
  const keyResult = await requestJson(
    `https://apikeys.googleapis.com/v2/${resourceName.split("/").map(encodeURIComponent).join("/")}/keyString`,
    "Google API Keys",
    { token }
  );
  if (typeof keyResult.keyString !== "string") throw new Error("Google did not return a usable key. Check Google Cloud before retrying.");
  return keyResult.keyString;
}

async function cloudflarePermissionGroup(accountId: string, token: string, name: string): Promise<Record<string, unknown>> {
  const url = new URL(`https://api.cloudflare.com/client/v4/accounts/${accountId}/tokens/permission_groups`);
  url.searchParams.set("name", name);
  const result = await requestJson(url.toString(), "Cloudflare", { token });
  if (result.success !== true || !Array.isArray(result.result)) throw new Error("Cloudflare did not return the requested permission groups.");
  const matches = result.result.filter((entry): entry is Record<string, unknown> => {
    if (typeof entry !== "object" || entry === null) return false;
    const group = entry as Record<string, unknown>;
    const normalize = (value: unknown) => String(value ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
    return normalize(group.name) === normalize(name)
      && group.is_selectable === true
      && Array.isArray(group.scopes)
      && group.scopes.includes("com.cloudflare.api.account");
  });
  if (matches.length !== 1 || typeof matches[0]?.id !== "string") {
    throw new Error(`Cloudflare did not expose one selectable ${name} permission group.`);
  }
  return matches[0];
}

async function provisionCloudflare(input: ProvisionInput): Promise<{ key: string; endpoint: string }> {
  const accountId = input.accountId?.trim() ?? "";
  if (!/^[a-fA-F0-9]{32}$/.test(accountId)) throw new Error("Cloudflare provisioning needs a 32-character account ID.");
  const token = input.bootstrapToken?.trim() ?? "";
  if (!token) throw new Error("Enter a Cloudflare bootstrap token with Account API Tokens Write permission.");
  const read = await cloudflarePermissionGroup(accountId, token, "Workers AI - Read");
  const edit = await cloudflarePermissionGroup(accountId, token, "Workers AI - Edit");
  const payload: Record<string, unknown> = {
    name: validateName(input.name, "FreeModel Lab Workers AI", 120),
    policies: [{
      effect: "allow",
      resources: { [`com.cloudflare.api.account.${accountId}`]: "*" },
      permission_groups: [{ id: read.id }, { id: edit.id }]
    }]
  };
  if (input.expiresOn) {
    const expiration = new Date(input.expiresOn);
    if (!Number.isFinite(expiration.getTime()) || expiration.getTime() <= Date.now()) {
      throw new Error("Expiration must be a future ISO-8601 timestamp.");
    }
    payload.expires_on = expiration.toISOString();
  }
  const result = await requestJson(`https://api.cloudflare.com/client/v4/accounts/${accountId}/tokens`, "Cloudflare", {
    method: "POST",
    token,
    payload
  });
  if (result.success !== true || typeof result.result !== "object" || result.result === null) {
    throw new Error("Cloudflare did not return a token. Check the account's token page before retrying.");
  }
  const tokenResult = result.result as Record<string, unknown>;
  if (typeof tokenResult.value !== "string") throw new Error("Cloudflare created a token but did not return its value. Check the account before retrying.");
  return {
    key: tokenResult.value,
    endpoint: resolveEndpoint(getProvider("cloudflare-workers-ai")!, accountId)
  };
}

async function provisionOpenRouter(input: ProvisionInput): Promise<string> {
  const managementKey = input.managementKey?.trim() ?? "";
  if (!managementKey) throw new Error("Enter an OpenRouter management key created in your account.");
  const limit = input.monthlyLimitUsd;
  if (typeof limit !== "number" || !Number.isFinite(limit) || limit <= 0) {
    throw new Error("OpenRouter key creation requires an explicit positive monthly spend cap. This permits charges up to that cap if a paid model is selected.");
  }
  const result = await requestJson("https://openrouter.ai/api/v1/keys", "OpenRouter", {
    method: "POST",
    token: managementKey,
    payload: {
      name: validateName(input.name, "FreeModel Lab key", 120),
      limit,
      limit_reset: "monthly"
    }
  });
  if (typeof result.key !== "string") throw new Error("OpenRouter accepted the request but returned no key value. Check the keys page before retrying.");
  return result.key;
}

export async function provision(providerId: string, input: ProvisionInput): Promise<ProvisionResult> {
  const provider = getProvider(providerId);
  if (!provider?.provisioner) throw new Error("This provider has no verified API key provisioning adapter. Use its official key page.");
  assertNoExistingKey(providerId, input.overwrite === true);

  let key: string;
  let endpoint = resolveEndpoint(provider, input.accountId);
  if (provider.provisioner === "cloudflare") {
    const result = await provisionCloudflare(input);
    key = result.key;
    endpoint = result.endpoint;
  } else if (provider.provisioner === "gemini") {
    key = await provisionGemini(input);
  } else {
    key = await provisionOpenRouter(input);
  }
  try {
    saveSecret(providerId, key, input.overwrite === true);
  } catch {
    throw new Error(`${provider.name} created a key, but the OS credential store could not save it. Revoke the new key in the provider dashboard before retrying. The key was not displayed.`);
  }
  return {
    providerId,
    endpoint,
    message: `${provider.name} key was created and saved to the OS credential store. The key value is hidden.`
  };
}

