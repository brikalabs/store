import type { Context } from "hono";
import { type Propagation, required } from "../core/propagation";
import { transaction } from "../core/transaction";

type Handler = (c: Context, next: () => Promise<void>) => Response | Promise<Response>;

/**
 * Wrap a Hono handler so it runs inside a transaction: commit when it returns, roll
 * back when it throws.
 *
 *   app.post("/publish", transactional(async (c) => { ... }))
 *
 * Wrap the HANDLER, not a `next()` middleware. Hono catches a handler's throw and
 * turns it into an error response *before* an outer middleware's `await next()`
 * sees it, so a middleware would always observe "success" and never roll back.
 * Wrapping the handler puts the transaction boundary inside the handler call, ahead
 * of Hono's error handling, so a throw rolls back and then becomes the 500.
 *
 * Concurrency-safe: the context is an `AsyncLocalStorage`, so every in-flight
 * request gets its own transaction (verified in the test). It is supported on
 * Cloudflare Workers, Bun, and Node.
 */
export function transactional(handler: Handler, propagation: Propagation = required): Handler {
  return (c, next) => transaction(() => Promise.resolve(handler(c, next)), propagation);
}
