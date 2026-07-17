/**
 * Test fixture: plays the role of a stale channel instance holding the
 * receiver port. Prints {port, pid} as JSON on stdout once listening, then
 * stays alive until signaled (no SIGTERM handler — default termination, like
 * a receiver whose eviction should succeed).
 */
import type { AddressInfo } from "node:net";
import { startHttpReceiver } from "../../src/channel/http-receiver.js";

const port = parseInt(process.argv[2] ?? "0", 10);
const server = await startHttpReceiver(
  { port },
  async () => {},
  () => {}
);
const address = server.address() as AddressInfo;
process.stdout.write(`${JSON.stringify({ port: address.port, pid: process.pid })}\n`);
setInterval(() => {}, 60_000); // stay alive until signaled
