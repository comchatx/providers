import { readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Copies the product's model cards that no provider's package serves into `scripts/cards.json`, each by its id with the registry's name:
 * the cards `src/shared/model-makers.json` lists with no provider. The product's checkout is the one argument:
 * `npm run copy-cards -- ../comchatx`.
 */
export async function copyCards(product, root = resolve(fileURLToPath(new URL("..", import.meta.url)))) {
  const { cards } = JSON.parse(await readFile(join(product, "src/shared/model-makers.json"), "utf8"));
  const without = Object.fromEntries(Object.entries(cards).filter(([, card]) => card.providers.length === 0).sort(([a], [b]) => a.localeCompare(b)).map(([id, card]) => [id, card.name]));
  await writeFile(join(root, "scripts/cards.json"), `${JSON.stringify(without, null, 2)}\n`);
  return without;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (process.argv[2] === undefined) { console.error("name the product's checkout: npm run copy-cards -- ../comchatx"); process.exit(1); }
  console.log(`${Object.keys(await copyCards(resolve(process.argv[2]))).length} cards`);
}
