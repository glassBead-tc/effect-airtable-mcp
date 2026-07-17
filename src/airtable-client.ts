import { HttpClient, HttpClientRequest, HttpClientResponse } from "@effect/platform";
import { NodeHttpClient } from "@effect/platform-node";
import { Config, Duration, Effect, Redacted, Schedule } from "effect";
import { AirtableApiError, RateLimitError, type AirtableError } from "./errors.js";

export interface SortSpec {
  field: string;
  direction?: string;
}

export interface ListRecordsOptions {
  maxRecords?: number;
  pageSize?: number;
  offset?: string;
  view?: string;
  filterByFormula?: string;
  cellFormat?: string;
  timeZone?: string;
  userLocale?: string;
  fields?: string[];
  sort?: SortSpec[];
}

// Airtable expects PHP-style bracket serialization for array params
// (fields[0]=..., sort[0][field]=..., records[0]=...).
function listRecordsParams(options: ListRecordsOptions): Record<string, string | number> {
  const qp: Record<string, string | number> = {};
  if (options.maxRecords !== undefined) qp["maxRecords"] = options.maxRecords;
  if (options.pageSize !== undefined) qp["pageSize"] = options.pageSize;
  if (options.offset !== undefined) qp["offset"] = options.offset;
  if (options.view !== undefined) qp["view"] = options.view;
  if (options.filterByFormula !== undefined) qp["filterByFormula"] = options.filterByFormula;
  if (options.cellFormat !== undefined) qp["cellFormat"] = options.cellFormat;
  if (options.timeZone !== undefined) qp["timeZone"] = options.timeZone;
  if (options.userLocale !== undefined) qp["userLocale"] = options.userLocale;
  options.fields?.forEach((f, i) => {
    qp[`fields[${i}]`] = f;
  });
  options.sort?.forEach((s, i) => {
    qp[`sort[${i}][field]`] = s.field;
    if (s.direction !== undefined) qp[`sort[${i}][direction]`] = s.direction;
  });
  return qp;
}

const rateLimitPolicy = Schedule.identity<AirtableError>().pipe(
  Schedule.addDelay((error) =>
    error._tag === "RateLimitError" ? Duration.seconds(error.retryAfterSeconds) : Duration.zero
  ),
  Schedule.intersect(Schedule.recurs(5))
);

function handleResponse(
  response: HttpClientResponse.HttpClientResponse
): Effect.Effect<unknown, AirtableError> {
  if (response.status === 429) {
    const header = response.headers["retry-after"];
    const parsed = header !== undefined ? Number.parseInt(header, 10) : Number.NaN;
    return Effect.fail(
      new RateLimitError({ retryAfterSeconds: Number.isNaN(parsed) ? 30 : parsed })
    );
  }
  if (response.status >= 400) {
    return response.json.pipe(
      Effect.orElseSucceed(() => undefined),
      Effect.flatMap((body) => {
        const message = (body as { error?: { message?: string } } | undefined)?.error?.message;
        return Effect.fail(
          new AirtableApiError({
            message: `Airtable API error: ${message ?? `HTTP ${response.status}`}`,
            statusCode: response.status,
            airtableMessage: message,
          })
        );
      })
    );
  }
  return response.json.pipe(
    Effect.mapError(
      (error) =>
        new AirtableApiError({ message: `Failed to parse Airtable response: ${String(error)}` })
    )
  );
}

export class AirtableClient extends Effect.Service<AirtableClient>()("AirtableClient", {
  effect: Effect.gen(function* () {
    const apiKey = yield* Config.redacted("AIRTABLE_API_KEY");
    const http = (yield* HttpClient.HttpClient).pipe(
      HttpClient.mapRequest(HttpClientRequest.prependUrl("https://api.airtable.com/v0")),
      HttpClient.mapRequest(HttpClientRequest.bearerToken(Redacted.value(apiKey)))
    );

    const run = (
      request: HttpClientRequest.HttpClientRequest
    ): Effect.Effect<unknown, AirtableError> =>
      http.execute(request).pipe(
        // Transport failures map to AirtableApiError before handleResponse,
        // so the retry predicate below only ever sees genuine 429s.
        Effect.mapError(
          (error) => new AirtableApiError({ message: `Airtable request failed: ${error.message}` })
        ),
        Effect.flatMap(handleResponse),
        Effect.retry({ schedule: rateLimitPolicy, while: (e) => e._tag === "RateLimitError" })
      );

    return {
      listBases: (options: { offset?: string }) =>
        run(
          HttpClientRequest.get("/meta/bases", {
            urlParams: options.offset !== undefined ? { offset: options.offset } : {},
          })
        ),
      getBase: (baseId: string) => run(HttpClientRequest.get(`/meta/bases/${baseId}`)),
      listTables: (baseId: string) => run(HttpClientRequest.get(`/meta/bases/${baseId}/tables`)),
      createTable: (baseId: string, body: unknown) =>
        run(
          HttpClientRequest.post(`/meta/bases/${baseId}/tables`).pipe(
            HttpClientRequest.bodyUnsafeJson(body)
          )
        ),
      updateTable: (baseId: string, tableId: string, body: unknown) =>
        run(
          HttpClientRequest.patch(`/meta/bases/${baseId}/tables/${tableId}`).pipe(
            HttpClientRequest.bodyUnsafeJson(body)
          )
        ),
      createField: (baseId: string, tableId: string, field: unknown) =>
        run(
          HttpClientRequest.post(`/meta/bases/${baseId}/tables/${tableId}/fields`).pipe(
            HttpClientRequest.bodyUnsafeJson(field)
          )
        ),
      updateField: (baseId: string, tableId: string, fieldId: string, updates: unknown) =>
        run(
          HttpClientRequest.patch(`/meta/bases/${baseId}/tables/${tableId}/fields/${fieldId}`).pipe(
            HttpClientRequest.bodyUnsafeJson(updates)
          )
        ),
      listRecords: (baseId: string, tableName: string, options: ListRecordsOptions) =>
        run(
          HttpClientRequest.get(`/${baseId}/${tableName}`, {
            urlParams: listRecordsParams(options),
          })
        ),
      getRecord: (baseId: string, tableName: string, recordId: string) =>
        run(HttpClientRequest.get(`/${baseId}/${tableName}/${recordId}`)),
      createRecord: (baseId: string, tableName: string, body: unknown) =>
        run(
          HttpClientRequest.post(`/${baseId}/${tableName}`).pipe(
            HttpClientRequest.bodyUnsafeJson(body)
          )
        ),
      updateRecord: (baseId: string, tableName: string, recordId: string, body: unknown) =>
        run(
          HttpClientRequest.patch(`/${baseId}/${tableName}/${recordId}`).pipe(
            HttpClientRequest.bodyUnsafeJson(body)
          )
        ),
      deleteRecord: (baseId: string, tableName: string, recordId: string) =>
        run(HttpClientRequest.del(`/${baseId}/${tableName}/${recordId}`)),
      searchRecords: (baseId: string, tableName: string, filterByFormula: string) =>
        run(HttpClientRequest.get(`/${baseId}/${tableName}`, { urlParams: { filterByFormula } })),
      createRecords: (baseId: string, tableName: string, body: unknown) =>
        run(
          HttpClientRequest.post(`/${baseId}/${tableName}`).pipe(
            HttpClientRequest.bodyUnsafeJson(body)
          )
        ),
      updateRecords: (baseId: string, tableName: string, body: unknown) =>
        run(
          HttpClientRequest.patch(`/${baseId}/${tableName}`).pipe(
            HttpClientRequest.bodyUnsafeJson(body)
          )
        ),
      deleteRecords: (baseId: string, tableName: string, recordIds: string[]) => {
        const qp: Record<string, string> = {};
        recordIds.forEach((id, i) => {
          qp[`records[${i}]`] = id;
        });
        return run(HttpClientRequest.del(`/${baseId}/${tableName}`, { urlParams: qp }));
      },
    } as const;
  }),
  dependencies: [NodeHttpClient.layerUndici],
}) {}
