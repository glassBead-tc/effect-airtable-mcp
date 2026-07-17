import * as vm from "node:vm";
import { Cause, Duration, Effect } from "effect";
import { SandboxError } from "../errors.js";

export type CallToolFn = (
  name: string,
  params: Record<string, unknown>,
  signal?: AbortSignal
) => Promise<unknown>;

interface SandboxOptions {
  /** vm-level timeout: bounds synchronous execution (infinite loops). */
  syncTimeoutMs?: number;
  /** Total execution bound, including time spent awaiting callTool. */
  totalTimeoutMs?: number;
}

const noop = (): undefined => undefined;

const SAFE_BUILTINS = {
  JSON,
  Array,
  Object,
  String,
  Number,
  Boolean,
  Date,
  Math,
  RegExp,
  Map,
  Set,
  Promise,
  Error,
  TypeError,
  RangeError,
  parseInt,
  parseFloat,
  isNaN,
  isFinite,
  encodeURIComponent,
  decodeURIComponent,
};

// On total timeout the fiber is interrupted and Effect.tryPromise's
// AbortSignal fires; we thread it into callTool so in-flight Airtable
// requests are cancelled. node:vm cannot kill code parked on an await —
// orphaned microtasks may still settle, but their result is discarded.
export const executeSandbox = (
  code: string,
  callTool: CallToolFn,
  options?: SandboxOptions
): Effect.Effect<unknown, SandboxError | Cause.TimeoutException> =>
  Effect.tryPromise({
    try: (signal) => {
      const boundCallTool = (name: string, params: Record<string, unknown>): Promise<unknown> =>
        callTool(name, params, signal);

      // Wrap in IIFE that is immediately invoked inside runInContext so that
      // synchronous infinite loops are caught by the vm timeout.
      const wrappedCode = `(async (callTool) => { ${code} })(callTool)`;

      const context = vm.createContext({
        callTool: boundCallTool,
        console: { log: noop, error: noop, warn: noop },
        ...SAFE_BUILTINS,
      });

      return vm.runInContext(wrappedCode, context, {
        timeout: options?.syncTimeoutMs ?? 5_000,
        filename: "code-mode-execute",
      }) as Promise<unknown>;
    },
    catch: (error) =>
      new SandboxError({
        message: error instanceof Error ? error.message : String(error),
        cause: error,
      }),
  }).pipe(Effect.timeout(Duration.millis(options?.totalTimeoutMs ?? 30_000)));
