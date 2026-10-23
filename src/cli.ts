#!/usr/bin/env node
import { getProvider, listProviders, resolveEndpoint } from "./registry";
import { getSecret, hasSecret, saveSecret } from "./secrets";
import { provision, type ProvisionInput } from "./provisioners";
import { startServer } from "./server";
import { installChromeHost, removeChromeHost } from "./chrome-host";

type ParsedArgs = { positionals: string[]; values: Map<string, string>; flags: Set<string> };

function parseArgs(args: string[]): ParsedArgs {
  const positionals: string[] = [];
  const values = new Map<string, string>();
  const flags = new Set<string>();
  for (let index = 0; index < args.length; index += 1) {
    const item = args[index]!;
    if (!item.startsWith("--")) { positionals.push(item); continue; }
    const key = item.slice(2);
    if (["overwrite", "replace", "no-open", "help"].includes(key)) { flags.add(key); continue; }
    const value = args[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`Missing value for --${key}.`);
    values.set(key, value);
    index += 1;
  }
  return { positionals, values, flags };
}

function usage(): void {
  process.stdout.write(`FreeModel Lab - free provider catalog, API keys, and endpoints\n\nCommands:\n  freemodel-lab start [--no-open]\n  freemodel-lab list\n  freemodel-lab guide <provider-id>\n  freemodel-lab provision <provider-id> [options]\n  freemodel-lab save-key <provider-id> [--replace]\n  freemodel-lab key-status [provider-id]\n  freemodel-lab integration export <provider-id> [--account-id <id>]\n  freemodel-lab chrome install\n  freemodel-lab chrome remove\n\nIntegration export prints JSON containing the saved key to stdout.\nProvision options:\n  Gemini:     --project <id> --service-account-email <email> [--name <name>] [--overwrite]\n  Cloudflare: --account-id <id> [--name <name>] [--expires-on <ISO-8601>] [--overwrite]\n  OpenRouter: --limit-usd <positive-cap> [--name <name>] [--overwrite]\n`);
}

async function readHidden(prompt: string): Promise<string> {
  if (!process.stdin.isTTY || typeof process.stdin.setRawMode !== "function") {
    throw new Error("A hidden prompt requires an interactive terminal. Start the command from a terminal, not a redirected script.");
  }
  return new Promise((resolve, reject) => {
    const input = process.stdin;
    const wasRaw = input.isRaw;
    input.setRawMode(true);
    input.resume();
    process.stdout.write(prompt);
    let value = "";
    const finish = (error?: Error) => {
      input.off("data", onData);
      input.setRawMode(Boolean(wasRaw));
      process.stdout.write("\n");
      if (error) reject(error);
      else resolve(value);
    };
    const onData = (chunk: Buffer) => {
      for (const character of chunk.toString("utf8")) {
        if (character === "\u0003") { finish(new Error("Prompt cancelled.")); return; }
        if (character === "\r" || character === "\n") { finish(); return; }
        if (character === "\u0008" || character === "\u007f") value = value.slice(0, -1);
        else if (character >= " " && character !== "\u007f" && value.length < 16_384) value += character;
      }
    };
    input.on("data", onData);
  });
}

function statusValue(providerId: string): string {
  try { return hasSecret(providerId) ? "đã lưu trong kho hệ điều hành" : "chưa lưu"; }
  catch { return process.platform === "linux" ? "Secret Service chưa sẵn sàng" : "kho credential chưa sẵn sàng"; }
}

function commandList(): void {
  for (const provider of listProviders()) {
    process.stdout.write(`${provider.name}\n`);
    process.stdout.write(`  Quota free: ${provider.quota.summary}\n`);
    process.stdout.write(`  Phạm vi: ${provider.quota.scope}\n`);
    process.stdout.write(`  Endpoint: ${provider.endpoint}\n`);
    process.stdout.write(`  Key: ${statusValue(provider.id)}\n`);
    process.stdout.write(`  Nguồn (${provider.verifiedAt}): ${provider.sourceUrl}\n\n`);
  }
}

function commandGuide(providerId: string): void {
  const provider = getProvider(providerId);
  if (!provider) throw new Error("Provider ID không hợp lệ. Chạy `freemodel-lab list` để xem danh sách.");
  process.stdout.write(`${provider.name}\n`);
  process.stdout.write(`Quota: ${provider.quota.summary}\n`);
  process.stdout.write(`Phạm vi: ${provider.quota.scope}\n`);
  process.stdout.write(`Chu kỳ: ${provider.quota.reset}\n`);
  process.stdout.write(`Endpoint: ${resolveEndpoint(provider)}\n`);
  process.stdout.write(`Trang tạo key: ${provider.keyUrl}\n`);
  process.stdout.write(`Trang quota tài khoản: ${provider.quotaUrl}\n`);
  process.stdout.write(`Nguồn: ${provider.sourceUrl} (xác minh ${provider.verifiedAt})\n`);
  process.stdout.write(`Key: ${statusValue(provider.id)}\n`);
  if (!provider.provisioner) process.stdout.write("Tạo key thủ công trên trang chính thức; repo chưa có API provisioning đã xác minh cho provider này.\n");
}

function provisionInput(parsed: ParsedArgs, providerId: string): ProvisionInput {
  const input: ProvisionInput = {
    name: parsed.values.get("name"),
    overwrite: parsed.flags.has("overwrite")
  };
  if (providerId === "gemini") {
    input.project = parsed.values.get("project");
    input.serviceAccountEmail = parsed.values.get("service-account-email");
  } else if (providerId === "cloudflare-workers-ai") {
    input.accountId = parsed.values.get("account-id");
    input.expiresOn = parsed.values.get("expires-on");
  } else if (providerId === "openrouter") {
    const amount = parsed.values.get("limit-usd");
    input.monthlyLimitUsd = amount === undefined ? undefined : Number(amount);
  }
  return input;
}

async function commandProvision(providerId: string, parsed: ParsedArgs): Promise<void> {
  const provider = getProvider(providerId);
  if (!provider) throw new Error("Provider ID không hợp lệ. Chạy `freemodel-lab list` để xem danh sách.");
  if (!provider.provisioner) throw new Error(`Provider này chưa có API tạo key đã xác minh. Tạo key tại ${provider.keyUrl} rồi dùng freemodel-lab save-key ${provider.id}.`);
  const input = provisionInput(parsed, providerId);
  if (providerId === "cloudflare-workers-ai") {
    input.bootstrapToken = await readHidden("Cloudflare bootstrap API token (không lưu): ");
  } else if (providerId === "openrouter") {
    input.managementKey = await readHidden("OpenRouter management key (không lưu): ");
  }
  const result = await provision(providerId, input);
  process.stdout.write(`${result.message}\nEndpoint: ${result.endpoint}\n`);
}

async function commandSaveKey(providerId: string, replace: boolean): Promise<void> {
  const provider = getProvider(providerId);
  if (!provider) throw new Error("Provider ID không hợp lệ. Chạy `freemodel-lab list` để xem danh sách.");
  const hasExisting = hasSecret(providerId);
  if (hasExisting && !replace) throw new Error("Key đã được lưu. Dùng --replace nếu muốn ghi key mới; key cũ tại provider sẽ không bị thu hồi.");
  const secret = await readHidden(`Nhập API key cho ${provider.name} (không hiển thị): `);
  saveSecret(providerId, secret, replace);
  process.stdout.write("Đã lưu key vào kho credential của hệ điều hành.\n");
}

function commandIntegrationExport(providerId: string, accountId?: string): void {
  const provider = getProvider(providerId);
  if (!provider) throw new Error("Provider ID không hợp lệ. Chạy `freemodel-lab list` để xem danh sách.");
  const apiKey = getSecret(providerId);
  if (!apiKey) throw new Error("Provider chưa có key trong kho credential của hệ điều hành.");
  const endpoint = resolveEndpoint(provider, accountId);
  if (endpoint.includes("{account_id}")) throw new Error("Cloudflare cần --account-id để xuất endpoint hoàn chỉnh.");
  const configuration = {
    providerId: provider.id,
    name: provider.name,
    endpoint,
    baseURL: endpoint,
    apiKey,
    models: provider.quota.models ?? []
  };
  process.stderr.write("Cảnh báo: JSON xuất ra stdout có chứa API key. Chỉ chuyển trực tiếp vào ứng dụng hoặc tệp riêng tư.\n");
  process.stdout.write(`${JSON.stringify(configuration, null, 2)}\n`);
}

async function commandStart(noOpen: boolean): Promise<void> {
  const dashboard = await startServer({ openChrome: !noOpen });
  process.stdout.write(`FreeModel Lab đang chạy trên máy này.\nMở dashboard trong Chrome đã đăng nhập: ${dashboard.url}\nDừng bằng Ctrl+C.\n`);
  await new Promise<void>((resolve) => process.once("SIGINT", resolve));
  await dashboard.close();
  process.stdout.write("Dashboard đã dừng.\n");
}

async function main(): Promise<void> {
  const [command = "help", ...args] = process.argv.slice(2);
  const parsed = parseArgs(args);
  if (parsed.flags.has("help") || command === "help") { usage(); return; }
  if (command === "start") { await commandStart(parsed.flags.has("no-open")); return; }
  if (command === "list") { commandList(); return; }
  if (command === "guide") {
    if (!parsed.positionals[0]) throw new Error("Cần provider ID. Chạy `freemodel-lab list` để xem danh sách.");
    commandGuide(parsed.positionals[0]);
    return;
  }
  if (command === "provision") {
    if (!parsed.positionals[0]) throw new Error("Cần provider ID.");
    await commandProvision(parsed.positionals[0], parsed);
    return;
  }
  if (command === "save-key") {
    if (!parsed.positionals[0]) throw new Error("Cần provider ID.");
    await commandSaveKey(parsed.positionals[0], parsed.flags.has("replace"));
    return;
  }
  if (command === "key-status") {
    if (parsed.positionals[0]) process.stdout.write(`${parsed.positionals[0]}: ${statusValue(parsed.positionals[0])}\n`);
    else for (const provider of listProviders()) process.stdout.write(`${provider.name}: ${statusValue(provider.id)}\n`);
    return;
  }
  if (command === "integration" && parsed.positionals[0] === "export") {
    if (!parsed.positionals[1]) throw new Error("Cần provider ID. Chạy `freemodel-lab list` để xem danh sách.");
    commandIntegrationExport(parsed.positionals[1], parsed.values.get("account-id"));
    return;
  }
  if (command === "chrome" && parsed.positionals[0] === "install") {
    const result = await installChromeHost();
    process.stdout.write(`Native Messaging host đã đăng ký cho user hiện tại.\nMở Chrome Extensions > bật Developer mode > Load unpacked.\nChọn thư mục extension: ${result.extensionPath}\nSau đó ghim FreeModel Lab Bridge và bấm kiểm tra.\n`);
    return;
  }
  if (command === "chrome" && parsed.positionals[0] === "remove") {
    await removeChromeHost();
    process.stdout.write("Đã gỡ Native Messaging host của FreeModel Lab. Extension unpacked cần được gỡ riêng trong chrome://extensions.\n");
    return;
  }
  usage();
  throw new Error(`Lệnh không được hỗ trợ: ${command}`);
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "FreeModel Lab command failed.";
  process.stderr.write(`Error: ${message}\n`);
  process.exitCode = 1;
});

