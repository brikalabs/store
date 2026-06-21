import { describe, expect, test } from "bun:test";
import { sessionIdentity } from "@/server/registry-identity";

describe("sessionIdentity", () => {
  test("maps a session user to a local-actor publish identity keyed on the account id", () => {
    expect(sessionIdentity({ id: "usr_1", name: "The Octocat", avatarUrl: null })).toEqual({
      userId: "usr_1",
      provider: null,
      repository: null,
    });
  });
});
