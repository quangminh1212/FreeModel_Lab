import { Entry } from "@napi-rs/keyring";
import { getProvider } from "./registry";

const SERVICE_NAME = "FreeModel_Lab";
const LINUX_OPTIONS = { linux: { store: "secret-service" as const } };

function entryFor(providerId: string): Entry {
  if (!getProvider(providerId)) throw new Error("Unknown provider.");
  try {
    return new Entry(SERVICE_NAME, providerId, LINUX_OPTIONS);
  } catch {
    throw new Error(
      process.platform === "linux"
        ? "Could not access Linux Secret Service. Start GNOME Keyring, KWallet, or another Secret Service provider, then retry."
        : "Could not access the operating system credential store."
    );
  }
}

export function getSecret(providerId: string): string | undefined {
  const entry = entryFor(providerId);
  try {
    const value = entry.getPassword();
    return typeof value === "string" && value.length > 0 ? value : undefined;
  } catch (error) {
    const message = error instanceof Error ? error.message.toLowerCase() : "";
    if (message.includes("not found") || message.includes("no entry")) return undefined;
    throw new Error(
      process.platform === "linux"
        ? "Could not read from Linux Secret Service. No key was changed."
        : "Could not read from the operating system credential store. No key was changed."
    );
  }
}

export function hasSecret(providerId: string): boolean {
  return getSecret(providerId) !== undefined;
}

export function saveSecret(providerId: string, value: string, overwrite = false): void {
  if (typeof value !== "string" || value.trim().length === 0 || value.length > 16_384) {
    throw new Error("The API key is blank or exceeds the 16 KiB limit.");
  }
  const entry = entryFor(providerId);
  if (!overwrite && hasSecret(providerId)) {
    throw new Error("A key is already saved for this provider. Choose replace explicitly if you intend to overwrite it.");
  }
  try {
    entry.setPassword(value.trim());
  } catch {
    throw new Error(
      process.platform === "linux"
        ? "Could not save the key to Linux Secret Service. The key was not written to a file."
        : "Could not save the key to the operating system credential store."
    );
  }
}

