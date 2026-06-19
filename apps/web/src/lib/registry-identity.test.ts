import { describe, expect, test } from "bun:test";
import { sessionIdentity } from "./registry-identity";

describe("sessionIdentity", () => {
  test("maps a session user to a local-actor GitHub publish identity", () => {
    expect(
      sessionIdentity({ id: "gh_1", login: "octocat", name: "The Octocat", avatarUrl: null }),
    ).toEqual({ provider: "github", owner: "octocat", repository: null });
  });
});
