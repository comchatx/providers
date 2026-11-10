import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { builtinProviders } from "@earendil-works/pi-ai/providers/all";
import { CARD_SAID, CARD_VERSION, NOT_GENERATED, SAID, VERSION } from "./vendors.mjs";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
/** The hand-written packages under `packages/`, which the generator leaves alone. */
const WRITTEN = new Set(["providers", "typesafe"]);

/** Each generated package as its files, from pi's registry and the template. */
export async function packages(root = ROOT) {
  const manifest = await readFile(join(root, "template/package.json"), "utf8");
  const extension = await readFile(join(root, "template/extension.ts"), "utf8");
  const license = await readFile(join(root, "LICENSE"), "utf8");
  return builtinProviders().filter(({ id }) => !Object.hasOwn(NOT_GENERATED, id)).sort((a, b) => a.id.localeCompare(b.id)).map(({ id, name }) => {
    const said = SAID[id] ?? {};
    const fill = (text, values) => Object.entries(values).reduce((out, [key, value]) => out.replaceAll(`{{${key}}}`, value), text);
    const comchatx = JSON.stringify({ name, section: "models", provider: id, ...said.comchatx });
    return { provider: id, files: {
      "package.json": fill(manifest, { provider: id, name, comchatx, version: said.version ?? VERSION }),
      "extension.ts": fill(extension, { provider: id, options: said.compat === undefined ? "" : `, { compat: ${JSON.stringify(said.compat)} }` }),
      LICENSE: license,
    } };
  });
}

/**
 * Each card's own package as its files, for the cards `scripts/cards.json` names: a manifest whose `comchatx` field carries the card's
 * name and words, and the notice. No extension: pi registers no provider for such a card, and no computer installs its package.
 */
export async function cardPackages(root = ROOT) {
  const manifest = await readFile(join(root, "template-card/package.json"), "utf8");
  const license = await readFile(join(root, "LICENSE"), "utf8");
  const cards = JSON.parse(await readFile(join(root, "scripts/cards.json"), "utf8"));
  return Object.entries(cards).sort(([a], [b]) => a.localeCompare(b)).map(([id, name]) => {
    const said = CARD_SAID[id] ?? {};
    const fill = (text, values) => Object.entries(values).reduce((out, [key, value]) => out.replaceAll(`{{${key}}}`, value), text);
    const comchatx = JSON.stringify({ name, section: "models", cardId: id, ...said.comchatx });
    return { card: id, dir: `card-${id}`, files: { "package.json": fill(manifest, { card: id, name, comchatx, version: said.version ?? CARD_VERSION }), LICENSE: license } };
  });
}

/** Writes every package afresh and takes away one no longer generated. */
export async function generate(root = ROOT) {
  const made = [...(await packages(root)).map(({ provider, files }) => ({ dir: provider, files })), ...(await cardPackages(root)).map(({ dir, files }) => ({ dir, files }))];
  const names = new Set(made.map(one => one.dir));
  for (const dir of await readdir(join(root, "packages"))) if (!WRITTEN.has(dir) && !names.has(dir)) await rm(join(root, "packages", dir), { recursive: true });
  for (const { dir, files } of made) {
    await mkdir(join(root, "packages", dir), { recursive: true });
    for (const [name, text] of Object.entries(files)) await writeFile(join(root, "packages", dir, name), text);
  }
  // npm packs a workspace on its own, so the root's notice does not reach a tarball.
  for (const dir of WRITTEN) await writeFile(join(root, "packages", dir, "LICENSE"), await readFile(join(root, "LICENSE"), "utf8"));
  return made;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) console.log(`${(await generate()).length} packages`);
