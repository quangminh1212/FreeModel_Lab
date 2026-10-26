"use strict";

const { spawn } = require("node:child_process");
const { randomBytes } = require("node:crypto");
const { mkdir, writeFile } = require("node:fs/promises");
const path = require("node:path");
const chokidar = require("chokidar");

const root = path.resolve(__dirname, "..");
const sourceRoot = path.join(root, "src");
const webRoot = path.join(root, "web");
const versionDirectory = path.join(root, "node_modules", ".cache", "freemodel-lab");
const versionFile = path.join(versionDirectory, "dev-version");
const compiler = path.join(root, "node_modules", "typescript", "bin", "tsc");
const sessionToken = randomBytes(32).toString("base64url");

process.chdir(root);

let dashboard;
let dashboardPort;
let watcher;
let buildTimer;
let webTimer;
let buildRunning = false;
let buildQueued = false;
let version = 0;
let shuttingDown = false;

function log(message) {
  process.stdout.write(`[dev] ${message}\n`);
}

async function bumpVersion() {
  version += 1;
  await writeFile(versionFile, `${Date.now()}-${version}`, "utf8");
}

function compile() {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [compiler, "-p", "tsconfig.json"], {
      cwd: root,
      env: process.env,
      shell: false,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"]
    });
    child.stdout.on("data", (chunk) => process.stdout.write(chunk));
    child.stderr.on("data", (chunk) => process.stderr.write(chunk));
    child.once("error", reject);
    child.once("close", (code) => resolve(code === 0));
  });
}

function clearCompiledModules() {
  const distRoot = `${path.join(root, "dist")}${path.sep}`;
  for (const filename of Object.keys(require.cache)) {
    if (filename.startsWith(distRoot)) delete require.cache[filename];
  }
}

async function openDashboard(openChrome) {
  clearCompiledModules();
  const { startServer } = require(path.join(root, "dist", "server.js"));
  const options = { devMode: true, openChrome, sessionToken };
  if (dashboardPort !== undefined) options.port = dashboardPort;
  dashboard = await startServer(options);
  if (dashboardPort === undefined) dashboardPort = Number(new URL(dashboard.url).port);
  if (typeof process.send === "function") {
    process.send({ type: "dashboard", url: dashboard.url });
  }
  log(`Dashboard: ${new URL(dashboard.url).origin}/`);
}

async function restartDashboard() {
  if (dashboard) await dashboard.close();
  dashboard = undefined;
  await bumpVersion();
  await openDashboard(false);
}

async function rebuild() {
  if (buildRunning) {
    buildQueued = true;
    return;
  }
  buildRunning = true;
  do {
    buildQueued = false;
    log("Đang build lại TypeScript...");
    try {
      const succeeded = await compile();
      if (!succeeded) {
        log("Build lỗi; server đang chạy bản gần nhất thành công.");
        continue;
      }
      await restartDashboard();
      log("Server đã cập nhật; dashboard sẽ tự refresh khi bạn mở URL.");
    } catch (error) {
      process.stderr.write(`[dev] Build/restart failed: ${error instanceof Error ? error.message : String(error)}\n`);
    }
  } while (buildQueued && !shuttingDown);
  buildRunning = false;
}

function scheduleBuild() {
  clearTimeout(buildTimer);
  buildTimer = setTimeout(() => void rebuild(), 250);
}

function scheduleWebReload(filename) {
  clearTimeout(webTimer);
  webTimer = setTimeout(async () => {
    try {
      await bumpVersion();
      log(`${path.relative(root, filename)} changed; refreshing the dashboard.`);
    } catch (error) {
      process.stderr.write(`[dev] Could not update reload marker: ${error instanceof Error ? error.message : String(error)}\n`);
    }
  }, 200);
}

function isWithin(directory, filename) {
  const relative = path.relative(directory, filename);
  return relative !== "" && !relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative);
}

async function shutdown(exitCode = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  process.exitCode = exitCode;
  clearTimeout(buildTimer);
  clearTimeout(webTimer);
  if (watcher) await watcher.close().catch(() => {});
  if (dashboard) await dashboard.close().catch((error) => {
    process.stderr.write(`[dev] Could not close dashboard cleanly: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
  log("Dashboard stopped.");
  if (process.connected) process.disconnect();
}

process.once("SIGINT", () => void shutdown());
process.once("SIGTERM", () => void shutdown());
if (typeof process.send === "function") {
  process.on("message", (message) => {
    if (message && message.type === "shutdown") void shutdown();
  });
}

async function main() {
  await mkdir(versionDirectory, { recursive: true });
  watcher = chokidar.watch([sourceRoot, webRoot], {
    ignoreInitial: true,
    awaitWriteFinish: { stabilityThreshold: 200, pollInterval: 50 }
  });
  watcher.on("all", (event, filename) => {
    if (!["add", "change", "unlink"].includes(event) || !filename) return;
    const absolutePath = path.resolve(filename);
    if (isWithin(sourceRoot, absolutePath) && absolutePath.endsWith(".ts")) {
      log(`${path.relative(root, absolutePath)} changed.`);
      scheduleBuild();
    } else if (isWithin(webRoot, absolutePath)) {
      scheduleWebReload(absolutePath);
    }
  });
  watcher.on("error", (error) => {
    process.stderr.write(`[dev] File watcher error: ${error instanceof Error ? error.message : String(error)}\n`);
    void shutdown(1);
  });
  await new Promise((resolve, reject) => {
    watcher.once("ready", resolve);
    watcher.once("error", reject);
  });

  log("Building the project...");
  if (!(await compile())) throw new Error("Initial TypeScript build failed.");
  await bumpVersion();
  await openDashboard(false);
  log("Watching src/ and web/. Save a file to rebuild or refresh; press Ctrl+C to stop.");
}

void main().catch(async (error) => {
  process.stderr.write(`[dev] ${error instanceof Error ? error.message : String(error)}\n`);
  await shutdown(1);
});
