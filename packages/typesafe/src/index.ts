import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { redirect, type RedirectOptions } from "@comchatx/providers";

export const JEV_PROVIDER = "typesafe";
export const JEV_MODEL = "jev-latest";

/** TypeSafe's route on the box's proxy, which serves the one call on the tenant's key first and else the platform's. */
export const redirectTypeSafe = (pi: ExtensionAPI, options: Pick<RedirectOptions, "origin"> = {}): void => redirect(pi, JEV_PROVIDER, { ...options, route: "/providers/typesafe/v1" });

export type Question = { readonly type: "bool"; readonly instructions: string; readonly criteria: { readonly true: string; readonly false: string } };
export type Questions = Readonly<Record<string, Question>>;
/**
 * Why a call gave no answer, in the words `cx-topics` reads. `malformed` and `missing-answers` are calls answered and billed whose answer
 * cannot be read; `rejected` a request the service refuses as it is; `refused` a call refused for a reason outside the request, Jev's
 * package being off among them; `timeout` one cut or not answered in time; `no-model` one pi has no such model for.
 */
export type AnswerFailure = "refused" | "rejected" | "timeout" | "malformed" | "missing-answers" | "no-model";
export type JevAnswer = { readonly answers: Readonly<Record<string, number>> } | { readonly failure: AnswerFailure };

const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value);
/** The platform's own refusals, each named in the body it answers. */
const GATE_CODES = /\b(membership_required|debt_owed|model_not_served|sign_in_again)\b/;
const statusOf = (message: string): number | undefined => {
  const found = /^(\d{3})\b/.exec(message) ?? /^[^()\n{}":]* error \((\d{3})\)(?::|$)/.exec(message);
  return found === null ? undefined : Number(found[1]);
};
const billed = (usage: unknown): boolean => record(usage) && ["input", "output", "totalTokens"].some(key => typeof usage[key] === "number" && (usage[key] as number) > 0);

function failureOf(raw: Readonly<Record<string, unknown>>): AnswerFailure {
  if (raw["stopReason"] === "aborted") return "timeout";
  if (raw["stopReason"] === "length" || raw["stopReason"] === "toolUse" || billed(raw["usage"])) return "malformed";
  const message = typeof raw["errorMessage"] === "string" ? raw["errorMessage"] : "";
  if (/timed out/i.test(message)) return "timeout";
  const status = statusOf(message);
  return status === 400 || status === 413 || status === 422 || (status === 403 && !GATE_CODES.test(message)) ? "rejected" : "refused";
}

function read(raw: unknown, questions: Questions): JevAnswer {
  if (!record(raw)) return { failure: "malformed" };
  if (raw["stopReason"] !== "stop") return { failure: failureOf(raw) };
  const given = raw["answers"];
  if (!record(given)) return { failure: "malformed" };
  const answers: Record<string, number> = {};
  for (const key of Object.keys(questions)) {
    if (!Object.hasOwn(given, key)) return { failure: "missing-answers" };
    const answer = given[key];
    // pi checks that a probability is a finite number, not that it lies in [0, 1].
    if (!record(answer) || answer["type"] !== "bool" || typeof answer["probability"] !== "number" || !Number.isFinite(answer["probability"]) || answer["probability"] < 0 || answer["probability"] > 1) return { failure: "malformed" };
    answers[key] = answer["probability"];
  }
  return { answers: Object.freeze(answers) };
}

type Registry = ExtensionContext["modelRegistry"];
type State = Parameters<Registry["classify"]>[1]["state"];

/** Asks Jev through pi's classifier, with no retry: a call TypeSafe received is billed even when its answer is lost. */
export async function askJev(registry: Registry, state: object, questions: Questions, options: { readonly timeoutMs: number; readonly signal?: AbortSignal }): Promise<JevAnswer> {
  const jev = registry.findOfType("classifier", JEV_PROVIDER, JEV_MODEL);
  if (jev === undefined) return { failure: "no-model" };
  try {
    return read(await registry.classify(jev, { state: state as State, questions }, { maxRetries: 0, timeoutMs: options.timeoutMs, ...(options.signal === undefined ? {} : { signal: options.signal }) }), questions);
  } catch (error) {
    return { failure: error instanceof Error && /timed out|abort/i.test(error.message) ? "timeout" : "refused" };
  }
}
