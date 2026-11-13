import { defineConfig } from "vitest/config";

/** The one test that loads what the repository publishes in a real pi: its own job, outside `npm test`. */
export default defineConfig({ test: { include: ["test/published.pi.ts"] } });
