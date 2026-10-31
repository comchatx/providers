import type { AnyModel, ModelType } from "@earendil-works/pi-ai";
import { getAllBuiltinModels, type BuiltinProvider } from "@earendil-works/pi-ai/providers/all";
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
  /** What the box says of a chat model that pi's list does not, by model id. */
  readonly compat?: Readonly<Record<string, Readonly<Record<string, unknown>>>>;
};

const OPERATIONS: readonly ModelType[] = ["chat", "image", "classifier"];

/**
 * Points `provider` at the box's proxy and takes it away when the session goes: pi keeps a registration through a reload, even one whose
 * package is now off or removed. Only the origin changes, so each model keeps pi's own path. pi's list stays pi's: only a vendor whose models
 * sit on more than one path, or that `compat` touches, registers a list, since pi then takes that list for the vendor's whole catalogue, every
 * operation. Handing one at load would take from pi what the settings add before it picks its starting model, so at load the vendor gets its
 * origin and placeholder alone, and the list comes at the session's start, from what the registry answers. Until then such a vendor's models all
 * carry its first path, and `compat` is unsaid; pi sends no request in that window, though an extension's own earlier `session_start` handler could.
 */
export function redirect(pi: ExtensionAPI, provider: string, options: RedirectOptions = {}): void {
  const origin = options.origin ?? BOX_ORIGIN;
  const at = `${origin}/providers/own/${provider}`;
  const here = (base: string): string => `${at}${new URL(base).pathname.replace(/\/$/, "")}`;
  const moved = (known: readonly AnyModel[]) => known.map(model => {
    const compat = model.type === "image" || model.type === "classifier" ? undefined : options.compat?.[model.id];
    return { ...model, baseUrl: here(model.baseUrl), ...(compat === undefined ? {} : { compat: { ...(model as { readonly compat?: object }).compat, ...compat } }) };
  });
  const listed = moved(options.route === undefined ? getAllBuiltinModels(provider as BuiltinProvider) : []);
  const baseUrl = options.route !== undefined ? `${origin}${options.route}` : listed[0]?.baseUrl ?? at;
  const whole = new Set(listed.map(model => model.baseUrl)).size > 1 || options.compat !== undefined;
  const register = (models?: readonly AnyModel[]): void => pi.registerProvider(provider, { baseUrl, apiKey: PLACEHOLDER_KEY, ...(models === undefined ? {} : { models: models as never }) });
  register();
  if (whole) pi.on("session_start", (_event, ctx) => {
    // The registry answers with this package's list until it is gone, and that list's origin is already the box's.
    pi.unregisterProvider(provider);
    register(moved(OPERATIONS.flatMap(type => ctx.modelRegistry.getModelsOfType(type, provider) as readonly AnyModel[])));
  });
  pi.on("session_shutdown", () => { pi.unregisterProvider(provider); });
}
