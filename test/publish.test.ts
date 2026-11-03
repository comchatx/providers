import { execFileSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it } from "vitest";
import { fixture, session } from "./session.js";

const cleanups: (() => unknown)[] = [];
afterEach(async () => { for (const cleanup of cleanups.splice(0).reverse()) await cleanup(); });
const scratch = (): string => { const dir = mkdtempSync(join(tmpdir(), "providers-pack-")); cleanups.push(() => rmSync(dir, { recursive: true, force: true })); return dir; };
const npm = (cwd: string, ...args: readonly string[]): string => execFileSync("npm", [...args], { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
const pack = (into: string): readonly { readonly name: string; readonly filename: string; readonly files: readonly { readonly path: string }[] }[] => JSON.parse(npm(".", "pack", "--workspaces", "--offline", "--ignore-scripts", "--json", "--pack-destination", into));
const NAMES = readdirSync("packages").map(name => `@comchatx/${name}`).sort();

it("puts the root's notice in every tarball, byte for byte", () => {
  const into = scratch();
  const packed = pack(into);
  expect(packed.map(one => one.name).sort()).toEqual(NAMES);
  expect(NAMES).toHaveLength(36);
  const notice = readFileSync("LICENSE", "utf8");
  for (const { name, filename, files } of packed) {
    expect(files.map(file => file.path), name).toContain("LICENSE");
    const tarball = join(into, filename.replace(/^@/, "").replace("/", "-"));
    expect(execFileSync("tar", ["-xOzf", tarball, "package/LICENSE"], { encoding: "utf8" }), name).toBe(notice);
  }
}, 120_000);

it("loads the tarballs from a consumer's own install, with the core's two host packages as peers", async () => {
  expect(JSON.parse(readFileSync("packages/providers/package.json", "utf8")).peerDependencies).toEqual({ "@earendil-works/pi-ai": "*", "@earendil-works/pi-coding-agent": "*" });
  const into = scratch();
  const packed = pack(into).filter(one => ["@comchatx/providers", "@comchatx/anthropic", "@comchatx/typesafe"].includes(one.name));
  writeFileSync(join(into, "package.json"), JSON.stringify({ private: true }));
  npm(into, "install", "--offline", "--ignore-scripts", "--legacy-peer-deps", "--no-audit", "--no-fund", ...packed.map(one => one.filename.replace(/^@/, "").replace("/", "-")));
  const at = (name: string): string => join(into, "node_modules/@comchatx", name);
  const pi = await session({ packages: [fixture("catalogue"), at("anthropic"), at("typesafe")] });
  cleanups.push(pi.close);
  const models = await pi.known("anthropic");
  expect(models.chat.length).toBeGreaterThan(0);
  for (const model of models.chat) expect(model.baseUrl).toBe("http://127.0.0.1:8081/providers/own/anthropic");
  expect((await pi.known("typesafe")).classifier.map(model => model.baseUrl)).toEqual(["http://127.0.0.1:8081/providers/typesafe/v1"]);
}, 120_000);
