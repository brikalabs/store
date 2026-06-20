import { describe, expect, test } from "bun:test";
import type { PublishIdentity } from "./publish";
import { type TrustedPublisher, trustedPublisherMatches } from "./trusted-publishers";

const binding: TrustedPublisher = {
  scope: "@brika",
  provider: "github",
  repository: "brikalabs/plugin-weather",
  workflow: "publish.yml",
};

const oidc = (
  repository: string | null,
  workflowRef?: string,
  provider = "github",
): PublishIdentity => ({
  provider,
  owner: repository?.split("/")[0] ?? "x",
  repository,
  provenance: workflowRef === undefined ? undefined : { repository: repository ?? "", workflowRef },
});

const REF = "brikalabs/plugin-weather/.github/workflows/publish.yml@refs/heads/main";

describe("trustedPublisherMatches", () => {
  test("matches the right repo + workflow filename (ignoring the git ref)", () => {
    expect(trustedPublisherMatches(binding, oidc("brikalabs/plugin-weather", REF))).toBe(true);
  });

  test("does not match a different repository", () => {
    const ref = "brikalabs/other/.github/workflows/publish.yml@refs/heads/main";
    expect(trustedPublisherMatches(binding, oidc("brikalabs/other", ref))).toBe(false);
  });

  test("does not match across providers (same repo on gitlab)", () => {
    expect(trustedPublisherMatches(binding, oidc("brikalabs/plugin-weather", REF, "gitlab"))).toBe(
      false,
    );
  });

  test("does not match a different workflow filename", () => {
    const ref = "brikalabs/plugin-weather/.github/workflows/release.yml@refs/heads/main";
    expect(trustedPublisherMatches(binding, oidc("brikalabs/plugin-weather", ref))).toBe(false);
  });

  test("a token (non-OIDC) identity never matches (repository is null)", () => {
    expect(trustedPublisherMatches(binding, oidc(null))).toBe(false);
  });

  test("does not match when the workflow_ref is absent", () => {
    expect(trustedPublisherMatches(binding, oidc("brikalabs/plugin-weather"))).toBe(false);
  });
});
