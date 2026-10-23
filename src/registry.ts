import { listUserProviders } from "./user-providers";

export type QuotaRecord = {
  summary: string;
  scope: string;
  reset: string;
  models?: string[];
  notes?: string[];
};

export type ProviderRecord = {
  id: string;
  name: string;
  category: "hosted-inference" | "router";
  endpoint: string;
  keyUrl: string;
  quotaUrl: string;
  quota: QuotaRecord;
  sourceUrl: string;
  verifiedAt: string;
  provisioner?: "gemini" | "cloudflare" | "openrouter";
  endpointNeedsAccountId?: boolean;
  catalogSource?: "official" | "upstream";
  addedAt?: string;
};

// Built-in registry entries are curated from official provider pages. Upstream
// entries are added separately after an explicit user action.
export const PROVIDERS: ProviderRecord[] = [
  {
    id: "gemini",
    name: "Google Gemini API",
    category: "hosted-inference",
    endpoint: "https://generativelanguage.googleapis.com/v1beta",
    keyUrl: "https://aistudio.google.com/apikey",
    quotaUrl: "https://aistudio.google.com/",
    quota: {
      summary: "Free tier: free input and output tokens for selected models.",
      scope: "Limits vary by model, Google Cloud project, and account tier. Active RPM, TPM, and RPD appear in AI Studio.",
      reset: "Requests per day reset at midnight Pacific time; other dimensions use their stated windows.",
      notes: ["Google says published rate limits are not guaranteed and can change with account status."]
    },
    sourceUrl: "https://ai.google.dev/gemini-api/docs/rate-limits",
    verifiedAt: "2026-10-23",
    provisioner: "gemini",
    catalogSource: "official"
  },
  {
    id: "cloudflare-workers-ai",
    name: "Cloudflare Workers AI",
    category: "hosted-inference",
    endpoint: "https://api.cloudflare.com/client/v4/accounts/{account_id}/ai/run/{model}",
    keyUrl: "https://dash.cloudflare.com/",
    quotaUrl: "https://dash.cloudflare.com/",
    quota: {
      summary: "Workers Free includes 10,000 Neurons per day at no charge.",
      scope: "Shared daily allocation across Workers AI models available on Workers Free. Some newer models require Workers Paid.",
      reset: "Daily at 00:00 UTC.",
      models: ["@cf/zai-org/glm-4.7-flash", "@cf/google/gemma-4-26b-a4b-it", "@cf/nvidia/nemotron-3-120b-a12b"],
      notes: ["Do not select models marked as requiring Workers Paid if you want to stay on the free plan."]
    },
    sourceUrl: "https://developers.cloudflare.com/workers-ai/platform/pricing/",
    verifiedAt: "2026-10-23",
    provisioner: "cloudflare",
    endpointNeedsAccountId: true,
    catalogSource: "official"
  },
  {
    id: "groq",
    name: "GroqCloud",
    category: "hosted-inference",
    endpoint: "https://api.groq.com/openai/v1",
    keyUrl: "https://console.groq.com/keys",
    quotaUrl: "https://console.groq.com/settings/limits",
    quota: {
      summary: "Published Free Plan example: openai/gpt-oss-120b allows 30 RPM, 1,000 RPD, 8,000 TPM, and 200,000 TPD.",
      scope: "RPM, RPD, TPM, and other limits vary by model and organization; check the current Free Plan Limits table and account Limits page.",
      reset: "Provider-defined per-minute and per-day windows; exact values are account/model specific.",
      models: ["openai/gpt-oss-120b: 30 RPM · 1K RPD · 8K TPM · 200K TPD", "meta-llama/llama-prompt-guard-2-22m: 30 RPM · 14.4K RPD · 15K TPM · 500K TPD"],
      notes: ["The documentation describes its public table as a high-level summary; the account Limits page is authoritative for the current organization."]
    },
    sourceUrl: "https://console.groq.com/docs/rate-limits",
    verifiedAt: "2026-10-23",
    catalogSource: "official"
  },
  {
    id: "mistral",
    name: "Mistral AI Studio",
    category: "hosted-inference",
    endpoint: "https://api.mistral.ai/v1",
    keyUrl: "https://console.mistral.ai/",
    quotaUrl: "https://docs.mistral.ai/admin/billing-usage/usage-limits",
    quota: {
      summary: "Studio Free mode includes monthly usage at no charge within the plan limits.",
      scope: "Included monthly usage and rate limits are organization-, workspace-, and model-specific; the Limits page in Studio is authoritative.",
      reset: "Monthly included usage; request and token rate windows vary by model.",
      notes: ["Pay-as-you-go extends usage beyond included free usage and can incur charges."]
    },
    sourceUrl: "https://docs.mistral.ai/admin/billing-usage/usage-limits",
    verifiedAt: "2026-10-23",
    catalogSource: "official"
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    category: "router",
    endpoint: "https://openrouter.ai/api/v1",
    keyUrl: "https://openrouter.ai/settings/keys",
    quotaUrl: "https://openrouter.ai/pricing",
    quota: {
      summary: "Free plan includes 50 requests per day for free-model access.",
      scope: "Applies to free-plan requests. Free model availability and per-model provider capacity can change.",
      reset: "Daily; per-minute and provider/model limits may also apply.",
      notes: ["Using paid models can incur charges. Do not add credits or select paid models if you intend to use only the free plan."]
    },
    sourceUrl: "https://openrouter.ai/pricing/",
    verifiedAt: "2026-10-23",
    provisioner: "openrouter",
    catalogSource: "official"
  }
];

export function getProvider(id: string): ProviderRecord | undefined {
  return PROVIDERS.find((provider) => provider.id === id)
    ?? listUserProviders().find((provider) => provider.id === id);
}

export function listProviders(): ProviderRecord[] {
  return [...PROVIDERS, ...listUserProviders()].map((provider) => ({
    ...provider,
    quota: { ...provider.quota, models: provider.quota.models ? [...provider.quota.models] : undefined, notes: provider.quota.notes ? [...provider.quota.notes] : undefined }
  }));
}

export function resolveEndpoint(provider: ProviderRecord, accountId?: string): string {
  if (!provider.endpointNeedsAccountId) return provider.endpoint;
  if (!accountId || !/^[a-fA-F0-9]{32}$/.test(accountId)) return provider.endpoint;
  return provider.endpoint.replace("{account_id}", accountId);
}
