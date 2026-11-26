import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import * as builtin from "@earendil-works/pi-ai/providers/all";
import * as pinned160 from "pi-ai-1.6.0/providers/all";
import * as pinned161 from "pi-ai-1.6.1/providers/all";

/** The compat the openai package's extension hands `redirect`, as it is written on disk. */
const emitted = (): Record<string, { readonly supportsMidConvoEffort?: boolean }> => {
  const found = /compat: (\{.*\}) \}\);/.exec(readFileSync("packages/openai/extension.ts", "utf8"));
  expect(found, "packages/openai/extension.ts hands redirect a compat").not.toBeNull();
  return JSON.parse(found![1]!);
};

it("turns mid-conversation effort off for every openai chat model any pinned pi marks for it, since a ChatGPT sign-in refuses the item", () => {
  const compat = emitted();
  const left = Object.fromEntries([["repo", builtin], ["1.6.0", pinned160], ["1.6.1", pinned161]].map(([version, catalogue]) => {
    const marked = (catalogue as typeof builtin).getAllBuiltinModels("openai")
      .filter(model => (model.type ?? "chat") === "chat" && (model as { compat?: { supportsMidConvoEffort?: boolean } }).compat?.supportsMidConvoEffort === true).map(model => model.id);
    expect(marked.length, String(version)).toBeGreaterThan(0);
    return [version, marked.filter(id => compat[id]?.supportsMidConvoEffort !== false)];
  }));
  expect(left).toEqual({ repo: [], "1.6.0": [], "1.6.1": [] });
});
