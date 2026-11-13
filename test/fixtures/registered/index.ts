import { writeFileSync } from "node:fs";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

// Loaded after every package, reads what pi registered: the providers extensions registered, and each model pi knows, by type, with its base URL.
export default function (pi: ExtensionAPI): void {
  pi.registerCommand("cx-registered", {
    description: "Write what pi registered",
    handler: async (file, ctx) => {
      const of = (type: "chat" | "image" | "classifier") => ctx.modelRegistry.getModelsOfType(type).map(({ provider, id, baseUrl }) => ({ provider, id, baseUrl }));
      writeFileSync(file, JSON.stringify({ registered: ctx.modelRegistry.getRegisteredProviderIds(), chat: of("chat"), image: of("image"), classifier: of("classifier") }));
    },
  });
}
