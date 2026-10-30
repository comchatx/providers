import { afterEach, expect, it, vi } from "vitest";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { getBuiltinModels } from "@earendil-works/pi-ai/providers/all";
import { fixture, PACKAGES, session, standIn } from "./session.js";

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
