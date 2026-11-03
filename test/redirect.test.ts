import { afterEach, expect, it, vi } from "vitest";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { getBuiltinModels } from "@earendil-works/pi-ai/providers/all";
import { SAID as said } from "../scripts/vendors.mjs";
import { fixture, type Known, type Model, PACKAGES, session, standIn } from "./session.js";

const cleanups: (() => unknown)[] = [];
afterEach(async () => { for (const cleanup of cleanups.splice(0).reverse()) await cleanup(); });
const open = async (...args: Parameters<typeof session>) => { const one = await session(...args); cleanups.push(one.close); return one; };
const listener = async () => { const one = await standIn({}); cleanups.push(one.close); return one; };
const routed = (origin: string, provider: string, extra: Readonly<Record<string, string>> = {}) => ({ STAND_IN: origin, ROUTED_PROVIDER: provider, ...extra });

it("offers no vendor to a pi with no package and no key", async () => {
  const pi = await open({ packages: [] });
  expect(await pi.models()).toEqual([]);
});

it("brings each generated package's vendor to the box's listener, with pi's own models", async () => {
  const written = readdirSync(PACKAGES).filter(name => name !== "providers" && name !== "typesafe");
  const pi = await open({ packages: written.map(name => join(PACKAGES, name)) });
  const offered = await pi.models();
  expect([...new Set(offered.map(model => model.provider))].sort()).toEqual([...written].sort());
  for (const model of offered) expect(model.baseUrl.startsWith(`http://127.0.0.1:8081/providers/own/${model.provider}`), `${model.provider}/${model.id}: ${model.baseUrl}`).toBe(true);
  for (const name of written) expect((await pi.models(name)).map(model => model.id).sort(), name).toEqual(getBuiltinModels(name as never).map(model => model.id).sort());
}, 120_000);

it("sends a vendor's call to its route with the placeholder, and keeps its models' own list", async () => {
  const at = await listener();
  const pi = await open({ packages: [fixture("routed")], env: routed(at.origin, "anthropic") });
  const models = await pi.models("anthropic");
  expect(new Set(models.map(model => model.baseUrl))).toEqual(new Set([`${at.origin}/providers/own/anthropic`]));
  await pi.say("anthropic", models[0]!.id);
  expect(at.hits.map(({ url, key }) => [url, key])).toEqual([["/providers/own/anthropic/v1/messages?beta=true", "cmx-placeholder-key"]]);
}, 60_000);

it.each(["openrouter", "fireworks", "opencode", "opencode-go"])("keeps each of %s's models on its own path", async (provider) => {
  const at = await listener();
  const pi = await open({ packages: [fixture("routed")], env: routed(at.origin, provider) });
  const path = (base: string): string => new URL(base).pathname;
  const expected = getBuiltinModels(provider as never).map(model => [model.id, model.api, `/providers/own/${provider}${path(model.baseUrl).replace(/\/$/, "")}`].join(" ")).sort();
  expect(new Set(expected.map(line => line.split(" ")[2])).size).toBeGreaterThan(1);
  expect((await pi.models(provider)).map(model => [model.id, model.api, path(model.baseUrl)].join(" ")).sort()).toEqual(expected);
}, 60_000);

it("calls an OpenRouter model of either path where its own path says", async () => {
  const at = await listener();
  const pi = await open({ packages: [fixture("routed")], env: routed(at.origin, "openrouter") });
  const models = await pi.models("openrouter");
  await pi.say("openrouter", models.find(model => model.api === "anthropic-messages")!.id);
  await pi.say("openrouter", models.find(model => model.api === "openai-completions")!.id);
  expect(at.hits.map(hit => hit.url)).toEqual(["/providers/own/openrouter/api/v1/messages?beta=true", "/providers/own/openrouter/api/v1/chat/completions"]);
}, 60_000);

it("takes the vendor away at the reload that follows its package going off or out, and brings it back when on again", async () => {
  const at = await listener();
  const off = { source: fixture("routed"), extensions: [] };
  const pi = await open({ packages: [fixture("reload"), fixture("routed")], env: routed(at.origin, "anthropic") });
  expect(await pi.models("anthropic")).not.toEqual([]);
  // pi answers the reload's command before the reload is over.
  const settled = (check: (offered: readonly unknown[]) => void) => vi.waitFor(async () => { check(await pi.models("anthropic")); }, { timeout: 20_000, interval: 100 });
  await pi.reload([fixture("reload"), off]);
  await settled(offered => expect(offered).toEqual([]));
  await pi.reload([fixture("reload"), fixture("routed")]);
  await settled(offered => expect(offered).not.toEqual([]));
  await pi.reload([fixture("reload")]);
  await settled(offered => expect(offered).toEqual([]));
}, 60_000);

it("says of a model what the box says beside what pi says, and of no other", async () => {
  const at = await listener();
  const compat = { "gpt-6-sol": { supportsMidConvoEffort: false } };
  const pi = await open({ packages: [fixture("routed")], env: routed(at.origin, "openai", { ROUTED_COMPAT: JSON.stringify(compat) }) });
  const models = await pi.models("openai");
  const given = getBuiltinModels("openai").find(model => model.id === "gpt-6-sol")!;
  expect(models.find(model => model.id === "gpt-6-sol")!.compat).toEqual({ ...(given.compat as object | undefined), supportsMidConvoEffort: false });
  expect(models).toHaveLength(getBuiltinModels("openai").length);
  expect(models.filter(model => model.compat?.["supportsMidConvoEffort"] === false).map(model => model.id)).toEqual(["gpt-6-sol"]);
}, 60_000);

const SAID = said as Readonly<Record<string, { readonly compat?: Readonly<Record<string, Readonly<Record<string, unknown>>>> }>>;
const VENDORS = ["openrouter", "opencode", "openai"] as const;
const ids = (models: readonly Model[]): readonly string[] => models.map(model => model.id).sort();
const counts = (known: Known) => ({ chat: known.chat.length, image: known.image.length, classifier: known.classifier.length });
const plain = async (provider: string): Promise<Known> => (await open({ packages: [fixture("catalogue")] })).known(provider);

it.each(VENDORS)("keeps every model of every operation of %s, before the package, with it, off and on again", async (provider) => {
  const before = await plain(provider);
  expect(before.image.length + before.classifier.length).toBeGreaterThan(0);
  const at = await listener();
  const base = [fixture("catalogue"), fixture("reload")];
  const pi = await open({ packages: [...base, fixture("routed")], env: routed(at.origin, provider, provider === "openai" ? { ROUTED_COMPAT: JSON.stringify({ "gpt-6-luna": { supportsMidConvoEffort: false } }) } : {}) });
  const same = (known: Known): void => { for (const type of ["chat", "image", "classifier"] as const) expect(ids(known[type]), type).toEqual(ids(before[type])); };
  const after = await pi.known(provider);
  same(after);
  for (const type of ["chat", "image", "classifier"] as const) for (const model of after[type]) expect(model.baseUrl.startsWith(`${at.origin}/providers/own/${provider}/`), `${type} ${model.id}: ${model.baseUrl}`).toBe(true);
  const off = { source: fixture("routed"), extensions: [] };
  await pi.reload([...base, off]);
  await vi.waitFor(async () => { expect((await pi.known(provider)).chat.every(model => !model.baseUrl.startsWith(at.origin))).toBe(true); }, { timeout: 20_000, interval: 100 });
  const offAgain = await pi.known(provider);
  same(offAgain);
  expect(offAgain).toEqual(before);
  await pi.reload([...base, fixture("routed")]);
  await vi.waitFor(async () => { expect((await pi.known(provider)).chat.every(model => model.baseUrl.startsWith(at.origin))).toBe(true); }, { timeout: 20_000, interval: 100 });
  same(await pi.known(provider));
}, 90_000);

it("loses nothing through the generated packages themselves", async () => {
  const vendors = [...VENDORS, "vercel-ai-gateway"];
  const before = await Promise.all(vendors.map(plain));
  const pi = await open({ packages: [fixture("catalogue"), ...vendors.map(name => join(PACKAGES, name))] });
  for (const [at, provider] of vendors.entries()) expect(counts(await pi.known(provider)), provider).toEqual(counts(before[at]!));
}, 60_000);

it("is pi's catalogue for all 34 vendors, every field, with the origin and the box's four compat lines the only differences", async () => {
  const written = readdirSync(PACKAGES).filter(name => name !== "providers" && name !== "typesafe");
  const baseline = await open({ packages: [fixture("catalogue")] });
  const pi = await open({ packages: [fixture("catalogue"), ...written.map(name => join(PACKAGES, name))] });
  for (const provider of written) {
    const before = await baseline.known(provider);
    const after = await pi.known(provider);
    for (const type of ["chat", "image", "classifier"] as const) {
      const moved = before[type].map(model => {
        const said = type === "chat" ? SAID[provider]?.compat?.[model.id] : undefined;
        return { ...model, baseUrl: `http://127.0.0.1:8081/providers/own/${provider}${new URL(model.baseUrl).pathname.replace(/\/$/, "")}`, ...(said === undefined ? {} : { compat: { ...model.compat, ...said } }) };
      });
      expect(after[type], `${provider} ${type}`).toEqual(moved);
    }
  }
}, 120_000);

it("holds OpenAI's classifier by name, and says the box's compat of the chat model that shares its id alone", async () => {
  const at = await listener();
  const compat = { "gpt-6-luna": { supportsMidConvoEffort: false } };
  const pi = await open({ packages: [fixture("catalogue"), fixture("routed")], env: routed(at.origin, "openai", { ROUTED_COMPAT: JSON.stringify(compat) }) });
  const known = await pi.known("openai");
  expect(known.classifier.map(model => model.id)).toEqual(["gpt-6-luna"]);
  expect(known.classifier[0]!.compat?.["supportsMidConvoEffort"]).toBeUndefined();
  expect(known.chat.find(model => model.id === "gpt-6-luna")!.compat?.["supportsMidConvoEffort"]).toBe(false);
});

it("changes only the origin of every model of every operation, each on its own path", async () => {
  for (const provider of [...VENDORS, "vercel-ai-gateway"]) {
    const before = await plain(provider);
    const at = await listener();
    const pi = await open({ packages: [fixture("catalogue"), fixture("routed")], env: routed(at.origin, provider) });
    const after = await pi.known(provider);
    for (const type of ["chat", "image", "classifier"] as const) {
      const moved = before[type].map(model => ({ ...model, baseUrl: `${at.origin}/providers/own/${provider}${new URL(model.baseUrl).pathname.replace(/\/$/, "")}` }));
      expect(after[type], `${provider} ${type}`).toEqual(moved);
    }
  }
}, 120_000);

it("calls an image and a classifier model at the box, on the placeholder, by the path pi gives each", async () => {
  const at = await listener();
  const pi = await open({ packages: [fixture("catalogue"), fixture("routed")], env: routed(at.origin, "openrouter") });
  const known = await pi.known("openrouter");
  await pi.operate("image", "openrouter", known.image[0]!.id);
  await pi.operate("classifier", "openrouter", known.classifier[0]!.id);
  expect(at.hits.length).toBeGreaterThanOrEqual(2);
  for (const hit of at.hits) {
    expect(hit.url.startsWith("/providers/own/openrouter/api/v1/"), hit.url).toBe(true);
    expect(hit.key).toContain("cmx-placeholder-key");
  }
}, 60_000);

it("keeps what the settings add to a vendor the package registers a list for", async () => {
  const at = await listener();
  const modelsJson = { providers: { openrouter: { models: [{ id: "mine/own", api: "openai-completions", baseUrl: "https://openrouter.ai/api/v1" }] } } };
  const pi = await open({ packages: [fixture("catalogue"), fixture("routed")], env: routed(at.origin, "openrouter"), modelsJson });
  const known = await pi.known("openrouter");
  expect(known.chat.find(model => model.id === "mine/own")!.baseUrl).toBe(`${at.origin}/providers/own/openrouter/api/v1`);
  expect(known.image.length).toBeGreaterThan(0);
}, 60_000);

const CUSTOM = { providers: { openrouter: { apiKey: "cmx-placeholder-key", models: [{ id: "review/custom", name: "Custom", api: "openai-completions", baseUrl: "https://openrouter.ai/custom/v9", contextWindow: 1234, maxTokens: 321 }] } } };
const SAVED = { defaultProvider: "openrouter", defaultModel: "review/custom" };

it("stays on a saved model the settings add, with and without the package", async () => {
  const control = await open({ packages: [fixture("catalogue")], env: { EARLY_PROVIDER: "openrouter" }, modelsJson: CUSTOM, settings: SAVED });
  const given = ((await control.ask({ type: "get_state" })).data as { model: Model }).model;
  expect(given.id).toBe("review/custom");
  const at = await listener();
  const pi = await open({ packages: [fixture("catalogue"), fixture("routed")], env: routed(at.origin, "openrouter", { EARLY_PROVIDER: "openrouter" }), modelsJson: CUSTOM, settings: SAVED });
  const state = ((await pi.ask({ type: "get_state" })).data as { model: Model }).model;
  expect(state).toEqual({ ...given, baseUrl: `${at.origin}/providers/own/openrouter/custom/v9` });
}, 60_000);

it("stays on a saved model the settings add when they give no key, on the package's placeholder", async () => {
  const at = await listener();
  const { apiKey: _none, ...provider } = CUSTOM.providers.openrouter;
  const pi = await open({ packages: [fixture("routed")], env: routed(at.origin, "openrouter"), modelsJson: { providers: { openrouter: provider } }, settings: SAVED });
  const state = ((await pi.ask({ type: "get_state" })).data as { model: Model }).model;
  expect([state.id, state.baseUrl]).toEqual(["review/custom", `${at.origin}/providers/own/openrouter/custom/v9`]);
}, 60_000);

it("shows an earlier extension pi's full catalogue and the saved model at the session's start", async () => {
  const before = await open({ packages: [fixture("catalogue")], env: { EARLY_PROVIDER: "openrouter" }, modelsJson: CUSTOM, settings: SAVED });
  await before.ask({ type: "get_state" });
  const at = await listener();
  const pi = await open({ packages: [fixture("catalogue"), fixture("routed")], env: routed(at.origin, "openrouter", { EARLY_PROVIDER: "openrouter" }), modelsJson: CUSTOM, settings: SAVED });
  await pi.ask({ type: "get_state" });
  const [control, seen] = [before.early(), pi.early()];
  expect(seen.selected).toBe("review/custom");
  for (const type of ["chat", "image", "classifier"] as const) expect(ids(seen[type]), type).toEqual(ids(control[type]));
  expect(seen.chat.map(model => model.id)).toContain("review/custom");
}, 60_000);

it("has the box's compat on a saved model once the session has started", async () => {
  const at = await listener();
  const pi = await open({ packages: [fixture("routed")], env: routed(at.origin, "openai", { ROUTED_COMPAT: JSON.stringify({ "gpt-6-sol": { supportsMidConvoEffort: false } }) }), settings: { defaultProvider: "openai", defaultModel: "gpt-6-sol" } });
  const state = ((await pi.ask({ type: "get_state" })).data as { model: Model }).model;
  expect(state.compat?.["supportsMidConvoEffort"]).toBe(false);
}, 60_000);

it("shows an earlier extension a listed vendor's model at the vendor's first path until the session's start, then at its own", async () => {
  const at = await listener();
  const pi = await open({ packages: [fixture("catalogue"), fixture("routed")], env: routed(at.origin, "openrouter", { EARLY_PROVIDER: "openrouter" }) });
  const own = (await pi.known("openrouter")).chat.find(model => model.baseUrl.endsWith("/api/v1"))!;
  expect(own.baseUrl).toBe(`${at.origin}/providers/own/openrouter/api/v1`);
  expect(pi.early().chat.find(model => model.id === own.id)!.baseUrl).toBe(`${at.origin}/providers/own/openrouter/api`);
}, 60_000);

// The negative this holds: no registration at load for a listed vendor.
it("starts on a saved model of a listed vendor with no key, at the box from the first call", async () => {
  const at = await listener();
  const pi = await open({ packages: [fixture("catalogue"), fixture("routed")], env: routed(at.origin, "openrouter"), settings: { defaultProvider: "openrouter", defaultModel: "anthropic/claude-sonnet-4.5" } });
  const state = (await pi.ask({ type: "get_state" })).data as { model?: Model };
  expect(state.model?.provider).toBe("openrouter");
  expect(state.model?.baseUrl.startsWith(`${at.origin}/providers/own/openrouter/`)).toBe(true);
}, 60_000);
