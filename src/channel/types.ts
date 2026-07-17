/**
 * Shared contracts for the Claude Code channel entrypoint.
 *
 * A channel pushes events into a connected Claude Code session via the
 * `notifications/claude/channel` MCP notification. Event producers (the HTTP
 * receiver, the Airtable webhook poller) only see this narrow interface.
 */

/** Push one event into the connected Claude Code session. */
export type PushEvent = (content: string, meta: Record<string, string>) => Promise<void>;

/** Channel-side diagnostic logging. Must never write to stdout (stdio transport). */
export type ChannelLog = (message: string) => void;
