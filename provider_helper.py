#!/usr/bin/env python3
"""Read public provider metadata and guide user-controlled API key setup."""

from __future__ import annotations

import argparse
import getpass
import json
import math
import os
import re
import subprocess
import sys
import time
from pathlib import Path
from datetime import datetime, timezone
from urllib.error import HTTPError, URLError
from urllib.parse import quote, urlencode, urlparse
from urllib.request import Request, urlopen

SOURCE_URL = (
    "https://raw.githubusercontent.com/mnfst/awesome-free-llm-apis/"
    "main/data.json"
)
SERVICE_NAME = "FreeModel_Lab"
MAX_CATALOG_BYTES = 4 * 1024 * 1024
MAX_API_RESPONSE_BYTES = 1024 * 1024
CACHE_PATH = Path(__file__).resolve().parent / ".cache" / "providers.json"

PROVISIONING_INFO = {
    "googlegemini": (
        "official API; requires an authenticated gcloud account, a Google Cloud "
        "project, a service account, and key-creation IAM permissions"
    ),
    "cloudflareworkersai": (
        "official API; requires an account ID and a bootstrap Cloudflare token "
        "with Account API Tokens Write"
    ),
    "openrouter": (
        "official API; requires an existing OpenRouter management key and a "
        "monthly spend cap"
    ),
}
NO_KEY_PROVIDERS = {"kilocode"}
TRUSTED_PROVIDER_DOMAINS = {
    "aionlabs.ai",
    "cohere.com",
    "google.com",
    "googleapis.com",
    "mistral.ai",
    "bigmodel.cn",
    "cloudflare.com",
    "groq.com",
    "huggingface.co",
    "kilo.ai",
    "llm7.io",
    "modelscope.cn",
    "nvidia.com",
    "ollama.com",
    "openrouter.ai",
    "ovhcloud.com",
    "siliconflow.cn",
}
OFFICIAL_ENDPOINTS = {
    "googlegemini": "https://generativelanguage.googleapis.com/v1beta",
    "cloudflareworkersai": "https://api.cloudflare.com/client/v4/accounts/{account_id}/ai/run",
    "openrouter": "https://openrouter.ai/api/v1",
}


class CatalogError(Exception):
    """The public catalog could not be read or validated."""


def normalize(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", value.casefold())


def credential_id(provider: dict) -> str:
    return normalize(str(provider["name"]))


def validate_catalog(payload: object) -> dict:
    if not isinstance(payload, dict) or not isinstance(payload.get("providers"), list):
        raise CatalogError("Catalog is missing its providers list.")
    for provider in payload["providers"]:
        if not isinstance(provider, dict) or not isinstance(provider.get("name"), str):
            raise CatalogError("Catalog contains an entry without a provider name.")
    return payload


def fetch_catalog() -> dict:
    request = Request(SOURCE_URL, headers={"User-Agent": "FreeModel-Lab/0.1"})
    try:
        with urlopen(request, timeout=20) as response:
            raw = response.read(MAX_CATALOG_BYTES + 1)
    except (URLError, TimeoutError, OSError) as exc:
        raise CatalogError(f"Could not download public catalog: {exc}") from exc
    if len(raw) > MAX_CATALOG_BYTES:
        raise CatalogError("Catalog exceeded the 4 MiB safety limit.")
    try:
        return validate_catalog(json.loads(raw.decode("utf-8-sig")))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise CatalogError(f"Catalog was not valid UTF-8 JSON: {exc}") from exc


def write_cache(catalog: dict) -> None:
    CACHE_PATH.parent.mkdir(parents=True, exist_ok=True)
    temporary = CACHE_PATH.with_suffix(".tmp")
    temporary.write_text(
        json.dumps(catalog, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    temporary.replace(CACHE_PATH)


def read_cache() -> dict:
    try:
        return validate_catalog(json.loads(CACHE_PATH.read_text(encoding="utf-8")))
    except (OSError, UnicodeDecodeError, json.JSONDecodeError, CatalogError) as exc:
        raise CatalogError(f"Could not read cached catalog: {exc}") from exc


def load_catalog() -> dict:
    try:
        catalog = fetch_catalog()
        write_cache(catalog)
        return catalog
    except CatalogError as fetch_error:
        if CACHE_PATH.exists():
            print(f"Warning: {fetch_error}; using cached metadata.", file=sys.stderr)
            return read_cache()
        raise


def find_provider(catalog: dict, requested: str) -> dict:
    wanted = normalize(requested)
    providers = catalog["providers"]
    matches = [p for p in providers if normalize(p["name"]) == wanted]
    if len(matches) == 1:
        return matches[0]
    partial = [p for p in providers if wanted and wanted in normalize(p["name"])]
    if len(partial) == 1:
        return partial[0]
    choices = ", ".join(p["name"] for p in providers)
    raise CatalogError(f"Provider not found or ambiguous. Available: {choices}")


def https_url(value: object) -> str | None:
    if not isinstance(value, str):
        return None
    try:
        parsed = urlparse(value)
    except ValueError:
        return None
    host = (parsed.hostname or "").casefold().rstrip(".")
    try:
        port = parsed.port
    except ValueError:
        return None
    trusted_host = any(
        host == domain or host.endswith("." + domain)
        for domain in TRUSTED_PROVIDER_DOMAINS
    )
    if (
        parsed.scheme != "https"
        or not host
        or parsed.username is not None
        or parsed.password is not None
        or port not in (None, 443)
        or not trusted_host
    ):
        return None
    return value


def print_provider(provider: dict) -> None:
    setup_url = https_url(provider.get("url"))
    endpoint = provider.get("baseUrl")
    print(f"Provider: {safe_display(provider['name'])}")
    print(f"Category: {safe_display(provider.get('category', 'unknown'))}")
    trusted_endpoint = https_url(endpoint)
    print(
        "Endpoint: "
        + (
            safe_display(trusted_endpoint)
            if trusted_endpoint
            else "not shown; verify provider domain"
        )
    )
    print(
        "Key/setup page: "
        + (
            safe_display(setup_url)
            if setup_url
            else "not shown; verify official provider docs"
        )
    )
    description = provider.get("description")
    if isinstance(description, str) and description.strip():
        print(f"Catalog note: {safe_display(description.strip())}")
    models = provider.get("models")
    if isinstance(models, list) and models:
        print("Models and listed limits:")
        for model in models:
            if isinstance(model, dict):
                name = safe_display(model.get("name") or model.get("id") or "unnamed")
                limit = safe_display(model.get("rateLimit") or "not listed")
                print(f"  - {name}: {limit}")
    print("Verify current terms, quota, data use, and domain before creating a key.")


def safe_display(value: object) -> str:
    text = str(value)
    return "".join(
        character
        for character in text
        if ord(character) >= 32 and not 127 <= ord(character) <= 159
    )


def api_request_json(
    url: str,
    *,
    method: str = "GET",
    headers: dict[str, str],
    payload: dict | None = None,
    provider_name: str,
) -> dict:
    data = None
    request_headers = dict(headers)
    if payload is not None:
        data = json.dumps(payload, separators=(",", ":")).encode("utf-8")
        request_headers.setdefault("Content-Type", "application/json")
    request = Request(url, data=data, headers=request_headers, method=method)
    try:
        with urlopen(request, timeout=30) as response:
            raw = response.read(MAX_API_RESPONSE_BYTES + 1)
    except HTTPError as exc:
        exc.close()
        raise CatalogError(
            f"{provider_name} API returned HTTP {exc.code}; check the "
            "credential, project/account access, and permissions."
        ) from None
    except (URLError, TimeoutError, OSError):
        raise CatalogError(f"Could not reach the {provider_name} API.") from None
    if len(raw) > MAX_API_RESPONSE_BYTES:
        raise CatalogError(f"{provider_name} API response exceeded the safety limit.")
    try:
        result = json.loads(raw.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError):
        raise CatalogError(f"{provider_name} API returned invalid JSON.") from None
    if not isinstance(result, dict):
        raise CatalogError(f"{provider_name} API returned an unexpected response.")
    return result


def prepare_key_storage(provider: dict, overwrite: bool):
    keyring = windows_keyring()
    try:
        existing = keyring.get_password(SERVICE_NAME, credential_id(provider))
    except Exception:
        raise CatalogError("Could not access Windows Credential Locker.") from None
    if existing and not overwrite:
        raise CatalogError(
            f"A key is already saved for {provider['name']}. Refusing to create "
            "another one. Use --overwrite only if you will revoke the old "
            "provider key yourself."
        )
    return keyring


def store_created_key(keyring, provider: dict, value: object) -> None:
    if not isinstance(value, str) or not value.strip():
        raise CatalogError(f"{provider['name']} did not return a usable key.")
    try:
        keyring.set_password(
            SERVICE_NAME, credential_id(provider), value.strip()
        )
    except Exception:
        raise CatalogError(
            f"The {provider['name']} key was created remotely, but Windows "
            "Credential Locker could not save it. Revoke that key at the "
            "provider before retrying. The key value was not displayed."
        ) from None


def default_key_name(provider: dict) -> str:
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S-UTC")
    return f"FreeModel Lab {timestamp}"


def requested_key_name(args: argparse.Namespace, provider: dict, max_length: int) -> str:
    value = (args.name or default_key_name(provider)).strip()
    if (
        not value
        or len(value) > max_length
        or any(ord(character) < 32 for character in value)
    ):
        raise CatalogError(
            f"Key name must contain 1 to {max_length} printable characters."
        )
    return value


def provision_openrouter(provider: dict, args: argparse.Namespace) -> str:
    if (
        args.limit_usd is None
        or not math.isfinite(args.limit_usd)
        or args.limit_usd <= 0
    ):
        raise CatalogError(
            "OpenRouter key creation requires --limit-usd with a positive "
            "monthly spending cap."
        )
    keyring = prepare_key_storage(provider, args.overwrite)
    management_key = getpass.getpass(
        "OpenRouter management key (hidden; not saved): "
    ).strip()
    if not management_key:
        raise CatalogError("No management key entered; nothing was created.")
    body = {
        "name": requested_key_name(args, provider, 120),
        "limit": args.limit_usd,
        "limit_reset": "monthly",
    }
    result = api_request_json(
        OFFICIAL_ENDPOINTS["openrouter"] + "/keys",
        method="POST",
        headers={"Authorization": f"Bearer {management_key}"},
        payload=body,
        provider_name="OpenRouter",
    )
    store_created_key(keyring, provider, result.get("key"))
    return OFFICIAL_ENDPOINTS["openrouter"]


def google_access_token() -> str:
    creationflags = getattr(subprocess, "CREATE_NO_WINDOW", 0) if os.name == "nt" else 0
    try:
        result = subprocess.run(
            ["gcloud", "auth", "print-access-token"],
            capture_output=True,
            text=True,
            check=False,
            timeout=30,
            creationflags=creationflags,
        )
    except (OSError, subprocess.TimeoutExpired):
        raise CatalogError(
            "Could not run gcloud. Install the Google Cloud CLI, sign in with "
            "gcloud auth login, then retry."
        ) from None
    token = result.stdout.strip()
    if result.returncode != 0 or not token:
        raise CatalogError(
            "No gcloud access token is available. Run gcloud auth login and "
            "confirm your project permissions, then retry."
        )
    return token


def provision_google_gemini(provider: dict, args: argparse.Namespace) -> str:
    project = (args.project or "").strip()
    if not re.fullmatch(r"[a-z][a-z0-9-]{4,28}[a-z0-9]", project):
        raise CatalogError("Google Gemini provisioning needs a valid --project ID.")
    service_account = (args.service_account_email or "").strip()
    if not re.fullmatch(r"[^\s@]+@[^\s@]+\.iam\.gserviceaccount\.com", service_account):
        raise CatalogError(
            "Google Gemini provisioning needs --service-account-email for a "
            "Gemini authorization key. The service account must already exist."
        )
    keyring = prepare_key_storage(provider, args.overwrite)
    token = google_access_token()
    parent = f"projects/{quote(project, safe='')}/locations/global"
    headers = {"Authorization": f"Bearer {token}"}
    body = {
        "displayName": requested_key_name(args, provider, 63),
        "serviceAccountEmail": service_account,
        "restrictions": {
            "apiTargets": [{"service": "generativelanguage.googleapis.com"}]
        },
    }
    operation = api_request_json(
        f"https://apikeys.googleapis.com/v2/{parent}/keys",
        method="POST",
        headers=headers,
        payload=body,
        provider_name="Google API Keys",
    )
    operation_name = operation.get("name")
    if not isinstance(operation_name, str) or not operation_name.startswith("operations/"):
        raise CatalogError(
            "Google accepted the request but returned no operation ID. Check "
            "the Google Cloud project's API Keys page before retrying."
        )

    completed = None
    operation_url = (
        "https://apikeys.googleapis.com/v2/"
        + quote(operation_name, safe="/")
    )
    for _ in range(60):
        completed = api_request_json(
            operation_url,
            headers=headers,
            provider_name="Google API Keys",
        )
        if completed.get("done") is True:
            break
        time.sleep(1)
    if not completed or completed.get("done") is not True:
        raise CatalogError(
            "Google key creation is still running. Check the project in Google "
            "Cloud before retrying to avoid creating a duplicate."
        )
    if completed.get("error"):
        raise CatalogError(
            "Google could not create the key. Check the API Keys API, Gemini "
            "API, service account binding, and IAM permissions."
        )
    key_resource = completed.get("response")
    resource_name = key_resource.get("name") if isinstance(key_resource, dict) else None
    if not isinstance(resource_name, str) or not resource_name.startswith("projects/"):
        raise CatalogError(
            "Google created an operation without a key resource name. Check "
            "the Google Cloud project before retrying."
        )
    key_result = api_request_json(
        "https://apikeys.googleapis.com/v2/"
        + quote(resource_name, safe="/")
        + "/keyString",
        headers=headers,
        provider_name="Google API Keys",
    )
    store_created_key(keyring, provider, key_result.get("keyString"))
    return OFFICIAL_ENDPOINTS["googlegemini"]


def cloudflare_permission_group(
    account_id: str, token: str, target: str
) -> dict:
    query = urlencode({"name": target})
    result = api_request_json(
        f"https://api.cloudflare.com/client/v4/accounts/{account_id}/tokens/permission_groups?{query}",
        headers={"Authorization": f"Bearer {token}"},
        provider_name="Cloudflare",
    )
    if result.get("success") is not True:
        raise CatalogError("Cloudflare did not return the requested permission group.")
    groups = result.get("result")
    if not isinstance(groups, list):
        raise CatalogError("Cloudflare returned an unexpected permission-group list.")
    expected = normalize(target)
    matches = [
        group
        for group in groups
        if isinstance(group, dict)
        and normalize(str(group.get("name", ""))) == expected
        and group.get("is_selectable") is True
        and isinstance(group.get("scopes"), list)
        and "com.cloudflare.api.account" in group["scopes"]
    ]
    if len(matches) != 1 or not isinstance(matches[0].get("id"), str):
        raise CatalogError(
            f"Cloudflare did not expose a selectable {target} permission for "
            "this account. Check the account and bootstrap-token permissions."
        )
    return matches[0]


def provision_cloudflare(provider: dict, args: argparse.Namespace) -> str:
    account_id = (args.account_id or "").strip()
    if not re.fullmatch(r"[a-fA-F0-9]{32}", account_id):
        raise CatalogError(
            "Cloudflare Workers AI provisioning needs a 32-character --account-id."
        )
    keyring = prepare_key_storage(provider, args.overwrite)
    management_token = getpass.getpass(
        "Cloudflare bootstrap API token (hidden; not saved): "
    ).strip()
    if not management_token:
        raise CatalogError("No bootstrap token entered; nothing was created.")
    read_group = cloudflare_permission_group(
        account_id, management_token, "Workers AI - Read"
    )
    edit_group = cloudflare_permission_group(
        account_id, management_token, "Workers AI - Edit"
    )
    token_name = requested_key_name(args, provider, 120)
    body = {
        "name": token_name,
        "policies": [
            {
                "effect": "allow",
                "resources": {f"com.cloudflare.api.account.{account_id}": "*"},
                "permission_groups": [
                    {"id": read_group["id"]},
                    {"id": edit_group["id"]},
                ],
            }
        ],
    }
    if args.expires_on:
        try:
            expiry = datetime.fromisoformat(args.expires_on.replace("Z", "+00:00"))
        except ValueError:
            raise CatalogError(
                "--expires-on must be an ISO-8601 UTC timestamp, such as "
                "2030-01-01T00:00:00Z."
            ) from None
        if expiry.tzinfo is None or expiry <= datetime.now(timezone.utc):
            raise CatalogError("--expires-on must include UTC timezone and be in the future.")
        body["expires_on"] = expiry.astimezone(timezone.utc).isoformat().replace(
            "+00:00", "Z"
        )
    result = api_request_json(
        f"https://api.cloudflare.com/client/v4/accounts/{account_id}/tokens",
        method="POST",
        headers={"Authorization": f"Bearer {management_token}"},
        payload=body,
        provider_name="Cloudflare",
    )
    if result.get("success") is not True or not isinstance(result.get("result"), dict):
        raise CatalogError("Cloudflare did not confirm API token creation.")
    created = result["result"]
    store_created_key(keyring, provider, created.get("value"))
    return OFFICIAL_ENDPOINTS["cloudflareworkersai"].replace(
        "{account_id}", account_id
    )


def command_capabilities(_: argparse.Namespace) -> int:
    catalog = load_catalog()
    print(f"Upstream lastUpdated: {catalog.get('lastUpdated', 'unknown')}")
    for provider in catalog["providers"]:
        name = provider["name"]
        normalized_name = normalize(name)
        if normalized_name in PROVISIONING_INFO:
            status = "Tự tạo qua API chính thức; " + PROVISIONING_INFO[normalized_name]
        elif normalized_name in NO_KEY_PROVIDERS:
            status = "Catalog ghi không cần API key cho luồng free hiện tại."
        else:
            status = (
                "Chưa có adapter provisioning được xác minh trong repo; tạo key "
                "trên trang provider rồi lưu bằng save-key."
            )
        print(f"- {name}: {status}")
    return 0


def command_provision(args: argparse.Namespace) -> int:
    provider = find_provider(load_catalog(), args.provider)
    normalized_name = normalize(provider["name"])
    if normalized_name == "openrouter":
        endpoint = provision_openrouter(provider, args)
    elif normalized_name == "googlegemini":
        endpoint = provision_google_gemini(provider, args)
    elif normalized_name == "cloudflareworkersai":
        endpoint = provision_cloudflare(provider, args)
    else:
        if normalized_name in NO_KEY_PROVIDERS:
            raise CatalogError(
                f"{provider['name']} is listed as not requiring a key for its free path."
            )
        raise CatalogError(
            f"No official provisioning adapter is enabled for {provider['name']}. "
            "Use guide to open the provider's setup page and save-key after "
            "creating a key there."
        )
    print(f"Created and saved a credential for {provider['name']}.")
    print("Credential value was not displayed; it is in Windows Credential Locker.")
    print(f"Endpoint: {endpoint}")
    return 0


def windows_keyring():
    if os.name != "nt":
        raise CatalogError("Key storage is currently supported on Windows only.")
    try:
        import keyring
    except ImportError as exc:
        raise CatalogError("Install dependencies: python -m pip install -r requirements.txt") from exc
    backend = keyring.get_keyring()
    if (
        backend.__class__.__name__ != "WinVaultKeyring"
        or not backend.__class__.__module__.casefold().startswith(
            "keyring.backends.windows"
        )
    ):
        raise CatalogError(
            "Refusing to store a key: keyring did not select Windows Credential Locker "
            f"(selected {backend.__class__.__name__})."
        )
    return keyring


def command_sync(_: argparse.Namespace) -> int:
    catalog = fetch_catalog()
    write_cache(catalog)
    print(
        f"Cached {len(catalog['providers'])} providers "
        f"(upstream lastUpdated: {catalog.get('lastUpdated', 'unknown')})."
    )
    return 0


def command_list(args: argparse.Namespace) -> int:
    catalog = load_catalog()
    providers = catalog["providers"]
    if args.category:
        providers = [p for p in providers if p.get("category") == args.category]
    print(f"Upstream lastUpdated: {catalog.get('lastUpdated', 'unknown')}")
    for provider in providers:
        print_provider(provider)
        print()
    return 0


def command_guide(args: argparse.Namespace) -> int:
    provider = find_provider(load_catalog(), args.provider)
    print_provider(provider)
    normalized_name = normalize(provider["name"])
    if normalized_name in PROVISIONING_INFO:
        print("Provisioning: supported by an official provider API.")
        print(
            f"  python provider_helper.py provision \"{provider['name']}\" "
            "[provider-specific options]"
        )
        print(f"  Requirements: {PROVISIONING_INFO[normalized_name]}.")
    elif normalized_name in NO_KEY_PROVIDERS:
        print("This catalog entry says a key is not required for its free path.")
    else:
        print("Provisioning: no verified adapter in this repo; use the provider UI.")
        print("Next steps:")
        print("  1. Sign in yourself on the verified official provider page.")
        print("  2. Create a key with only the required permissions.")
        print(
            f"  3. Store it locally: python provider_helper.py save-key "
            f"\"{provider['name']}\""
        )
    print("Credentials are not collected from Gmail or browser sessions.")
    return 0


def command_save_key(args: argparse.Namespace) -> int:
    provider = find_provider(load_catalog(), args.provider)
    keyring = windows_keyring()
    secret = getpass.getpass(f"Paste {provider['name']} API key (hidden input): ").strip()
    if not secret:
        raise CatalogError("Empty key; nothing was saved.")
    keyring.set_password(SERVICE_NAME, credential_id(provider), secret)
    print(f"Saved credential for {provider['name']} to Windows Credential Locker.")
    return 0


def command_key_status(args: argparse.Namespace) -> int:
    provider = find_provider(load_catalog(), args.provider)
    keyring = windows_keyring()
    exists = keyring.get_password(SERVICE_NAME, credential_id(provider)) is not None
    state = "saved" if exists else "not saved"
    print(f"{provider['name']}: {state} (key value was not displayed).")
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Find public LLM endpoints and guide user-controlled key setup."
    )
    subparsers = parser.add_subparsers(dest="command", required=True)

    sync = subparsers.add_parser("sync", help="download and cache the public provider catalog")
    sync.set_defaults(handler=command_sync)

    listing = subparsers.add_parser("list", help="show providers, endpoints, and setup links")
    listing.add_argument("--category", choices=("provider_api", "inference_provider"))
    listing.set_defaults(handler=command_list)

    capabilities = subparsers.add_parser(
        "capabilities", help="show which providers have verified automatic key provisioning"
    )
    capabilities.set_defaults(handler=command_capabilities)

    guide = subparsers.add_parser("guide", help="show setup guidance for one provider")
    guide.add_argument("provider")
    guide.set_defaults(handler=command_guide)

    provision = subparsers.add_parser(
        "provision", help="create and save a key through a supported official provider API"
    )
    provision.add_argument("provider")
    provision.add_argument("--name", help="human-readable name for the provider key")
    provision.add_argument("--project", help="Google Cloud project ID for Gemini")
    provision.add_argument(
        "--service-account-email",
        help="existing Google service account to bind to a Gemini authorization key",
    )
    provision.add_argument("--account-id", help="Cloudflare account ID")
    provision.add_argument(
        "--expires-on",
        help="Cloudflare token expiry in ISO-8601 UTC (optional)",
    )
    provision.add_argument(
        "--limit-usd",
        type=float,
        help="required positive monthly spend cap for an OpenRouter key",
    )
    provision.add_argument(
        "--overwrite",
        action="store_true",
        help="replace a locally saved key; the old provider key is not revoked",
    )
    provision.set_defaults(handler=command_provision)

    save = subparsers.add_parser("save-key", help="securely save a user-created key")
    save.add_argument("provider")
    save.set_defaults(handler=command_save_key)

    status = subparsers.add_parser("key-status", help="check whether a key is saved")
    status.add_argument("provider")
    status.set_defaults(handler=command_key_status)
    return parser


def main() -> int:
    args = build_parser().parse_args()
    try:
        return args.handler(args)
    except CatalogError as exc:
        print(f"Error: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
