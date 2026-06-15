import { z } from "zod";

/** Minimal GitHub OAuth client (Authorization Code flow) for sign-in. */

const AUTHORIZE_URL = "https://github.com/login/oauth/authorize";
const TOKEN_URL = "https://github.com/login/oauth/access_token";
const USER_URL = "https://api.github.com/user";

export interface GithubUser {
  id: number;
  login: string;
  name?: string;
  avatarUrl?: string;
}

export function authorizeUrl(clientId: string, redirectUri: string, state: string): string {
  const url = new URL(AUTHORIZE_URL);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("scope", "read:user");
  url.searchParams.set("state", state);
  return url.toString();
}

const TokenResponse = z.object({ access_token: z.string() });

export async function exchangeCode(
  code: string,
  clientId: string,
  clientSecret: string,
): Promise<string | null> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { accept: "application/json", "content-type": "application/json" },
    body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code }),
  });
  if (!res.ok) return null;
  const json: unknown = await res.json();
  const parsed = TokenResponse.safeParse(json);
  return parsed.success ? parsed.data.access_token : null;
}

const GithubUserResponse = z.object({
  id: z.number(),
  login: z.string(),
  name: z.string().nullish(),
  avatar_url: z.string().optional(),
});

export async function fetchUser(token: string): Promise<GithubUser | null> {
  const res = await fetch(USER_URL, {
    headers: {
      authorization: `Bearer ${token}`,
      accept: "application/vnd.github+json",
      "user-agent": "brika-store",
    },
  });
  if (!res.ok) return null;
  const json: unknown = await res.json();
  const parsed = GithubUserResponse.safeParse(json);
  if (!parsed.success) return null;
  return {
    id: parsed.data.id,
    login: parsed.data.login,
    name: parsed.data.name ?? undefined,
    avatarUrl: parsed.data.avatar_url,
  };
}
