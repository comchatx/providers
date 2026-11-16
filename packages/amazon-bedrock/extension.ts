import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { redirect } from "@comchatx/providers";

export default function (pi: ExtensionAPI): void {
  process.env["AWS_BEDROCK_FORCE_HTTP1"] = "1";
  redirect(pi, "amazon-bedrock");
}
