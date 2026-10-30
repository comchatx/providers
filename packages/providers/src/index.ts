import { getBuiltinModels, type BuiltinProvider } from "@earendil-works/pi-ai/providers/all";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

/** The box's one loopback listener, where the proxy's routes are reached. */
export const BOX_ORIGIN = "http://127.0.0.1:8081";
/** What the box sends in a key's place: keys never enter the box, and the proxy puts the payer's in. */
export const PLACEHOLDER_KEY = "cmx-placeholder-key";

export type RedirectOptions = {
  /** The listener's address, for a witness that stands one in. */
  readonly origin?: string;
  /** A route of its own in place of the path pi gives the vendor: one with no chat models to read a path from. */
  readonly route?: string;
  /** What the box says of a model that pi's list does not, by model id. */
  readonly compat?: Readonly<Record<string, Readonly<Record<string, unknown>>>>;
};

/**
 * Points `provider` at the box's proxy and takes it away when the session goes: pi keeps a registration through a reload, even one whose
 * package is now off or removed. Only the origin changes, so each model keeps pi's own path. pi's list stays pi's: only a vendor whose models
 * sit on more than one path, or that `compat` touches, registers a list, and that list is the running pi's own.
 */
export function redirect(pi: ExtensionAPI, provider: string, options: RedirectOptions = {}): void {
  const origin = options.origin ?? BOX_ORIGIN;
  const at = `${origin}/providers/own/${provider}`;
  const here = (base: string): string => `${at}${new URL(base).pathname.replace(/\/$/, "")}`;
  const listed = options.route === undefined ? getBuiltinModels(provider as BuiltinProvider) : [];
  const models = listed.map(model => {
    const compat = options.compat?.[model.id];
    return { ...model, baseUrl: here(model.baseUrl), ...(compat === undefined ? {} : { compat: { ...(model.compat as object | undefined), ...compat } }) };
  });
  const baseUrl = options.route !== undefined ? `${origin}${options.route}` : models[0]?.baseUrl ?? at;
  const whole = new Set(models.map(model => model.baseUrl)).size > 1 || options.compat !== undefined;
  pi.registerProvider(provider, { baseUrl, apiKey: PLACEHOLDER_KEY, ...(whole ? { models: models as never } : {}) });
  pi.on("session_shutdown", () => { pi.unregisterProvider(provider); });
}
