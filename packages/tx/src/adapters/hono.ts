import type { Context } from "hono";
import { type TxOptions, transaction } from "../core/transaction";

type Handler = (c: Context, next: () => Promise<void>) => Response | Promise<Response>;

/**
 * Wrap a Hono handler so it runs inside a transaction: commit when it returns, roll back when it throws.
 *
 * Wrap the HANDLER, not a `next()` middleware: Hono turns a handler's throw into an error response
 * *before* an outer middleware's `await next()` sees it, so a middleware would always observe "success"
 * and never roll back. Concurrency-safe via `AsyncLocalStorage`: each in-flight request gets its own tx.
 */
export function transactional(handler: Handler, options: TxOptions = {}): Handler {
  return (c, next) => transaction(() => Promise.resolve(handler(c, next)), options);
}
