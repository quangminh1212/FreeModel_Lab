# Contributing

Thanks for helping improve FreeModel Lab. Contributions should preserve the
project's local-first credential boundary and make provider information easy to
verify.

## Development setup

- Use Node.js 24 or newer and npm.
- Run `npm ci` to install the locked dependencies and build the TypeScript
  sources.
- Run `npm run build` before opening a pull request.
- Keep changes focused and describe user-visible behavior, security impact, and
  any platform limitations in the pull request.

## Provider catalog changes

- Prefer primary provider documentation for endpoints, quotas, key creation, and
  permissions. Include the source URL and the date the information was checked.
- Distinguish recurring free-tier usage from trial credits, promotions, and
  paid usage. Do not label a provider free when the evidence only supports a
  temporary trial.
- Treat account-specific limits as account-specific. Do not imply that a
  published limit guarantees availability or uptime.
- Keep imported upstream entries clearly marked as unverified until independently
  checked against the provider's own documentation.

## Security and privacy

- Never commit API keys, bootstrap tokens, cookies, account passwords, or user
  data. Use synthetic values in examples.
- Do not add browser-session extraction, account automation, quota evasion, or
  credential collection.
- Keep secret values out of logs, error messages, screenshots, and test output.
- Keep provider requests on documented HTTPS endpoints and avoid automatic
  retries for operations that may create or rotate credentials.

## Pull request checklist

- Explain the problem and the intended user outcome.
- Link primary sources when provider behavior or quota data changes.
- Include the Node.js version and operating systems you used for manual checks.
- Do not claim a security, accessibility, or standards certification unless an
  independent assessment has established it.
