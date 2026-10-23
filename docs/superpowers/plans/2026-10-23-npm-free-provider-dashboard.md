# Free Provider Dashboard Implementation Plan

> **For agentic workers:** Use this plan to implement the approved design in `docs/superpowers/specs/2026-10-23-free-provider-dashboard-design.md`.

**Goal:** Replace the Windows-only Python helper with a cross-platform npm application that lists officially documented free LLM quotas, opens provider setup pages in the user's Chrome profile, creates keys through supported official APIs, and stores keys in the operating system credential store.

**Architecture:** A Node.js TypeScript CLI starts a loopback-only dashboard and uses a curated registry with official quota sources. Provider provisioning remains explicit and uses the existing official API flows; dashboard-generated keys can be saved through a minimal Chrome extension and Native Messaging host. The extension has no cookies, history, debugger, or broad provider-page permissions.

**Tech Stack:** Node.js LTS, TypeScript, Node built-in HTTP/crypto/process APIs, `@napi-rs/keyring` with Linux pinned to Secret Service, Chrome Manifest V3, Native Messaging.

**Spec:** `docs/superpowers/specs/2026-10-23-free-provider-dashboard-design.md`

## Global Constraints

- Support Windows, Linux, and macOS without requiring Python.
- Only display providers with ongoing, officially documented free access; upstream `data.json` is discovery input only.
- Record the free quota, model/plan scope, reset period, source URL, and verification date; mark account-specific or unavailable values clearly.
- Bind the local service to `127.0.0.1`, validate Host/Origin/session token, and do not enable broad CORS.
- Use Chrome Native Messaging with an exact extension origin and validated message schemas.
- Do not read Chrome cookies, storage, profile files, passwords, or MFA; stop for user action at MFA, CAPTCHA, terms, payment, and sensitive permission prompts.
- Store API keys only in the OS credential store; Linux must require Secret Service and must not silently fall back to keyutils or files.
- Do not retry uncertain key creation or overwrite a stored key without an explicit user choice.
- Do not add or run tests in this task; inspect changes and use non-test formatting checks only.

## Review Focus

- Missing Linux Secret Service: saving must fail clearly without creating a plaintext or kernel-memory fallback.
- Cross-site requests and DNS rebinding: the local API must reject requests without a loopback Host, exact Origin, and random session token.
- Provider create request accepted but response/save uncertain: report reconciliation instructions and never issue an automatic duplicate create request.
- Chrome extension not installed or Native Messaging unavailable: dashboard remains usable and shows an explicit manual save path.
- Stale or account-specific quota: display the source/date and avoid implying a universal live remaining balance.

## File Structure

- `package.json`, `tsconfig.json`: npm package metadata, commands, build, and Node engine floor.
- `src/registry.ts`: curated provider quota, endpoints, setup links, and source metadata.
- `src/secrets.ts`: OS credential store wrapper and status-only secret operations.
- `src/provisioners.ts`: official Google, Cloudflare, and OpenRouter key-creation APIs with bounded HTTP handling.
- `src/server.ts`: loopback dashboard server, session/Origin checks, provider and provisioning routes.
- `src/cli.ts`: `start`, `list`, `guide`, `provision`, `key-status`, `save-key`, and Chrome-host commands.
- `src/native-host.ts`, `src/chrome-host.ts`: framed Native Messaging protocol, schema/origin validation, and per-OS host registration.
- `web/`: local dashboard UI and styling.
- `extension/`: minimal Manifest V3 extension with explicit user-triggered key forwarding.
- `README.md`, `AI_GUIDE.md`, `.gitignore`: npm installation and safety guidance; remove the Python-only setup and runtime dependency.

## Tasks

### Task 1: Create npm package and verified free-provider registry

**Files:** Create `package.json`, `tsconfig.json`, `src/registry.ts`; modify `.gitignore`.

**Interfaces:**
- Produces `ProviderRecord`, `QuotaRecord`, `PROVIDERS`, `getProvider(id)`, and `getPublicQuota(id)` for the dashboard and adapters.
- Every provider record has stable `id`, `name`, `endpoint`, `keyUrl`, `quota`, `sourceUrl`, `verifiedAt`, and optional `accountQuotaUrl`.

- [ ] Create npm scripts for build/start and the `freemodel-lab` executable; require a supported Node LTS version and include production dependencies for native keyring and host installation.
- [ ] Curate Gemini API, Cloudflare Workers AI, Groq, Mistral AI Studio, and OpenRouter from their official pricing/rate-limit pages; retain account/model variability in the text instead of inventing a shared numeric limit.
- [ ] Keep the upstream catalog URL as discovery metadata only; do not merge unverified provider rows into the active dashboard.
- [ ] Ignore `dist/`, `node_modules/`, local cache, and generated host artifacts.
- [ ] Review registry fields against the source links embedded in each record.

### Task 2: Port secure storage and official provisioning

**Files:** Create `src/secrets.ts`, `src/provisioners.ts`; consume `src/registry.ts`.

**Interfaces:**
- `saveSecret(providerId: string, value: string): Promise<void>` validates the provider, refuses blank/oversize values, and stores under a stable service/key name.
- `hasSecret(providerId: string): Promise<boolean>` returns status only; no API exposes a stored value.
- `provision(providerId: string, input: ProvisionInput): Promise<ProvisionResult>` returns a saved/not-saved outcome without returning or logging the key.

- [ ] Implement Windows Credential Manager, macOS Keychain, and Linux Secret Service via `@napi-rs/keyring`; pin Linux to `secret-service`.
- [ ] Port Gemini API Keys creation using an existing gcloud access token, project, and existing service-account email; keep bounded operation polling and no duplicate retry after uncertainty.
- [ ] Port Cloudflare scoped Workers AI token creation with account ID and a user-supplied bootstrap token held only in request memory.
- [ ] Port OpenRouter key creation only when the user explicitly supplies a positive monthly spend cap; display the paid-spend warning before the request.
- [ ] Revoke no remote key implicitly; report when remote creation succeeded but secure local storage failed.

### Task 3: Add loopback dashboard service and UI

**Files:** Create `src/server.ts`, `web/index.html`, `web/app.js`, `web/style.css`; consume registry and storage/provisioning APIs.

**Interfaces:**
- `startServer({port?: number, openChrome?: boolean}): Promise<{url: string, close(): Promise<void>}>` binds only `127.0.0.1` and gives the page a random in-memory session token.
- `GET /api/providers` returns only sanitized public metadata and status-only key presence.
- `POST /api/keys/:providerId` stores a user-entered key; `POST /api/provision/:providerId` invokes only an explicitly selected supported adapter.

- [ ] Verify loopback Host, exact same-origin Origin, and per-run random session token before all API routes; reject cross-origin requests and large bodies.
- [ ] Serve static UI without external scripts, remote fonts, analytics, or telemetry.
- [ ] Show current free quota, plan/model scope, endpoint, setup link, official source, verification date, key status, and explicit account-quota caveats.
- [ ] Add buttons to open provider setup pages in Chrome/default browser, show a manual key save path, and offer provision forms only for verified adapters.
- [ ] Make provisioning confirmation, spend cap, and post-create storage failure visible; do not retry automatically.

### Task 4: Add the Chrome extension and Native Messaging host

**Files:** Create `src/native-host.ts`, `src/chrome-host.ts`, `extension/manifest.json`, `extension/service-worker.js`, `extension/popup.html`, and `extension/popup.js`.

**Interfaces:**
- Native messages use `{version: 1, action: "ping" | "save-key", providerId?: string, secret?: string}` with 1 MiB framing limit, exact provider IDs, and exact allowed extension origin.
- `installChromeHost()` registers a per-user host manifest and reports the folder the user must load as an unpacked extension; `removeChromeHost()` removes only this app's registration.

- [ ] Use a fixed public extension key so the extension ID and Native Messaging `allowed_origins` are stable across platforms.
- [ ] Implement little-endian length-prefixed UTF-8 framing; write diagnostics only to stderr and never log message secrets.
- [ ] Implement a POSIX executable host script and build/register a Windows executable host using Node SEA tooling available to the installed Node runtime.
- [ ] Register host manifests under the current user on Windows, macOS, and Linux; do not touch system-wide Chrome settings.
- [ ] Add extension popup actions for host status and user-triggered key forwarding; request only `nativeMessaging` permission and accept external messages only from the dashboard origin.
- [ ] Keep dashboard operation available when the extension is missing; show precise installation and manual fallback instructions.

### Task 5: Replace Python CLI and update user guidance

**Files:** Create/modify `src/cli.ts`; modify `README.md`, `AI_GUIDE.md`; remove `provider_helper.py` and `requirements.txt`.

- [ ] Implement npm commands `start`, `list`, `guide`, `provision`, `key-status`, `save-key`, `chrome install`, and `chrome remove` with hidden prompts for bootstrap secrets.
- [ ] Document Node/npm installation for Windows, macOS, and Linux, Chrome extension loading, Secret Service requirements, official quota sources, provider caveats, and manual MFA/CAPTCHA/payment handling.
- [ ] Remove obsolete Python command examples and Windows-only storage claims.
- [ ] Review all UI, logs, errors, and docs for key values, bootstrap tokens, unsupported quota claims, or instructions to bypass provider controls.
- [ ] Run `git diff --check` only; do not run automated tests or provider create calls.
