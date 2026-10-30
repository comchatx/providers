import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { redirect } from "@comchatx/providers";

export default function (pi: ExtensionAPI): void {
  redirect(pi, "openai", { compat: {"gpt-6-astra":{"supportsMidConvoEffort":false},"gpt-6-luna":{"supportsMidConvoEffort":false},"gpt-6-sol":{"supportsMidConvoEffort":false},"gpt-6.1-sol":{"supportsMidConvoEffort":false}} });
}
