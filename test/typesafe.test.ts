import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { askJev, JEV_MODEL, type Questions } from "@comchatx/typesafe";
import { fixture, session, standIn } from "./session.js";

const cleanups: (() => unknown)[] = [];
afterEach(async () => { for (const cleanup of cleanups.splice(0).reverse()) await cleanup(); });

const answerFile = (): string => { const dir = mkdtempSync(join(tmpdir(), "jev-")); cleanups.push(() => rmSync(dir, { recursive: true, force: true })); return join(dir, "answer.json"); };
const whole = { model: "jev-1.13.0", answers: { same: { type: "noul", noul: 0.7 } }, usage: { input_tokens: 1, output_tokens: 0 } };
async function asked(jev: unknown, env: Readonly<Record<string, string>> = {}) {
  const at = await standIn(jev);
  cleanups.push(at.close);
  const pi = await session({ packages: [fixture("jev")], env: { STAND_IN: at.origin, JEV_OUT: "/dev/null", ...env } });
  cleanups.push(pi.close);
  return { at, pi };
}

describe("on the pinned pi", () => {
  it("asks Jev at the proxy's TypeSafe route with the placeholder, and reads a whole answer", async () => {
    const out = answerFile();
    const { at, pi } = await asked(whole, { JEV_OUT: out });
    await pi.ask({ type: "prompt", message: "/ask-jev" });
    expect(JSON.parse(readFileSync(out, "utf8"))).toEqual({ answers: { same: 0.7 } });
    expect(at.hits.map(({ url, key }) => [url, key])).toEqual([["/providers/typesafe/v1/systemone", "Bearer cmx-placeholder-key"]]);
    expect(JSON.parse(at.hits[0]!.body).model).toBe(JEV_MODEL);
  }, 60_000);

  it("reads Jev's package off as refused, and calls nothing", async () => {
    const out = answerFile();
    const { at, pi } = await asked(whole, { JEV_OUT: out, JEV_OFF: "1" });
    await pi.ask({ type: "prompt", message: "/ask-jev" });
    expect(JSON.parse(readFileSync(out, "utf8"))).toEqual({ failure: "refused" });
    expect(at.hits).toEqual([]);
  }, 60_000);
});

describe("what a call that gave no answer is called", () => {
  const questions: Questions = { same: { type: "bool", instructions: "?", criteria: { true: "y", false: "n" } } };
  const registry = (found: unknown, answer: () => Promise<unknown>) => ({ findOfType: vi.fn(() => found), classify: vi.fn(answer) }) as never;
  const said = (raw: unknown) => askJev(registry({}, async () => raw), {}, questions, { timeoutMs: 1 });

  it("names a model pi does not have", async () => {
    expect(await askJev(registry(undefined, async () => undefined), {}, questions, { timeoutMs: 1 })).toEqual({ failure: "no-model" });
  });
  it.each([
    [{ stopReason: "aborted" }, "timeout"],
    [{ stopReason: "error", errorMessage: "Request timed out" }, "timeout"],
    [{ stopReason: "length" }, "malformed"],
    [{ stopReason: "error", usage: { input: 3 } }, "malformed"],
    [{ stopReason: "error", errorMessage: "400 bad" }, "rejected"],
    [{ stopReason: "error", errorMessage: "classifier error (422): no" }, "rejected"],
    [{ stopReason: "error", errorMessage: "403 forbidden" }, "rejected"],
    [{ stopReason: "error", errorMessage: "403 membership_required" }, "refused"],
    [{ stopReason: "error", errorMessage: "503 busy" }, "refused"],
    [{ stopReason: "error", errorMessage: "Provider is not configured: typesafe" }, "refused"],
    [{ stopReason: "stop" }, "malformed"],
    [{ stopReason: "stop", answers: {} }, "missing-answers"],
    [{ stopReason: "stop", answers: { same: { type: "bool", probability: 2 } } }, "malformed"],
    ["not an answer", "malformed"],
  ])("%j is %s", async (raw, failure) => {
    expect(await said(raw)).toEqual({ failure });
  });
  it("calls a thrown timeout a timeout, and any other throw refused", async () => {
    expect(await askJev(registry({}, async () => { throw new Error("timed out"); }), {}, questions, { timeoutMs: 1 })).toEqual({ failure: "timeout" });
    expect(await askJev(registry({}, async () => { throw new Error("nope"); }), {}, questions, { timeoutMs: 1 })).toEqual({ failure: "refused" });
  });
  it("retries nothing, since a call received is billed", async () => {
    const one = { findOfType: vi.fn(() => ({})), classify: vi.fn(async () => ({ stopReason: "stop", answers: { same: { type: "bool", probability: 0.5 } } })) };
    expect(await askJev(one as never, {}, questions, { timeoutMs: 9 })).toEqual({ answers: { same: 0.5 } });
    expect(one.classify.mock.calls[0]![2 as never]).toMatchObject({ maxRetries: 0, timeoutMs: 9 });
  });
});
