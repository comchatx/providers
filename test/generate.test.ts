import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";
import { builtinProviders } from "@earendil-works/pi-ai/providers/all";
import { copyCards } from "../scripts/copy-cards.mjs";
import { cardPackages, packages } from "../scripts/generate.mjs";
import { CARD_SAID, NOT_GENERATED } from "../scripts/vendors.mjs";

/** The product's `maker-cards.json` as it held the cards' words before they moved here, and the card list the product's registry gives. */
const moved = JSON.parse(readFileSync("test/fixtures/maker-cards.json", "utf8")) as { readonly cards: Record<string, unknown> };
const cards = JSON.parse(readFileSync("scripts/cards.json", "utf8")) as Record<string, string>;

it("writes the packages on disk, byte for byte, so regenerating changes nothing", async () => {
  const made = await packages();
  expect(made.length).toBeGreaterThan(0);
  for (const { provider, files } of made) for (const [name, text] of Object.entries(files)) expect(readFileSync(join("packages", provider, name), "utf8"), `${provider}/${name}`).toBe(text);
});

it("keeps no package the generator would not write", async () => {
  const made = [...(await packages()).map(one => one.provider), ...(await cardPackages()).map(one => one.dir)];
  expect(readdirSync("packages").sort()).toEqual([...made, "providers", "typesafe"].sort());
});

it("writes each card's own package on disk, byte for byte, named card- and the card's id, with no extension", async () => {
  const made = await cardPackages();
  expect(made.map(one => one.card)).toEqual(Object.keys(cards).sort());
  expect(made).toHaveLength(27);
  for (const { card, dir, files } of made) {
    for (const [name, text] of Object.entries(files)) expect(readFileSync(join("packages", dir, name), "utf8"), `${dir}/${name}`).toBe(text);
    const manifest = JSON.parse(files["package.json"]);
    expect(manifest).toMatchObject({ name: `@comchatx/card-${card}`, pi: { extensions: [] }, files: ["LICENSE"], comchatx: { name: cards[card], section: "models", cardId: card } });
    // pi 1.5 reads a manifest that names no resource as none, and loads a package on a local path as an extension: an empty list says none.
    expect(manifest.pi, dir).toEqual({ extensions: [] });
    expect([Object.hasOwn(manifest, "dependencies"), Object.hasOwn(manifest, "peerDependencies"), Object.hasOwn(manifest, "keywords")], dir).toEqual([false, false, false]);
    expect(Object.keys(files).sort(), dir).toEqual(["LICENSE", "package.json"]);
  }
});

/** Words a card gained after they moved here, signed apart from the product's file and never written into the fixture. */
const SIGNED_HERE: Readonly<Record<string, Record<string, unknown>>> = { amazon: { card: { vendorZh: "亚马逊" } } };

it("carries each card's words as the product's maker-cards.json held them, none rewritten, with the words signed here beside them, and words for no card it does not package", async () => {
  // The fixture is never rewritten: a card the product no longer lists has left the words it held there behind.
  const held = Object.fromEntries(Object.entries(moved.cards).filter(([card]) => Object.hasOwn(cards, card)).map(([card, words]) => [card, { ...SIGNED_HERE[card], ...(words as object) }]));
  expect(Object.fromEntries(Object.entries(CARD_SAID).map(([card, said]) => [card, said.comchatx]))).toEqual(held);
  for (const { card, files } of await cardPackages()) {
    const { name: _name, section: _section, cardId: _cardId, ...words } = JSON.parse(files["package.json"]).comchatx;
    expect(words, card).toEqual(held[card] ?? {});
  }
  expect(Object.keys(CARD_SAID).filter(card => !Object.hasOwn(cards, card))).toEqual([]);
});

it("gives no card a package a provider's already holds: the two kinds are told apart by their names", async () => {
  const providers = new Set((await packages()).map(one => `@comchatx/${one.provider}`));
  for (const { files } of await cardPackages()) expect(providers.has(JSON.parse(files["package.json"]).name)).toBe(false);
  expect(providers.has("@comchatx/fireworks") && providers.has("@comchatx/nvidia")).toBe(true);
});

it("gives every provider of the pinned pi a package or a reason", async () => {
  const made = (await packages()).map(one => one.provider);
  expect([...made, ...Object.keys(NOT_GENERATED)].sort()).toEqual(builtinProviders().map(one => one.id).sort());
  expect(made).not.toContain("radius");
  expect(made).toHaveLength(37);
});

it("names each package by its provider and this repository, with the shelf fields the Plugins page reads", async () => {
  for (const { provider, files } of await packages()) {
    const manifest = JSON.parse(files["package.json"]);
    expect(manifest).toMatchObject({
      name: `@comchatx/${provider}`,
      pi: { extensions: ["./extension.ts"] },
      repository: { url: "git+https://github.com/comchatx/providers.git", directory: `packages/${provider}` },
      comchatx: { section: "models", provider, name: expect.any(String) },
    });
  }
});

it("marks OpenRouter alone as a host whose model ids name their maker", async () => {
  const marked = (await packages()).filter(one => JSON.parse(one.files["package.json"]).comchatx.aggregator === true).map(one => one.provider);
  expect(marked).toEqual(["openrouter"]);
});

it("lists no package in pi's gallery: the template and the hand-written packages carry no keywords", () => {
  // The template is JSON only once the generator fills its placeholders, so it is read as text.
  expect(readFileSync("template/package.json", "utf8").includes('"keywords"')).toBe(false);
  for (const path of ["packages/typesafe/package.json", "packages/providers/package.json"]) expect(Object.hasOwn(JSON.parse(readFileSync(path, "utf8")), "keywords"), path).toBe(false);
});

it("copies from the product's registry exactly the cards no provider serves, each by its id with its name, in id order", async () => {
  const dir = mkdtempSync(join(tmpdir(), "providers-cards-"));
  try {
    mkdirSync(join(dir, "product/src/shared"), { recursive: true });
    mkdirSync(join(dir, "root/scripts"), { recursive: true });
    const registry = { cards: { zeta: { name: "Zeta", providers: [] }, openai: { name: "OpenAI", providers: ["openai"] }, alpha: { name: "Alpha", providers: [], hosts: ["openrouter"] } } };
    writeFileSync(join(dir, "product/src/shared/model-makers.json"), JSON.stringify(registry));
    expect(await copyCards(join(dir, "product"), join(dir, "root"))).toEqual({ alpha: "Alpha", zeta: "Zeta" });
    expect(readFileSync(join(dir, "root/scripts/cards.json"), "utf8")).toBe('{\n  "alpha": "Alpha",\n  "zeta": "Zeta"\n}\n');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

it("gives the Amazon Bedrock and Google Vertex AI cards their signed Overview, how to get the key each takes, and no line or README the card does not read", async () => {
  const signed = {
    "amazon-bedrock": {
      en: "In the AWS console, open Amazon Bedrock, go to API keys and generate a long-term API key, then paste it into this plugin's Settings. Its models then show under Models and in chat. A short-term API key lasts 12 hours at most, so it does not suit this plugin, and AWS access keys are not accepted.",
      zh: "在 AWS 控制台打开 Amazon Bedrock，在「API keys」中生成一个长期 API Key，粘贴到这个插件的「设置」里。之后它的模型会列在「模型」中，也能在对话中选用。短期 API Key 最多 12 小时就会失效，不适合这里；AWS 访问密钥不能用。",
    },
    "google-vertex": {
      en: "In the Google Cloud console, open Express Mode and sign up to get an API key, then paste it into this plugin's Settings. Gemini models then show under Models and in chat. Signing up needs a @gmail.com Google account, and service-account files are not accepted.",
      zh: "在 Google Cloud 控制台打开 Express Mode，注册后会得到一个 API Key，粘贴到这个插件的「设置」里。之后 Gemini 模型会列在「模型」中，也能在对话中选用。注册要用 @gmail.com 的 Google 账号；服务账号文件不能用。",
    },
  };
  const made = await packages();
  for (const [provider, description] of Object.entries(signed)) {
    const { files } = made.find(one => one.provider === provider)!;
    const manifest = JSON.parse(files["package.json"]);
    expect(manifest.version, provider).toBe("0.1.2");
    expect(manifest.comchatx, provider).toEqual({ name: manifest.comchatx.name, section: "models", provider, card: { description } });
    expect(Object.keys(files).sort(), provider).toEqual(["LICENSE", "extension.ts", "package.json"]);
  }
});

it("names Amazon in Chinese as 亚马逊 on its card, in the form the Alibaba and Xiaomi cards carry, at 0.1.1", async () => {
  const { files } = (await cardPackages()).find(one => one.card === "amazon")!;
  const manifest = JSON.parse(files["package.json"]);
  expect(manifest.version).toBe("0.1.1");
  expect(manifest.comchatx.card).toEqual({ vendorZh: "亚马逊" });
});

it("draws TypeSafe's card with the typesafe mark", () => {
  const manifest = JSON.parse(readFileSync("packages/typesafe/package.json", "utf8"));
  expect(manifest.comchatx.mark).toEqual({ logo: "typesafe" });
  expect(manifest.version).toBe("0.1.4");
});
