import { describe, it, expect } from "vitest";
import { HttpClient, HttpClientResponse, type HttpClientRequest } from "@effect/platform";
import { ConfigProvider, Effect, Layer } from "effect";
import { AirtableClient } from "../../src/airtable-client.js";
import type { AirtableError } from "../../src/errors.js";

type RequestHandler = (req: HttpClientRequest.HttpClientRequest, url: URL) => Response;

const json = (body: unknown, status = 200, headers: Record<string, string> = {}): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });

const testLayer = (handler: RequestHandler): Layer.Layer<AirtableClient> =>
  AirtableClient.DefaultWithoutDependencies.pipe(
    Layer.provide(
      Layer.succeed(
        HttpClient.HttpClient,
        HttpClient.make((req, url) =>
          Effect.succeed(HttpClientResponse.fromWeb(req, handler(req, url)))
        )
      )
    ),
    Layer.provide(
      Layer.setConfigProvider(ConfigProvider.fromMap(new Map([["AIRTABLE_API_KEY", "test-key"]])))
    )
  ) as Layer.Layer<AirtableClient>;

const runWithClient = <A>(
  handler: RequestHandler,
  use: (client: AirtableClient) => Effect.Effect<A, AirtableError>
): Promise<A> =>
  Effect.runPromise(Effect.flatMap(AirtableClient, use).pipe(Effect.provide(testLayer(handler))));

const failWithClient = (
  handler: RequestHandler,
  use: (client: AirtableClient) => Effect.Effect<unknown, AirtableError>
): Promise<AirtableError> =>
  Effect.runPromise(
    Effect.flatMap(AirtableClient, use).pipe(Effect.flip, Effect.provide(testLayer(handler)))
  );

describe("AirtableClient integration", () => {
  it("sends bearer auth to the right URL and decodes the response", async () => {
    const mockBases = {
      bases: [
        { id: "app123", name: "Test Base", permissionLevel: "create" },
        { id: "app456", name: "Another Base", permissionLevel: "edit" },
      ],
    };
    const seen: Array<{ url: string; auth: string | undefined; method: string }> = [];

    const result = await runWithClient(
      (req, url) => {
        seen.push({ url: url.toString(), auth: req.headers["authorization"], method: req.method });
        return json(mockBases);
      },
      (client) => client.listBases({})
    );

    expect(result).toEqual(mockBases);
    expect(seen).toEqual([
      {
        url: "https://api.airtable.com/v0/meta/bases",
        auth: "Bearer test-key",
        method: "GET",
      },
    ]);
  });

  it("serializes bracket-style query params for list_records sort/fields", async () => {
    let seenUrl = "";
    await runWithClient(
      (_req, url) => {
        seenUrl = url.toString();
        return json({ records: [] });
      },
      (client) =>
        client.listRecords("app123", "Tasks", {
          maxRecords: 5,
          fields: ["Name"],
          sort: [{ field: "Name", direction: "asc" }],
        })
    );
    const url = new URL(seenUrl);
    expect(url.pathname).toBe("/v0/app123/Tasks");
    expect(url.searchParams.get("maxRecords")).toBe("5");
    expect(url.searchParams.get("fields[0]")).toBe("Name");
    expect(url.searchParams.get("sort[0][field]")).toBe("Name");
    expect(url.searchParams.get("sort[0][direction]")).toBe("asc");
  });

  it("posts JSON bodies for create_record", async () => {
    const mockRecord = {
      id: "rec123",
      createdTime: "2024-01-01T00:00:00.000Z",
      fields: { Name: "Test Record", Status: "Active" },
    };
    let seenBody: unknown;
    let seenPath = "";

    const result = await runWithClient(
      (req, url) => {
        seenPath = url.pathname;
        const body = req.body;
        seenBody =
          body._tag === "Uint8Array" ? JSON.parse(new TextDecoder().decode(body.body)) : body;
        return json(mockRecord);
      },
      (client) =>
        client.createRecord("app123", "Table1", {
          fields: { Name: "Test Record", Status: "Active" },
        })
    );

    expect(result).toEqual(mockRecord);
    expect(seenPath).toBe("/v0/app123/Table1");
    expect(seenBody).toEqual({ fields: { Name: "Test Record", Status: "Active" } });
  });

  it("maps API errors to AirtableApiError with the Airtable message", async () => {
    const error = await failWithClient(
      () => json({ error: { type: "MODEL_ID_NOT_FOUND", message: "Record not found" } }, 404),
      (client) => client.getRecord("app123", "Tasks", "recMissing")
    );
    expect(error._tag).toBe("AirtableApiError");
    if (error._tag === "AirtableApiError") {
      expect(error.statusCode).toBe(404);
      expect(error.airtableMessage).toBe("Record not found");
    }
  });

  it("retries 429s using Retry-After and then succeeds", async () => {
    let calls = 0;
    const result = await runWithClient(
      () => {
        calls += 1;
        return calls <= 2 ? json({}, 429, { "retry-after": "0" }) : json({ bases: [] });
      },
      (client) => client.listBases({})
    );
    expect(result).toEqual({ bases: [] });
    expect(calls).toBe(3);
  });

  it("gives up after 5 retries and fails with RateLimitError", async () => {
    let calls = 0;
    const error = await failWithClient(
      () => {
        calls += 1;
        return json({}, 429, { "retry-after": "0" });
      },
      (client) => client.listBases({})
    );
    expect(error._tag).toBe("RateLimitError");
    expect(calls).toBe(6); // initial attempt + 5 retries
  });
});
