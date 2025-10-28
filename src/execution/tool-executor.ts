import { Effect, pipe } from "effect";
import { z } from "zod";
import {
  InputValidationError,
  OutputValidationError,
  PostconditionError,
  type ToolError,
} from "../errors/tool-errors.js";

/**
 * ToolExecutor - Generic contract-driven tool execution framework
 *
 * Orchestrates the validation pipeline for tool operations:
 * 1. Validate raw input against schema
 * 2. Execute operation with typed input
 * 3. Validate raw output against schema
 * 4. Check postconditions (optional business rules)
 * 5. Return typed output or typed error
 *
 * Benefits:
 * - No silent failures (all I/O validated)
 * - Type safety (input → output)
 * - Testable (pure functions, composable Effects)
 * - Reusable (all 12 tools use same pattern)
 *
 * @example
 * ```typescript
 * const executor = new ToolExecutor({
 *   name: "create_record",
 *   inputSchema: CreateRecordInputSchema,
 *   outputSchema: CreateRecordOutputSchema,
 *   operation: (input) => callAirtableApi(input),
 *   postconditions: [(output) => checkRecordExists(output)],
 * });
 *
 * const result = await Effect.runPromise(
 *   executor.execute(rawInput)
 * );
 * ```
 */
export class ToolExecutor<I, O, E extends ToolError = ToolError> {
  constructor(
    private config: {
      /** Tool name for error reporting */
      name: string;

      /** Zod schema for input validation */
      inputSchema: z.ZodSchema<I>;

      /** Zod schema for output validation */
      outputSchema: z.ZodSchema<O>;

      /** Operation to execute with validated input */
      operation: (input: I) => Effect.Effect<unknown, E>;

      /** Optional postcondition checks on validated output */
      postconditions?: Array<(output: O) => Effect.Effect<void, PostconditionError>>;
    }
  ) {}

  /**
   * Validate input against schema
   */
  private validateInput(rawInput: unknown): Effect.Effect<I, InputValidationError> {
    return Effect.try({
      try: () => this.config.inputSchema.parse(rawInput),
      catch: (error) =>
        new InputValidationError({
          toolName: this.config.name,
          issues: (error as z.ZodError).issues,
          context: { rawInput },
        }),
    });
  }

  /**
   * Validate output against schema
   */
  private validateOutput(rawOutput: unknown): Effect.Effect<O, OutputValidationError> {
    return Effect.try({
      try: () => this.config.outputSchema.parse(rawOutput),
      catch: (error) =>
        new OutputValidationError({
          toolName: this.config.name,
          issues: (error as z.ZodError).issues,
          rawOutput,
        }),
    });
  }

  /**
   * Check all postconditions
   */
  private checkPostconditions(output: O): Effect.Effect<void, PostconditionError> {
    if (!this.config.postconditions || this.config.postconditions.length === 0) {
      return Effect.succeed(void 0);
    }

    // Run all postconditions in sequence
    return pipe(
      Effect.all(
        this.config.postconditions.map((check) => check(output)),
        {
          concurrency: "unbounded",
        }
      ),
      Effect.map(() => void 0)
    );
  }

  /**
   * Execute tool with full validation pipeline
   *
   * @param rawInput - Unvalidated input from MCP tool call
   * @returns Effect producing validated output or typed error
   */
  execute(
    rawInput: unknown
  ): Effect.Effect<O, InputValidationError | OutputValidationError | PostconditionError | E> {
    return pipe(
      this.validateInput(rawInput),
      Effect.flatMap(this.config.operation),
      Effect.flatMap((rawOutput) => this.validateOutput(rawOutput)),
      Effect.tap((output) => this.checkPostconditions(output))
    );
  }
}
