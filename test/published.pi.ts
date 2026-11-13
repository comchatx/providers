import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { afterAll, expect, it, vi } from "vitest";
import { BOX_ORIGIN } from "@comchatx/providers";
import { fixture, session } from "./session.js";

/** The pi the product pins (`comchatx` package.json), which every computer runs. */
export const PINNED_PI = "1.5.2";

type Seen = { readonly provider: string; readonly id: string; readonly baseUrl: string };
type Registered = { readonly registered: readonly string[] } & Readonly<Record<"chat" | "image" | "classifier", readonly Seen[]>>;

const scratch = mkdtempSync(join(tmpdir(), "providers-published-"));
afterAll(() => rmSync(scratch, { recursive: true, force: true }));
const npm = (cwd: string, ...args: readonly string[]): string => execFileSync("npm", ["--no-audit", "--no-fund", ...args], { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
const timed = <T>(what: string, run: () => T): T => { const from = performance.now(); const out = run(); console.log(`${what}: ${((performance.now() - from) / 1000).toFixed(1)} s`); return out; };

// Each package as npm would publish it, installed by npm beside the others into a pi of the pinned version; pi started with `PI_OFFLINE=1`
// and a dead HTTP(S) proxy reads them, and a probe loaded after them writes what it registered. No retry, and pi's home is a fresh one.
it("loads every package the repository publishes in the pinned pi, each registering its provider at the box's proxy", async () => {
  const pi = join(scratch, "pi");
  const tarballs = join(scratch, "tarballs");
  const lib = join(scratch, "lib");
  for (const dir of [pi, tarballs, lib]) mkdirSync(dir);
  timed(`pi ${PINNED_PI} installed`, () => npm(pi, "install", "--prefix", pi, `@earendil-works/pi-coding-agent@${PINNED_PI}`));
  type Packed = { readonly name: string; readonly filename: string };
  // npm writes the workspaces' list as an array, or, from some 11.x on, as an object keyed by name.
  const listed = timed("packages packed", () => JSON.parse(npm(".", "pack", "--workspaces", "--offline", "--ignore-scripts", "--json", "--pack-destination", tarballs)) as readonly Packed[] | Readonly<Record<string, Packed>>);
  const packed = Array.isArray(listed) ? listed : Object.values(listed);
  timed("packages installed", () => npm(lib, "install", "--prefix", lib, "--offline", "--legacy-peer-deps", "--ignore-scripts", ...packed.map(one => join(tarballs, one.filename.replace(/^@/, "").replace("/", "-")))));
  const installed = packed.map(({ name }) => ({ name, dir: join(lib, "node_modules", name), manifest: JSON.parse(readFileSync(join(lib, "node_modules", name, "package.json"), "utf8")) as { readonly pi?: { readonly extensions?: readonly string[] }; readonly comchatx?: { readonly provider?: string } } }));
  // A card's package and the shared core carry no extension: pi registers nothing for them, and loads nothing.
  const extensions = installed.filter(one => (one.manifest.pi?.extensions?.length ?? 0) > 0);
  const providers = extensions.map(one => one.manifest.comchatx?.provider);
  expect(providers.every(provider => typeof provider === "string")).toBe(true);

  const from = performance.now();
  const host = await session({
    bin: join(pi, "node_modules", ".bin", "pi"),
    packages: [...extensions.map(one => one.dir), fixture("registered")],
    // What is set, not a proof: a connection made around pi's offline flag and the proxy would not fail this test.
    env: { PI_OFFLINE: "1", NODE_USE_ENV_PROXY: "1", HTTP_PROXY: "http://127.0.0.1:9", HTTPS_PROXY: "http://127.0.0.1:9" },
  });
  try {
    const file = join(scratch, "registered.json");
    await host.ask({ type: "prompt", message: `/cx-registered ${file}` });
    const seen = await vi.waitFor(() => JSON.parse(readFileSync(file, "utf8")) as Registered, { timeout: 30_000, interval: 50 });
    console.log(`pi started and read: ${((performance.now() - from) / 1000).toFixed(1)} s`);
    const models = [...seen.chat, ...seen.image, ...seen.classifier];
    // A package that did not load, or loaded and registered nothing, leaves its provider unregistered or its models off the proxy.
    const missing = (providers as string[]).filter(provider => !seen.registered.includes(provider) || !models.some(model => model.provider === provider && model.baseUrl.startsWith(BOX_ORIGIN)));
    expect(missing, "packages that registered nothing at the proxy").toEqual([]);
    const away = models.filter(model => (providers as string[]).includes(model.provider) && !model.baseUrl.startsWith(BOX_ORIGIN)).map(model => `${model.provider}/${model.id}`);
    expect(away, "models of our providers left off the proxy").toEqual([]);
    expect(seen.classifier.filter(model => model.provider === "typesafe")).toContainEqual({ provider: "typesafe", id: "jev-latest", baseUrl: `${BOX_ORIGIN}/providers/typesafe/v1` });

    // What pi itself lists that no package of ours registers: noted for the next reader, not failed on.
    const all = await import(pathToFileURL(join(pi, "node_modules", "@earendil-works", "pi-ai", "dist", "providers", "all.js")).href) as { builtinProviders: () => readonly { readonly id: string }[] };
    const unregistered = all.builtinProviders().map(({ id }) => id).filter(id => !(providers as string[]).includes(id)).sort();
    console.log(`pi ${PINNED_PI} lists ${all.builtinProviders().length} providers; ${extensions.length} packages of ours registered ${providers.length}; not registered by any: ${unregistered.join(", ")}`);
  } finally {
    await host.close();
  }
}, 600_000);
