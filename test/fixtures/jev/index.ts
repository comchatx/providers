import { writeFileSync } from "node:fs";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { askJev, redirectTypeSafe } from "@comchatx/typesafe";

// A dependent's call of `askJev`, with the answer written where the witness reads it. `JEV_OFF` is the package off: the client without the redirect;
// `JEV_BARE` asks a question with no criteria, as cx-jev-tidy asks its own.
export default function (pi: ExtensionAPI): void {
  if (process.env["JEV_OFF"] === undefined) redirectTypeSafe(pi, { origin: process.env["STAND_IN"]! });
  pi.registerCommand("ask-jev", {
    description: "Ask Jev",
    handler: async (_args, ctx) => {
      const answer = await askJev(ctx.modelRegistry, { latest: "a message" }, { same: process.env["JEV_BARE"] === undefined ? { type: "bool", instructions: "Same topic?", criteria: { true: "yes", false: "no" } } : { type: "bool", instructions: "Same topic?" } }, { timeoutMs: 5_000 });
      writeFileSync(process.env["JEV_OUT"]!, JSON.stringify(answer));
    },
  });
}
