import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { redirect } from "@comchatx/providers";

export default function (pi: ExtensionAPI): void {
  redirect(pi, "anthropic");
}
