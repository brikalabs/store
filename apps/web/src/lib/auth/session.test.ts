import { describe, expect, test } from "bun:test";
import { signSession, verifySession } from "@/lib/auth/session";

const SECRET = "test-session-secret-please-change";

describe("signSession / verifySession", () => {
  test("a signed token verifies back to its user id", async () => {
    const token = await signSession("gh_42", SECRET);
    expect(token.startsWith("gh_42.")).toBe(true);
    expect(await verifySession(token, SECRET)).toBe("gh_42");
  });

  test("rejects a token signed with a different secret", async () => {
    const token = await signSession("gh_42", SECRET);
    expect(await verifySession(token, "a-different-secret")).toBeNull();
  });

  test("rejects a tampered signature of the same length", async () => {
    const token = await signSession("gh_42", SECRET);
    const flipped = `${token.slice(0, -1)}${token.endsWith("A") ? "B" : "A"}`;
    expect(await verifySession(flipped, SECRET)).toBeNull();
  });

  test("rejects a forged user id (the signature will not match)", async () => {
    const token = await signSession("gh_42", SECRET);
    const sig = token.slice(token.lastIndexOf("."));
    expect(await verifySession(`gh_99${sig}`, SECRET)).toBeNull();
  });

  test("rejects malformed tokens", async () => {
    expect(await verifySession("", SECRET)).toBeNull();
    expect(await verifySession("no-dot", SECRET)).toBeNull();
    expect(await verifySession(".onlysig", SECRET)).toBeNull();
  });

  test("round-trips a user id that itself contains dots", async () => {
    const token = await signSession("user.with.dots", SECRET);
    expect(await verifySession(token, SECRET)).toBe("user.with.dots");
  });
});
