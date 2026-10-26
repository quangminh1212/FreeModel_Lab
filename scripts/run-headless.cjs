"use strict";

const { spawn } = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const fsp = require("node:fs/promises");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const localData = process.env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local");
const dataDirectory = path.join(localData, "FreeModel Lab");
const stateFile = path.join(dataDirectory, "run-state.json");
const lockFile = path.join(dataDirectory, "run.lock");
const urlFile = path.join(dataDirectory, "dashboard.url");
const logFile = path.join(dataDirectory, "dev.log");
const devScript = path.join(root, "scripts", "dev.cjs");

function log(message) {
  try {
    fs.mkdirSync(dataDirectory, { recursive: true });
    fs.appendFileSync(logFile, `${new Date().toISOString()} ${message}\n`, "utf8");
  } catch {}
}

function readJson(filename) {
  try {
    return JSON.parse(fs.readFileSync(filename, "utf8"));
  } catch {
    return null;
  }
}

function writeJson(filename, value) {
  fs.mkdirSync(dataDirectory, { recursive: true });
  const temporary = `${filename}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  fs.renameSync(temporary, filename);
}

function removeFile(filename) {
  try { fs.unlinkSync(filename); } catch (error) {
    if (error.code !== "ENOENT") log(`Could not remove ${path.basename(filename)}: ${error.message}`);
  }
}

function isProcessRunning(pid) {
  if (!Number.isSafeInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code === "EPERM";
  }
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function print(message) {
  process.stdout.write(`${message}\n`);
}

async function findExistingService() {
  const state = readJson(stateFile);
  if (state && Number.isInteger(state.controlPort) && state.token) {
    try {
      return await callControl(state, "GET", "/status");
    } catch {}
  }
  return null;
}

async function start() {
  fs.mkdirSync(dataDirectory, { recursive: true });
  const existing = await findExistingService();
  if (existing?.ok) {
    print(`FreeModel Lab đã chạy: ${existing.url || "đang khởi động"}`);
    return;
  }
  removeFile(stateFile);
  removeFile(urlFile);

  let lock;
  try {
    lock = await fsp.open(lockFile, "wx");
  } catch (error) {
    if (error.code !== "EEXIST") throw error;
    const owner = readJson(lockFile);
    if (!owner || !owner.pid || isProcessRunning(owner.pid)) {
      print("FreeModel Lab đang khởi động nền. Dùng run.bat --status để xem tiến độ.");
      return;
    }
    removeFile(lockFile);
    try {
      lock = await fsp.open(lockFile, "wx");
    } catch (retryError) {
      if (retryError.code === "EEXIST") {
        print("FreeModel Lab đang khởi động nền. Dùng run.bat --status để xem tiến độ.");
        return;
      }
      throw retryError;
    }
  }

  let supervisor;
  try {
    supervisor = spawn(process.execPath, [__filename, "--supervisor"], {
      cwd: root,
      detached: true,
      env: process.env,
      shell: false,
      windowsHide: true,
      stdio: ["pipe", "ignore", "ignore"]
    });
    if (!supervisor.pid) throw new Error("Node.js did not create the background process.");
    await lock.writeFile(JSON.stringify({ pid: supervisor.pid, startedAt: new Date().toISOString() }), "utf8");
    await lock.close();
    supervisor.once("error", (error) => {
      log(`Could not start supervisor: ${error.message}`);
      removeFile(lockFile);
    });
    supervisor.stdin.end("start");
    supervisor.unref();
    print("FreeModel Lab đang khởi động ẩn. run-hidden.vbs sẽ mở giao diện; run.bat --status xem trạng thái.");
  } catch (error) {
    await lock.close().catch(() => {});
    removeFile(lockFile);
    if (supervisor && supervisor.pid) supervisor.kill();
    throw error;
  }
}

function waitForLaunchSignal() {
  return new Promise((resolve, reject) => {
    process.stdin.once("data", () => {
      process.stdin.pause();
      resolve();
    });
    process.stdin.once("end", () => reject(new Error("Launcher ended before startup.")));
    process.stdin.resume();
  });
}

function resolveNpmCli() {
  const candidates = [path.dirname(process.execPath), ...(process.env.PATH || "").split(path.delimiter)];
  for (const directory of candidates) {
    const cleanDirectory = directory.replace(/^"|"$/g, "");
    if (!cleanDirectory) continue;
    const cli = path.join(cleanDirectory, "node_modules", "npm", "bin", "npm-cli.js");
    if (fs.existsSync(cli)) return cli;
  }
  return null;
}

function waitForClose(child, milliseconds) {
  if (child.exitCode !== null || child.signalCode !== null) return Promise.resolve(true);
  return new Promise((resolve) => {
    const onClose = () => {
      clearTimeout(timer);
      resolve(true);
    };
    const timer = setTimeout(() => {
      child.off("close", onClose);
      resolve(false);
    }, milliseconds);
    child.once("close", onClose);
  });
}

async function requestStop(state) {
  const response = await callControl(state, "POST", "/stop");
  if (!response.ok) throw new Error(response.error || "Server refused the stop request.");
  return response;
}

async function callControl(state, method, route) {
  const response = await fetch(`http://127.0.0.1:${state.controlPort}${route}`, {
    method,
    headers: { "x-freemodel-token": state.token },
    signal: AbortSignal.timeout(2000)
  });
  if (!response.ok) throw new Error(`Control endpoint returned HTTP ${response.status}.`);
  return response.json();
}

async function status() {
  const service = await findExistingService();
  if (service?.ok) {
    const location = service.url ? ` | ${service.url}` : " | đang khởi động";
    print(`FreeModel Lab: ${service.state}${location}`);
    print(`Log: ${service.logFile}`);
    print("Mở lại giao diện bằng run.bat --open.");
    return;
  }

  const lock = readJson(lockFile);
  if (lock?.pid && isProcessRunning(lock.pid)) {
    print(`FreeModel Lab đang khởi động nền (PID ${lock.pid}). Thử lại sau vài giây.`);
    print(`Log: ${logFile}`);
    return;
  }
  if (lock) removeFile(lockFile);
  removeFile(stateFile);
  removeFile(urlFile);
  print("FreeModel Lab hiện không chạy.");
}

async function stop() {
  let service = await findExistingService();
  for (let attempt = 0; !service && attempt < 8; attempt += 1) {
    const lock = readJson(lockFile);
    if (!lock?.pid || !isProcessRunning(lock.pid)) break;
    await delay(350);
    service = await findExistingService();
  }

  if (!service?.ok) {
    const lock = readJson(lockFile);
    if (!lock?.pid || !isProcessRunning(lock.pid)) {
      if (lock) removeFile(lockFile);
      removeFile(stateFile);
      removeFile(urlFile);
      print("FreeModel Lab hiện không chạy.");
      return;
    }
    print("Chưa kết nối được bộ điều khiển nền. Hãy thử run.bat --stop sau vài giây.");
    return;
  }

  const state = readJson(stateFile);
  await requestStop(state);
  for (let attempt = 0; attempt < 30; attempt += 1) {
    if (!readJson(stateFile)) {
      print("Đã dừng FreeModel Lab.");
      return;
    }
    await delay(250);
  }
  print("Đã gửi yêu cầu dừng; tiến trình đang đóng các kết nối còn lại.");
}

function runNpmInstall() {
  const npmCli = resolveNpmCli();
  if (!npmCli) return Promise.reject(new Error("Không tìm thấy npm. Cài Node.js 24 trở lên kèm npm rồi chạy lại."));

  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [npmCli, "install", "--no-audit", "--no-fund"], {
      cwd: root,
      env: process.env,
      shell: false,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"]
    });
    activeChild = child;
    child.stdout.on("data", (chunk) => log(chunk.toString("utf8").trimEnd()));
    child.stderr.on("data", (chunk) => log(chunk.toString("utf8").trimEnd()));
    child.once("error", reject);
    child.once("close", (code) => {
      if (activeChild === child) activeChild = null;
      if (stopping) return resolve(false);
      if (code === 0) return resolve(true);
      reject(new Error(`npm install stopped with exit code ${code}. See ${logFile}`));
    });
  });
}

let activeChild = null;
let devChild = null;
let controlServer = null;
let stopping = false;
let finishing = null;
let state = null;

function persistState() {
  if (state) writeJson(stateFile, state);
}

async function ensureDependencies() {
  if (Number(process.versions.node.split(".")[0]) < 24) {
    throw new Error(`Node.js 24 or newer is required; found ${process.versions.node}.`);
  }
  const watcher = path.join(root, "node_modules", "chokidar", "package.json");
  const compiler = path.join(root, "node_modules", "typescript", "bin", "tsc");
  if (fs.existsSync(watcher) && fs.existsSync(compiler)) return;
  log("Dependencies are missing; running npm install.");
  state.state = "installing";
  persistState();
  if (!(await runNpmInstall())) return;
  if (!fs.existsSync(watcher) || !fs.existsSync(compiler)) {
    throw new Error("npm install completed but dev dependencies are still missing.");
  }
}

function recordDashboardUrl(line) {
  const match = line.match(/Dashboard:\s+(http:\/\/127\.0\.0\.1:\d+\/?)/i);
  if (!match) return;
  const url = `${new URL(match[1]).origin}/`;
  state.url = url;
  persistState();
}

function recordDashboardBootstrap(message) {
  if (!message || message.type !== "dashboard" || typeof message.url !== "string") return;
  let parsed;
  try { parsed = new URL(message.url); } catch { return; }
  const token = parsed.searchParams.get("session");
  if (parsed.protocol !== "http:" || parsed.hostname !== "127.0.0.1" || parsed.pathname !== "/" || !/^[A-Za-z0-9_-]{40,64}$/.test(token || "")) return;
  state.url = `${parsed.origin}/`;
  state.state = "running";
  fs.writeFileSync(urlFile, parsed.href, { encoding: "utf8", mode: 0o600 });
  persistState();
}

function pipeLog(stream, prefix) {
  let pending = "";
  stream.on("data", (chunk) => {
    pending += chunk.toString("utf8");
    const lines = pending.split(/\r?\n/);
    pending = lines.pop() || "";
    for (const line of lines) {
      log(`${prefix}${line}`);
      recordDashboardUrl(line);
    }
  });
  stream.on("end", () => {
    if (!pending) return;
    log(`${prefix}${pending}`);
    recordDashboardUrl(pending);
  });
}

function stopActiveChild() {
  if (!activeChild || activeChild.exitCode !== null || activeChild.signalCode !== null) return Promise.resolve();
  const child = activeChild;
  if (child === devChild && child.connected) {
    try { child.send({ type: "shutdown" }); } catch {}
  } else {
    try { child.kill(); } catch {}
  }
  return waitForClose(child, child === devChild ? 7000 : 3000).then((closed) => {
    if (!closed) {
      try { child.kill(); } catch {}
      return waitForClose(child, 2500);
    }
    return true;
  });
}

function finish(exitCode = 0) {
  if (finishing) return finishing;
  stopping = true;
  finishing = (async () => {
    if (state) {
      state.state = "stopping";
      try { persistState(); } catch {}
    }
    await stopActiveChild();
    if (controlServer) {
      await new Promise((resolve) => controlServer.close(() => resolve()));
      controlServer = null;
    }
    const lock = readJson(lockFile);
    if (lock?.pid === process.pid) removeFile(lockFile);
    if (state?.pid === process.pid) {
      removeFile(stateFile);
      removeFile(urlFile);
    }
    log("Background server stopped.");
    process.exitCode = exitCode;
  })();
  return finishing;
}

function startControlServer() {
  const token = crypto.randomBytes(32).toString("hex");
  controlServer = http.createServer((request, response) => {
    const supplied = request.headers["x-freemodel-token"];
    if (typeof supplied !== "string" || supplied.length !== token.length || !crypto.timingSafeEqual(Buffer.from(supplied), Buffer.from(token))) {
      response.writeHead(401, { "content-type": "application/json; charset=utf-8" });
      response.end(JSON.stringify({ ok: false, error: "Unauthorized" }));
      return;
    }
    if (request.method === "GET" && request.url === "/status") {
      response.writeHead(200, { "content-type": "application/json; charset=utf-8" });
      response.end(JSON.stringify({ ok: true, state: state.state, url: state.url || "", pid: state.pid, childPid: devChild?.pid || null, logFile }));
      return;
    }
    if (request.method === "POST" && request.url === "/stop") {
      response.writeHead(200, { "content-type": "application/json; charset=utf-8" });
      response.end(JSON.stringify({ ok: true }));
      setImmediate(() => void finish(0));
      return;
    }
    response.writeHead(404, { "content-type": "application/json; charset=utf-8" });
    response.end(JSON.stringify({ ok: false, error: "Not found" }));
  });
  controlServer.on("error", (error) => {
    log(`Control server failed: ${error.message}`);
    void finish(1);
  });
  controlServer.listen(0, "127.0.0.1", async () => {
    state = {
      pid: process.pid,
      controlPort: controlServer.address().port,
      token,
      startedAt: new Date().toISOString(),
      state: "starting",
      url: ""
    };
    try {
      removeFile(urlFile);
      persistState();
      await beginServer();
    } catch (error) {
      log(error instanceof Error ? error.stack || error.message : String(error));
      void finish(1);
    }
  });
}

async function beginServer() {
  await ensureDependencies();
  if (stopping) return;
  state.state = "starting";
  persistState();
  const child = spawn(process.execPath, [devScript], {
    cwd: root,
    env: process.env,
    shell: false,
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe", "ipc"]
  });
  devChild = child;
  activeChild = child;
  state.state = "building";
  persistState();
  pipeLog(child.stdout, "");
  pipeLog(child.stderr, "[stderr] ");
  child.on("message", recordDashboardBootstrap);
  child.once("error", (error) => {
    log(`Could not start dev server: ${error.message}`);
    if (activeChild === child) activeChild = null;
    if (devChild === child) devChild = null;
    void finish(1);
  });
  child.once("close", (code, signal) => {
    if (activeChild === child) activeChild = null;
    if (devChild === child) devChild = null;
    if (!stopping) {
      log(`Dev server exited (code=${code}, signal=${signal || "none"}).`);
      void finish(code === 0 ? 0 : 1);
    }
  });
}

async function supervise() {
  try {
    await waitForLaunchSignal();
    fs.mkdirSync(dataDirectory, { recursive: true });
    fs.writeFileSync(logFile, "", "utf8");
    startControlServer();
    process.once("SIGINT", () => void finish(0));
    process.once("SIGTERM", () => void finish(0));
    process.once("uncaughtException", (error) => {
      log(error.stack || error.message);
      void finish(1);
    });
    process.once("unhandledRejection", (error) => {
      log(error instanceof Error ? error.stack || error.message : String(error));
      void finish(1);
    });
  } catch (error) {
    log(error instanceof Error ? error.stack || error.message : String(error));
    removeFile(lockFile);
    process.exitCode = 1;
  }
}

async function main() {
  const command = process.argv[2] || "--start";
  if (command === "--supervisor") return supervise();
  if (command === "--status") return status();
  if (command === "--stop") return stop();
  if (command === "--start") return start();
  print("Usage: node scripts/run-headless.cjs [--start|--status|--stop]");
  process.exitCode = command === "--help" ? 0 : 2;
}

void main().catch((error) => {
  print(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
