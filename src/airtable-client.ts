import axios, { AxiosInstance, AxiosError } from "axios";

export class AirtableApiError extends Error {
  statusCode: number | undefined;
  airtableMessage: string | undefined;

  constructor(error: AxiosError) {
    const data = error.response?.data as { error?: { message?: string } } | undefined;
    const extracted = data?.error?.message ?? error.message;
    super(`Airtable API error: ${extracted}`);
    this.name = "AirtableApiError";
    this.statusCode = error.response?.status;
    this.airtableMessage = data?.error?.message;
  }
}

export function createAirtableClient(): AxiosInstance {
  const apiKey = process.env["AIRTABLE_API_KEY"];
  if (apiKey === undefined || apiKey === "") {
    throw new Error("AIRTABLE_API_KEY environment variable is required but not set");
  }

  const client = axios.create({
    baseURL: "https://api.airtable.com/v0",
    headers: { Authorization: `Bearer ${apiKey}` },
  });

  client.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
      if (error.response?.status === 429 && error.config) {
        const retryAfter = error.response.headers["retry-after"] as string | undefined;
        const waitSeconds = retryAfter !== undefined ? parseInt(retryAfter, 10) : 30;
        await new Promise((resolve) => setTimeout(resolve, waitSeconds * 1000));
        return client(error.config);
      }
      return Promise.reject(new AirtableApiError(error));
    }
  );

  return client;
}
