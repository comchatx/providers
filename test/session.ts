import { spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { vi } from "vitest";

export const PACKAGES = resolve("packages");
export const fixture = (name: string): string => resolve("test/fixtures", name);
const PI = resolve("node_modules/.bin/pi");

export type Hit = { readonly url: string; readonly key: string | undefined; readonly body: string };
/** The box's listener: every call is kept, Jev's route answers, and any other is refused, since a witness reads where it went. */
export async function standIn(jev: unknown): Promise<{ readonly origin: string; readonly hits: Hit[]; readonly close: () => void }> {
  const hits: Hit[] = [];
  const server: Server = createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on("data", chunk => chunks.push(chunk as Buffer));
    req.on("end", () => {
      const key = req.headers["x-api-key"] ?? req.headers.authorization;
      hits.push({ url: req.url ?? "", key: Array.isArray(key) ? key[0] : key, body: Buffer.concat(chunks).toString() });
      if (req.url?.endsWith("/systemone")) res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify(jev));
      else res.writeHead(500, { "content-type": "application/json" }).end('{"error":{"message":"stand-in"}}');
    });
  });
  await new Promise<void>(done => server.listen(0, "127.0.0.1", done));
  return { origin: `http://127.0.0.1:${(server.address() as AddressInfo).port}`, hits, close: () => { server.closeAllConnections(); server.close(); } };
}

export type Known = Readonly<Record<"chat" | "image" | "classifier", readonly Model[]>>;
export type Model = { readonly id: string; readonly provider: string; readonly api: string; readonly baseUrl: string; readonly compat?: Readonly<Record<string, unknown>> };
type Options = { readonly packages: readonly unknown[]; readonly env?: Readonly<Record<string, string>>; readonly modelsJson?: unknown; readonly settings?: Readonly<Record<string, unknown>> };

/** A pi of its own, its home a temporary one, in RPC mode. */
export async function session({ packages, env = {}, modelsJson, settings: extra = {} }: Options) {
  const root = mkdtempSync(join(tmpdir(), "providers-"));
  const agent = join(root, "agent");
  const cwd = join(root, "cwd");
  mkdirSync(agent);
  mkdirSync(cwd);
  const settingsFile = join(agent, "settings.json");
  const settings = (list: readonly unknown[]): void => writeFileSync(settingsFile, JSON.stringify({ ...extra, retry: { enabled: false }, quietStartup: true, defaultProjectTrust: "always", packages: list }));
  settings(packages);
  if (modelsJson !== undefined) writeFileSync(join(agent, "models.json"), JSON.stringify(modelsJson));
  const child = spawn(PI, ["--mode", "rpc", "--no-session"], { cwd, env: { PATH: process.env["PATH"] ?? "/usr/bin:/bin", HOME: root, PI_CODING_AGENT_DIR: agent, ...env }, stdio: ["pipe", "pipe", "ignore"] });
  const waiting = new Map<string, (message: { success: boolean; data?: unknown; error?: string }) => void>();
  const events: { type: string }[] = [];
  let buffer = "";
  let asked = 0;
  child.stdout.on("data", (chunk: Buffer) => {
    buffer += chunk.toString();
    for (let at = buffer.indexOf("\n"); at >= 0; at = buffer.indexOf("\n")) {
      const line = buffer.slice(0, at);
      buffer = buffer.slice(at + 1);
      let message: { type: string; id?: string; success: boolean };
      try { message = JSON.parse(line); } catch { continue; }
      if (message.type === "response" && message.id !== undefined) { waiting.get(message.id)?.(message); waiting.delete(message.id); } else events.push(message);
    }
  });
  const ask = (command: Readonly<Record<string, unknown>>) => new Promise<{ success: boolean; data?: unknown; error?: string }>((done, failed) => {
    const id = `r${++asked}`;
    const timer = setTimeout(() => failed(new Error(`pi did not answer ${String(command["type"])}`)), 45_000);
    waiting.set(id, answer => { clearTimeout(timer); done(answer); });
    child.stdin.write(`${JSON.stringify({ id, ...command })}\n`);
  });
  const models = async (provider?: string): Promise<readonly Model[]> => {
    const all = ((await ask({ type: "get_available_models" })).data as { models: readonly Model[] }).models;
    return provider === undefined ? all : all.filter(model => model.provider === provider);
  };
  const paths = async (provider: string): Promise<Readonly<Record<string, number>>> => {
    const by: Record<string, number> = {};
    for (const model of await models(provider)) by[model.baseUrl] = (by[model.baseUrl] ?? 0) + 1;
    return by;
  };
  /** Sends a message on a model and waits for the run to end. */
  const say = async (provider: string, modelId: string): Promise<void> => {
    await ask({ type: "set_model", provider, modelId });
    const from = events.length;
    await ask({ type: "prompt", message: "hi" });
    while (!events.slice(from).some(event => event.type === "agent_end")) await new Promise(done => setTimeout(done, 25));
  };
  const reload = async (list: readonly unknown[]): Promise<void> => {
    settings(list);
    await ask({ type: "prompt", message: "/cx-reload" });
  };
  /** What the catalogue fixture read of `provider` from the public registry, every operation. */
  const known = async (provider: string): Promise<Known> => {
    const file = join(root, `known-${++asked}.json`);
    await ask({ type: "prompt", message: `/cx-known ${provider} ${file}` });
    return vi.waitFor(() => JSON.parse(readFileSync(file, "utf8")) as Known, { timeout: 20_000, interval: 25 });
  };
  /** Runs one image or classifier call through pi's registry, by the catalogue fixture. */
  const operate = async (operation: "image" | "classifier", provider: string, modelId: string): Promise<void> => {
    const file = join(root, `operated-${++asked}.json`);
    await ask({ type: "prompt", message: `/cx-operate ${operation} ${provider} ${modelId} ${file}` });
    await vi.waitFor(() => readFileSync(file), { timeout: 20_000, interval: 25 });
  };
  return { ask, models, paths, say, reload, known, operate, root, close: async () => {
    child.kill();
    await new Promise(done => child.once("exit", done));
    rmSync(root, { recursive: true, force: true });
  } };
}
