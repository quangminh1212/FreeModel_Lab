#!/usr/bin/env python3
"""Read public provider metadata and guide user-controlled API key setup."""

from __future__ import annotations

import argparse
import getpass
import json
import os
import re
import sys
from pathlib import Path
from urllib.error import URLError
from urllib.parse import urlparse
from urllib.request import Request, urlopen

SOURCE_URL = (
    "https://raw.githubusercontent.com/mnfst/awesome-free-llm-apis/"
    "main/data.json"
)
SERVICE_NAME = "FreeModel_Lab"
MAX_CATALOG_BYTES = 4 * 1024 * 1024
CACHE_PATH = Path(__file__).resolve().parent / ".cache" / "providers.json"


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
    parsed = urlparse(value)
    return value if parsed.scheme == "https" and parsed.netloc else None


def print_provider(provider: dict) -> None:
    setup_url = https_url(provider.get("url"))
    endpoint = provider.get("baseUrl")
    print(f"Provider: {provider['name']}")
    print(f"Category: {provider.get('category', 'unknown')}")
    print(f"Endpoint: {endpoint if isinstance(endpoint, str) else 'not listed'}")
    print(f"Key/setup page: {setup_url or 'not listed; verify official docs'}")
    description = provider.get("description")
    if isinstance(description, str) and description.strip():
        print(f"Catalog note: {description.strip()}")
    models = provider.get("models")
    if isinstance(models, list) and models:
        print("Models and listed limits:")
        for model in models:
            if isinstance(model, dict):
                name = model.get("name") or model.get("id") or "unnamed"
                limit = model.get("rateLimit") or "not listed"
                print(f"  - {name}: {limit}")
    print("Verify current terms, quota, data use, and domain before creating a key.")


def windows_keyring():
    if os.name != "nt":
        raise CatalogError("Key storage is currently supported on Windows only.")
    try:
        import keyring
    except ImportError as exc:
        raise CatalogError("Install dependencies: python -m pip install -r requirements.txt") from exc
    backend = keyring.get_keyring()
    if "windows" not in backend.__class__.__module__.casefold():
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
    print("Next steps:")
    print("  1. Sign in yourself on the verified official provider page.")
    print("  2. Create a key with only the required permissions.")
    print(f"  3. Store it locally: python provider_helper.py save-key \"{provider['name']}\"")
    print("The key is not collected from Gmail or the browser session.")
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

    guide = subparsers.add_parser("guide", help="show setup guidance for one provider")
    guide.add_argument("provider")
    guide.set_defaults(handler=command_guide)

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
