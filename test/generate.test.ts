import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";
import { builtinProviders } from "@earendil-works/pi-ai/providers/all";
import { packages } from "../scripts/generate.mjs";
import { NOT_GENERATED } from "../scripts/vendors.mjs";

it("writes the packages on disk, byte for byte, so regenerating changes nothing", async () => {
  const made = await packages();
  expect(made.length).toBeGreaterThan(0);
  for (const { provider, files } of made) for (const [name, text] of Object.entries(files)) expect(readFileSync(join("packages", provider, name), "utf8"), `${provider}/${name}`).toBe(text);
});

it("keeps no package the generator would not write", async () => {
  const made = (await packages()).map(one => one.provider);
  expect(readdirSync("packages").sort()).toEqual([...made, "providers", "typesafe"].sort());
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
