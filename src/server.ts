import { randomBytes } from "node:crypto";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { listProviders, getProvider, resolveEndpoint } from "./registry";
import { hasSecret, saveSecret } from "./secrets";
import { provision, type ProvisionInput } from "./provisioners";

const MAX_BODY_BYTES = 48 * 1024;
const WEB_ROOT = resolve(__dirname, "..", "web");

type StartOptions = { port?: number; openChrome?: boolean };

function writeJson(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff"
  });
  response.end(JSON.stringify(body));
}

async function readJson(request: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const part of request) {
    const chunk = Buffer.isBuffer(part) ? part : Buffer.from(part);
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw new Error("Request body exceeds the 48 KiB limit.");
    chunks.push(chunk);
  }
  let value: unknown;
  try {
    value = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new Error("Request body must be valid JSON.");
  }
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error("Request body must be a JSON object.");
  return value as Record<string, unknown>;
}

function cookieValue(header: string | undefined, key: string): string | undefined {
  for (const item of (header ?? "").split(";")) {
    const [name, ...rest] = item.trim().split("=");
    if (name === key) return decodeURIComponent(rest.join("="));
  }
  return undefined;
}

function validId(value: string): boolean {
  return /^[a-z0-9-]{1,64}$/.test(value);
}

function securityHeaders(): Record<string, string> {
  return {
    "Cache-Control": "no-store",
    "Content-Security-Policy": "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    "X-Frame-Options": "DENY"
  };
}

function sendHtml(response: ServerResponse, status: number, body: string): void {
  response.writeHead(status, { ...securityHeaders(), "Content-Type": "text/html; charset=utf-8" });
  response.end(body);
}

function setSessionCookie(response: ServerResponse, token: string): void {
  response.writeHead(302, {
    ...securityHeaders(),
    Location: "/",
    "Set-Cookie": `fml_session=${encodeURIComponent(token)}; HttpOnly; SameSite=Strict; Path=/`
  });
  response.end();
}

async function sendStatic(response: ServerResponse, path: string): Promise<void> {
  const files: Record<string, { name: string; type: string }> = {
    "/": { name: "index.html", type: "text/html; charset=utf-8" },
    "/theme.js": { name: "theme.js", type: "text/javascript; charset=utf-8" },
    "/app.js": { name: "app.js", type: "text/javascript; charset=utf-8" },
    "/style.css": { name: "style.css", type: "text/css; charset=utf-8" }
  };
  const file = files[path];
  if (!file) throw new Error("Not found.");
  const body = await readFile(resolve(WEB_ROOT, file.name));
  response.writeHead(200, { ...securityHeaders(), "Content-Type": file.type });
  response.end(body);
}

function isLoopback(request: IncomingMessage): boolean {
  return request.socket.remoteAddress === "127.0.0.1"
    || request.socket.remoteAddress === "::ffff:127.0.0.1"
    || request.socket.remoteAddress === "::1";
}

function sanitizeProvisionInput(body: Record<string, unknown>): ProvisionInput {
  const stringFields = ["name", "project", "serviceAccountEmail", "accountId", "bootstrapToken", "managementKey", "expiresOn"] as const;
  const result: ProvisionInput = {};
  for (const field of stringFields) {
    const value = body[field];
    if (value !== undefined) {
      if (typeof value !== "string" || value.length > 16_384) throw new Error(`Invalid ${field} value.`);
      result[field] = value;
    }
  }
  if (body.monthlyLimitUsd !== undefined) {
    if (typeof body.monthlyLimitUsd !== "number" || !Number.isFinite(body.monthlyLimitUsd)) throw new Error("Invalid monthly spend cap.");
    result.monthlyLimitUsd = body.monthlyLimitUsd;
  }
  result.overwrite = body.overwrite === true;
  return result;
}

export async function startServer(options: StartOptions = {}): Promise<{ url: string; close: () => Promise<void> }> {
  const sessionToken = randomBytes(32).toString("base64url");
  const server = createServer(async (request, response) => {
    const host = request.headers.host;
    const requestUrl = new URL(request.url ?? "/", `http://${host ?? "invalid"}`);
    const address = server.address();
    const port = typeof address === "object" && address ? address.port : undefined;
    const expectedHost = `127.0.0.1:${port}`;
    const expectedOrigin = `http://${expectedHost}`;

    if (!port || host !== expectedHost || !isLoopback(request)) {
      writeJson(response, 421, { error: "This local service accepts loopback requests only." });
      return;
    }

    if (request.method === "GET" && requestUrl.pathname === "/" && requestUrl.searchParams.get("session") === sessionToken) {
      setSessionCookie(response, sessionToken);
      return;
    }

    const cookieToken = cookieValue(request.headers.cookie, "fml_session");
    const nativeToken = request.headers["x-freemodel-session"];
    const isNative = request.method === "POST" && requestUrl.pathname === "/api/native/keys";
    const authorized = isNative
      ? nativeToken === sessionToken
      : cookieToken === sessionToken;
    if (!authorized) {
      writeJson(response, 401, { error: "Dashboard session expired. Restart the command and open its new local link." });
      return;
    }
    const isApiRequest = requestUrl.pathname.startsWith("/api/");
    const origin = request.headers.origin;
    const isMutation = request.method !== "GET";
    if (!isNative && isApiRequest && ((origin !== undefined && origin !== expectedOrigin) || (isMutation && origin !== expectedOrigin))) {
      writeJson(response, 403, { error: "Request origin is not allowed." });
      return;
    }
    if (!isNative && isApiRequest && request.headers["sec-fetch-site"] && request.headers["sec-fetch-site"] !== "same-origin") {
      writeJson(response, 403, { error: "Cross-site requests are not allowed." });
      return;
    }

    if (request.method === "GET" && requestUrl.pathname === "/") {
      try { await sendStatic(response, "/"); } catch { writeJson(response, 500, { error: "Dashboard assets are unavailable. Reinstall the npm package." }); }
      return;
    }
    if (request.method === "GET" && ["/theme.js", "/app.js", "/style.css"].includes(requestUrl.pathname)) {
      try { await sendStatic(response, requestUrl.pathname); } catch { writeJson(response, 404, { error: "Dashboard asset not found." }); }
      return;
    }
    if (request.method === "GET" && requestUrl.pathname === "/api/session") {
      writeJson(response, 200, { sessionToken, port });
      return;
    }
    if (request.method === "GET" && requestUrl.pathname === "/api/providers") {
      const providers = listProviders().map((provider) => {
        let keySaved: boolean | null = false;
        try { keySaved = hasSecret(provider.id); } catch { keySaved = null; }
        return {
          ...provider,
          endpoint: resolveEndpoint(provider),
          keySaved
        };
      });
      writeJson(response, 200, { providers });
      return;
    }
    if (request.method === "POST" && isNative) {
      try {
        const body = await readJson(request);
        const providerId = body.providerId;
        if (typeof providerId !== "string" || !validId(providerId) || typeof body.secret !== "string") throw new Error("Invalid key-save message.");
        saveSecret(providerId, body.secret, body.overwrite === true);
        writeJson(response, 200, { ok: true, message: "Key saved in the OS credential store." });
      } catch (error) {
        writeJson(response, 400, { error: error instanceof Error ? error.message : "Could not save key." });
      }
      return;
    }
    const keyMatch = request.method === "POST" && requestUrl.pathname.match(/^\/api\/keys\/([^/]+)$/);
    if (keyMatch) {
      const providerId = decodeURIComponent(keyMatch[1] ?? "");
      if (!getProvider(providerId)) { writeJson(response, 404, { error: "Unknown provider." }); return; }
      try {
        const body = await readJson(request);
        if (typeof body.secret !== "string") throw new Error("Enter an API key first.");
        saveSecret(providerId, body.secret, body.overwrite === true);
        writeJson(response, 200, { ok: true, message: "Key saved in the OS credential store." });
      } catch (error) {
        writeJson(response, 400, { error: error instanceof Error ? error.message : "Could not save key." });
      }
      return;
    }
    const provisionMatch = request.method === "POST" && requestUrl.pathname.match(/^\/api\/provision\/([^/]+)$/);
    if (provisionMatch) {
      const providerId = decodeURIComponent(provisionMatch[1] ?? "");
      try {
        if (!getProvider(providerId)) throw new Error("Unknown provider.");
        const body = await readJson(request);
        const result = await provision(providerId, sanitizeProvisionInput(body));
        writeJson(response, 200, { ok: true, message: result.message, endpoint: result.endpoint });
      } catch (error) {
        writeJson(response, 400, { error: error instanceof Error ? error.message : "Key provisioning failed." });
      }
      return;
    }
    writeJson(response, 404, { error: "Not found." });
  });

  await new Promise<void>((resolveListen, reject) => {
    server.once("error", reject);
    server.listen(options.port ?? 0, "127.0.0.1", () => {
      server.removeListener("error", reject);
      resolveListen();
    });
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Could not bind the local dashboard.");
  const url = `http://127.0.0.1:${address.port}/?session=${encodeURIComponent(sessionToken)}`;
  if (options.openChrome) {
    try {
      const openModule = await import("open");
      await openModule.default(url, { app: { name: "chrome" } });
    }
    catch { process.stdout.write("Chrome could not be opened automatically. Copy the local URL into your signed-in Chrome profile.\n"); }
  }
  return {
    url,
    close: () => new Promise<void>((resolveClose, rejectClose) => server.close((error) => error ? rejectClose(error) : resolveClose()))
  };
}

