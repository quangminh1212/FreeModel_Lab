import { spawnSync } from "node:child_process";
import { copyFile, chmod, mkdir, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";

const HOST_NAME = "com.freemodel.lab.bridge";
const EXTENSION_ID = "jamdobbdcddmkpgfpajpbnmfgobfjgca";
const EXTENSION_ORIGIN = `chrome-extension://${EXTENSION_ID}/`;
const FUSE = "NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2";
const cjsRequire = createRequire(__filename);

function configRoot(): string {
  if (process.platform === "win32") return join(process.env.APPDATA || process.env.LOCALAPPDATA || homedir(), "FreeModel Lab");
  if (process.platform === "darwin") return join(homedir(), "Library", "Application Support", "FreeModel Lab");
  return join(process.env.XDG_CONFIG_HOME || join(homedir(), ".config"), "freemodel-lab");
}

function runHidden(command: string, args: string[], message: string, timeout = 120_000): void {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    timeout,
    windowsHide: true,
    stdio: "ignore"
  });
  if (result.error || result.status !== 0) throw new Error(message);
}

function nativeHostSource(): string {
  return resolve(__dirname, "native-host.js");
}

async function buildWindowsHost(target: string, folder: string): Promise<void> {
  const configPath = join(folder, "freemodel-sea-config.json");
  const blobPath = join(folder, "freemodel-native.sea.blob");
  const config = { main: nativeHostSource(), output: blobPath, useSnapshot: false, useCodeCache: false };
  await writeFile(configPath, JSON.stringify(config), { mode: 0o600 });
  try {
    runHidden(process.execPath, [`--experimental-sea-config=${configPath}`], "Could not prepare the Native Messaging executable. Use Node.js LTS 24 or newer.");
    await copyFile(process.execPath, target);
    const packageJsonPath = cjsRequire.resolve("postject/package.json");
    const postjectCli = join(dirname(packageJsonPath), "dist", "cli.js");
    runHidden(process.execPath, [postjectCli, target, "NODE_SEA_BLOB", blobPath, "--sentinel-fuse", FUSE, "--overwrite"], "Could not build the Windows Native Messaging executable.");
  } finally {
    await rm(configPath, { force: true });
    await rm(blobPath, { force: true });
  }
}

function manifestFolders(): string[] {
  if (process.platform === "darwin") {
    return [join(homedir(), "Library", "Application Support", "Google", "Chrome", "NativeMessagingHosts")];
  }
  const config = process.env.XDG_CONFIG_HOME || join(homedir(), ".config");
  return [join(config, "google-chrome", "NativeMessagingHosts"), join(config, "chromium", "NativeMessagingHosts")];
}

async function registerWindows(manifestPath: string): Promise<void> {
  runHidden("reg.exe", [
    "add", "HKCU\\Software\\Google\\Chrome\\NativeMessagingHosts\\" + HOST_NAME,
    "/ve", "/t", "REG_SZ", "/d", manifestPath, "/f"
  ], "Could not register the Native Messaging host for this Windows user.");
}

export async function installChromeHost(): Promise<{ extensionPath: string; manifestPath: string }> {
  if (!new Set(["win32", "darwin", "linux"]).has(process.platform)) throw new Error("Chrome Native Messaging is supported on Windows, macOS, and Linux.");
  const folder = configRoot();
  await mkdir(folder, { recursive: true, mode: 0o700 });
  await chmod(folder, 0o700).catch(() => undefined);
  const hostScriptPath = join(folder, "freemodel-native-host.js");
  const executablePath = join(folder, process.platform === "win32" ? "freemodel-native-host.exe" : "freemodel-native-host");
  if (process.platform === "win32") {
    await buildWindowsHost(executablePath, folder);
  } else {
    await copyFile(nativeHostSource(), hostScriptPath);
    const quoteSh = (value: string) => `'${value.replaceAll("'", "'\\''")}'`;
    const wrapper = `#!/bin/sh\nexec ${quoteSh(process.execPath)} ${quoteSh(hostScriptPath)} "$@"\n`;
    await writeFile(executablePath, wrapper, { mode: 0o700 });
    await chmod(executablePath, 0o700);
  }
  const manifest = {
    name: HOST_NAME,
    description: "FreeModel Lab local credential handoff",
    path: executablePath,
    type: "stdio",
    allowed_origins: [EXTENSION_ORIGIN]
  };
  const manifests = process.platform === "win32"
    ? [join(folder, `${HOST_NAME}.json`)]
    : manifestFolders().map((directory) => join(directory, `${HOST_NAME}.json`));
  for (const manifestPath of manifests) {
    await mkdir(dirname(manifestPath), { recursive: true, mode: 0o700 });
    await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + "\n", { mode: 0o600 });
  }
  if (process.platform === "win32") await registerWindows(manifests[0]!);
  const extensionPath = resolve(__dirname, "..", "extension");
  try {
    const openModule = await import("open");
    await openModule.default("chrome://extensions/", { app: { name: "chrome" } });
  } catch { /* Print the address for manual opening. */ }
  return { extensionPath, manifestPath: manifests[0]! };
}

export async function removeChromeHost(): Promise<void> {
  const folder = configRoot();
  if (process.platform === "win32") {
    const result = spawnSync("reg.exe", ["delete", "HKCU\\Software\\Google\\Chrome\\NativeMessagingHosts\\" + HOST_NAME, "/f"], {
      encoding: "utf8", windowsHide: true, stdio: "ignore"
    });
    if (result.error) throw new Error("Could not remove the Native Messaging registry entry.");
    await rm(join(folder, `${HOST_NAME}.json`), { force: true });
    await rm(join(folder, "freemodel-native-host.exe"), { force: true });
    return;
  }
  for (const directory of manifestFolders()) await rm(join(directory, `${HOST_NAME}.json`), { force: true });
  await rm(join(folder, "freemodel-native-host"), { force: true });
  await rm(join(folder, "freemodel-native-host.js"), { force: true });
}

