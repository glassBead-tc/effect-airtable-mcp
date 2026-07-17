import { Data } from "effect";

export class AirtableApiError extends Data.TaggedError("AirtableApiError")<{
  readonly message: string;
  readonly statusCode?: number;
  readonly airtableMessage?: string;
}> {}

export class RateLimitError extends Data.TaggedError("RateLimitError")<{
  readonly retryAfterSeconds: number;
}> {}

export class SandboxError extends Data.TaggedError("SandboxError")<{
  readonly message: string;
  readonly cause?: unknown;
}> {}

export type AirtableError = AirtableApiError | RateLimitError;
