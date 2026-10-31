import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { redirectTypeSafe } from "./src/index";

export default function (pi: ExtensionAPI): void {
  redirectTypeSafe(pi);
}
