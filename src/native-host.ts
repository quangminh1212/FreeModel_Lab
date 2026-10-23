#!/usr/bin/env node
import { Buffer } from "node:buffer";

const HOST_NAME = "com.freemodel.lab.bridge";
const EXTENSION_ORIGIN = "chrome-extension://jamdobbdcddmkpgfpajpbnmfgobfjgca/";
const MAX_MESSAGE_BYTES = 1024 * 1024;

type NativeMessage = {
  version?: unknown;
  action?: unknown;
  providerId?: unknown;
  secret?: unknown;
  sessionToken?: unknown;
  port?: unknown;
  overwrite?: unknown;
};

function writeReply(value: Record<string, unknown>): void {
  const body = Buffer.from(JSON.stringify(value), "utf8");
  const frame = Buffer.allocUnsafe(body.length + 4);
  frame.writeUInt32LE(body.length, 0);
  body.copy(frame, 4);
  process.stdout.write(frame, () => process.exit(0));
}

function validOrigin(): boolean {
  return process.argv.slice(2).some((argument) => argument === EXTENSION_ORIGIN);
}

async function handleMessage(message: NativeMessage): Promise<Record<string, unknown>> {
  if (message.version !== 1 || typeof message.action !== "string") return { ok: false, error: "Invalid Native Messaging message." };
  if (message.action === "ping") return { ok: true, host: HOST_NAME };
  if (message.action !== "save-key") return { ok: false, error: "Unsupported Native Messaging action." };
  if (typeof message.providerId !== "string" || !/^[a-z0-9-]{1,64}$/.test(message.providerId)) {
    return { ok: false, error: "Invalid provider ID." };
  }
  if (typeof message.secret !== "string" || message.secret.length < 1 || message.secret.length > 16_384) {
    return { ok: false, error: "The key is blank or exceeds 16 KiB." };
  }
  if (typeof message.sessionToken !== "string" || !/^[A-Za-z0-9_-]{40,64}$/.test(message.sessionToken)) {
    return { ok: false, error: "Dashboard session expired." };
  }
  if (!Number.isInteger(message.port) || Number(message.port) < 1 || Number(message.port) > 65_535) {
    return { ok: false, error: "Invalid dashboard port." };
  }
  if (typeof message.overwrite !== "boolean") return { ok: false, error: "Invalid replace choice." };
  let response: Response;
  try {
    response = await fetch(`http://127.0.0.1:${message.port}/api/native/keys`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-FreeModel-Session": message.sessionToken
      },
      body: JSON.stringify({ providerId: message.providerId, secret: message.secret, overwrite: message.overwrite }),
      redirect: "error",
      signal: AbortSignal.timeout(10_000)
    });
  } catch {
    return { ok: false, error: "Could not reach the local dashboard. Start a new dashboard session and retry manually." };
  }
  if (!response.ok) return { ok: false, error: "The dashboard rejected the key-save request." };
  try {
    const value: unknown = await response.json();
    if (typeof value === "object" && value !== null && "ok" in value && value.ok === true) {
      return { ok: true, message: "Key saved in the OS credential store." };
    }
  } catch { /* Return a generic failure without including response data. */ }
  return { ok: false, error: "The dashboard returned an invalid key-save response." };
}

if (!validOrigin()) {
  writeReply({ ok: false, error: "This extension origin is not allowed." });
} else {
  let buffer = Buffer.alloc(0);
  let finished = false;
  process.stdin.on("data", (chunk: Buffer) => {
    if (finished) return;
    buffer = Buffer.concat([buffer, chunk]);
    if (buffer.length > MAX_MESSAGE_BYTES + 4) {
      finished = true;
      writeReply({ ok: false, error: "Native Messaging message exceeds 1 MiB." });
      return;
    }
    if (buffer.length < 4) return;
    const length = buffer.readUInt32LE(0);
    if (length > MAX_MESSAGE_BYTES) {
      finished = true;
      writeReply({ ok: false, error: "Native Messaging message exceeds 1 MiB." });
      return;
    }
    if (buffer.length < length + 4) return;
    finished = true;
    try {
      const parsed: unknown = JSON.parse(buffer.subarray(4, length + 4).toString("utf8"));
      if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
        writeReply({ ok: false, error: "Native Messaging message must be an object." });
        return;
      }
      void handleMessage(parsed as NativeMessage).then(writeReply, () => writeReply({ ok: false, error: "Native Messaging request failed." }));
    } catch {
      writeReply({ ok: false, error: "Native Messaging message is not valid JSON." });
    }
  });
  process.stdin.on("end", () => {
    if (!finished) writeReply({ ok: false, error: "Native Messaging request was incomplete." });
  });
  process.stdin.on("error", () => writeReply({ ok: false, error: "Could not read Native Messaging input." }));
}

