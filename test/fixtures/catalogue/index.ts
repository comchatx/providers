import { writeFileSync } from "node:fs";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

// Reads the public registry as any other extension would, and calls through it. Answers by file: a command's handler has no reply in RPC mode.
export default function (pi: ExtensionAPI): void {
  // Loaded ahead of a package, this is the handler that runs before the package's at the session's start.
  pi.on("session_start", (_event, ctx) => {
    const provider = process.env["EARLY_PROVIDER"];
    if (provider === undefined) return;
    writeFileSync(process.env["EARLY_FILE"]!, JSON.stringify({
      selected: ctx.model?.id,
      chat: ctx.modelRegistry.getModelsOfType("chat", provider),
      image: ctx.modelRegistry.getModelsOfType("image", provider),
      classifier: ctx.modelRegistry.getModelsOfType("classifier", provider),
    }));
  });
  pi.registerCommand("cx-known", {
    description: "Write what the registry knows of a vendor",
    handler: async (args, ctx) => {
      const [provider, file] = args.split(" ") as [string, string];
      writeFileSync(file, JSON.stringify({
        chat: ctx.modelRegistry.getModelsOfType("chat", provider),
        image: ctx.modelRegistry.getModelsOfType("image", provider),
        classifier: ctx.modelRegistry.getModelsOfType("classifier", provider),
      }));
    },
  });
  pi.registerCommand("cx-operate", {
    description: "Make one image or classifier call",
    handler: async (args, ctx) => {
      const [operation, provider, id, file] = args.split(" ") as ["image" | "classifier", string, string, string];
      const options = { maxRetries: 0, timeoutMs: 10_000 };
      const answer = operation === "image"
        ? await ctx.modelRegistry.generateImages(ctx.modelRegistry.findOfType("image", provider, id)!, { input: [{ type: "text", text: "hi" }] }, options)
        : await ctx.modelRegistry.classify(ctx.modelRegistry.findOfType("classifier", provider, id)!, { state: { a: 1 }, questions: { same: { type: "bool", instructions: "same?", criteria: { true: "yes", false: "no" } } } }, options);
      writeFileSync(file, JSON.stringify(answer));
    },
  });
}
