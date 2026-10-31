/**
 * pi's providers that get no package, each with why. The first seven are the product's `LEFT_OUT` (`src/shared/model-makers-generate.ts`),
 * which the proxy cannot carry, `typesafe` among them only because its package is written by hand: it holds Jev's client.
 */
export const NOT_GENERATED = Object.freeze({
  "amazon-bedrock": "SigV4-signed requests across two regional hosts",
  azure: "the endpoint is the tenant's own Azure resource",
  "cloudflare-ai-gateway": "the base URL is templated with the tenant's account and gateway",
  "cloudflare-workers-ai": "the base URL is templated with the tenant's account",
  "google-vertex": "application-default credentials and a location-templated host",
  "openai-codex": "a subscription login, not an API key",
  typesafe: "written by hand in packages/typesafe",
  radius: "its models are the organisation's, from the gateway per sign-in, which a package cannot write: it stays in the image",
});

/** What the image's block says of a vendor that pi's list does not. */
export const SAID = Object.freeze({
  openai: { compat: Object.fromEntries(["gpt-6-astra", "gpt-6-luna", "gpt-6-sol", "gpt-6.1-sol"].map(id => [id, { supportsMidConvoEffort: false }])) },
  openrouter: { comchatx: { aggregator: true } },
});
