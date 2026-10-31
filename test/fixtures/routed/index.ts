import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { redirect } from "@comchatx/providers";

// A package's one call with the stand-in's address in place of the box's listener.
export default function (pi: ExtensionAPI): void {
  const compat = process.env["ROUTED_COMPAT"];
  redirect(pi, process.env["ROUTED_PROVIDER"]!, { origin: process.env["STAND_IN"]!, ...(compat === undefined ? {} : { compat: JSON.parse(compat) }) });
}
