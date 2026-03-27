import * as vm from "node:vm";

export type CallToolFn = (name: string, params: Record<string, unknown>) => Promise<unknown>;

interface SandboxOptions {
  timeoutMs?: number;
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

export async function executeSandbox(
  code: string,
  callTool: CallToolFn,
  options?: SandboxOptions
): Promise<unknown> {
  const timeoutMs = options?.timeoutMs ?? 30_000;

  // Wrap in IIFE that is immediately invoked inside runInContext so that
  // synchronous infinite loops are caught by the vm timeout.
  const wrappedCode = `(async (callTool) => { ${code} })(callTool)`;

  const context = vm.createContext({
    callTool,
    console: { log: noop, error: noop, warn: noop },
    ...SAFE_BUILTINS,
  });

  return vm.runInContext(wrappedCode, context, {
    timeout: timeoutMs,
    filename: "code-mode-execute",
  }) as Promise<unknown>;
}
