/** Thrown when a propagation rule is violated (e.g. `mandatory` with no active tx). */
export class TransactionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TransactionError";
  }
}
