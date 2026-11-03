import { execFileSync, spawnSync } from "node:child_process";
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
const WORKFLOW = readFileSync(".github/workflows/publish-bootstrap.yml", "utf8");

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

it("runs the bootstrap at a person's press alone, and leaves the token to npm", () => {
  expect(/^on:\n  workflow_dispatch:\n\n/m.test(WORKFLOW)).toBe(true);
  expect(WORKFLOW).toContain("permissions:\n  contents: read\n  id-token: write\n");
  expect(WORKFLOW.match(/secrets\.[A-Z_]+/g)).toEqual(["secrets.NPM_TOKEN"]);
  expect(WORKFLOW.match(/.*NODE_AUTH_TOKEN.*/g)).toEqual(["          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}"]);
  expect(WORKFLOW).not.toMatch(/npm config set|\.npmrc/);
});

it("lists every package in the trust loop, on the file name npm takes", () => {
  const section = readFileSync("README.md", "utf8").split("## After the first publish")[1]!;
  expect([...section.matchAll(/^ {2}(@comchatx\/[a-z0-9-]+)/gm)].map(match => match[1]).sort()).toEqual(NAMES);
  expect(section).toContain("npm 11.15 or later");
  expect(section).toContain("npm --version");
  expect(section).toContain("npm install -g npm@latest");
  expect(section).toContain("npm trust github \"$name\" --file release.yml --repo comchatx/providers --allow-publish --yes || { echo \"failed: $name\"; break; }");
  expect(section).toContain("sleep 2");
});

/** Runs the workflow's publish step against a stand-in npm, which answers `npm view` of the core as given and logs each publish. */
function step(view: { readonly exit: number; readonly stderr: string }) {
  const dir = scratch();
  const published = join(dir, "published");
  const summary = join(dir, "summary");
  writeFileSync(join(dir, "view-stderr"), view.stderr);
  writeFileSync(published, "");
  writeFileSync(join(dir, "npm"), `#!/bin/bash\nif [ "$1" = view ]; then cat "${join(dir, "view-stderr")}" >&2; exit ${view.exit}; fi\necho "$@" >> "${published}"\n`, { mode: 0o755 });
  const body = WORKFLOW.slice(WORKFLOW.indexOf("        run: |\n          set -euo")).split("\n").slice(1).map(line => line.slice(10)).join("\n");
  const run = spawnSync("bash", ["-c", body], { encoding: "utf8", env: { PATH: `${dir}:${process.env["PATH"] ?? ""}`, GITHUB_STEP_SUMMARY: summary } });
  return { exit: run.status, publishes: readFileSync(published, "utf8").split("\n").filter(Boolean).length, summary: readFileSync(summary, "utf8") };
}

it("stops before any publish on a registry error whose message happens to say E404", () => {
  const run = step({ exit: 1, stderr: "npm error code E500\nnpm error 500 Internal Server Error - upstream said E404\n" });
  expect(run).toMatchObject({ exit: 1, publishes: 0 });
  expect(run.summary).toContain("- Failed: @comchatx/providers");
});

it("stops before any publish on an ordinary registry error", () => {
  const run = step({ exit: 1, stderr: "npm error code E500\nnpm error 500 Internal Server Error\n" });
  expect(run).toMatchObject({ exit: 1, publishes: 0 });
  expect(run.summary).toContain("- Failed: @comchatx/providers");
});

it("stops before any publish on a failure with no code line", () => {
  const run = step({ exit: 1, stderr: "something said E404\n" });
  expect(run).toMatchObject({ exit: 1, publishes: 0 });
  expect(run.summary).toContain("- Failed: @comchatx/providers");
});

it("publishes all 36 when npm's code is E404, and names none as failed", () => {
  const run = step({ exit: 1, stderr: "npm error code E404\nnpm error 404 Not Found\n" });
  expect(run).toMatchObject({ exit: 0, publishes: 36 });
  expect(run.summary).toContain("- Failed: none");
});
