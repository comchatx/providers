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
    expect(manifest).toMatchObject({ name: `@comchatx/card-${card}`, pi: {}, files: ["LICENSE"], comchatx: { name: cards[card], section: "models", cardId: card } });
    expect(Object.keys(manifest.pi), dir).toEqual([]);
    expect([Object.hasOwn(manifest, "dependencies"), Object.hasOwn(manifest, "peerDependencies"), Object.hasOwn(manifest, "keywords")], dir).toEqual([false, false, false]);
    expect(Object.keys(files).sort(), dir).toEqual(["LICENSE", "package.json"]);
  }
});

it("carries each card's words as the product's maker-cards.json held them, none rewritten, and words for no card it does not package", async () => {
  const held = moved.cards;
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
  expect(made).toHaveLength(34);
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
