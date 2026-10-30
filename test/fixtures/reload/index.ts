import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

// The box's `cx-reload`, as the product's image registers it.
export default function (pi: ExtensionAPI): void {
  pi.registerCommand("cx-reload", {
    description: "Reload",
    handler: async (_args, ctx) => {
      await ctx.modelRegistry.refresh({ allowNetwork: false });
      await ctx.reload();
    },
  });
}
