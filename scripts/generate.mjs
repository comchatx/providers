import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { builtinProviders } from "@earendil-works/pi-ai/providers/all";
import { NOT_GENERATED, SAID } from "./vendors.mjs";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
/** The hand-written packages under `packages/`, which the generator leaves alone. */
const WRITTEN = new Set(["providers", "typesafe"]);

/** Each generated package as its files, from pi's registry and the template. */
export async function packages(root = ROOT) {
  const manifest = await readFile(join(root, "template/package.json"), "utf8");
  const extension = await readFile(join(root, "template/extension.ts"), "utf8");
  return builtinProviders().filter(({ id }) => !Object.hasOwn(NOT_GENERATED, id)).sort((a, b) => a.id.localeCompare(b.id)).map(({ id, name }) => {
    const said = SAID[id] ?? {};
    const fill = (text, values) => Object.entries(values).reduce((out, [key, value]) => out.replaceAll(`{{${key}}}`, value), text);
    const comchatx = JSON.stringify({ name, section: "models", provider: id, ...said.comchatx });
    return { provider: id, files: {
      "package.json": fill(manifest, { provider: id, name, comchatx }),
      "extension.ts": fill(extension, { provider: id, options: said.compat === undefined ? "" : `, { compat: ${JSON.stringify(said.compat)} }` }),
    } };
  });
}

/** Writes every package afresh and takes away one no longer generated. */
export async function generate(root = ROOT) {
  const made = await packages(root);
  const names = new Set(made.map(one => one.provider));
  for (const dir of await readdir(join(root, "packages"))) if (!WRITTEN.has(dir) && !names.has(dir)) await rm(join(root, "packages", dir), { recursive: true });
  for (const { provider, files } of made) {
    await mkdir(join(root, "packages", provider), { recursive: true });
    for (const [name, text] of Object.entries(files)) await writeFile(join(root, "packages", provider, name), text);
  }
  return made;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) console.log(`${(await generate()).length} packages`);
