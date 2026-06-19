/** A verified publish-token principal: the identity the token was issued to. */
export interface TokenPrincipal {
  readonly provider: string;
  readonly subject: string;
}

/**
 * Publish-token persistence port for the local `brika` CLI: issue a token (shown once),
 * verify a presented one, revoke it. Only a hash is stored by the implementation, so a
 * database read cannot recover a token.
 */
export interface TokenStore {
  /** Issue a token for `subject` (default provider `github`); the plaintext is returned once. */
  issue(subject: string, provider?: string): Promise<string>;
  /** Resolve a presented token to its principal, or null when invalid/expired. */
  verify(token: string): Promise<TokenPrincipal | null>;
  /** Revoke the presented token. Idempotent. */
  revoke(token: string): Promise<void>;
}
