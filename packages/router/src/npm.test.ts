import { describe, expect, test } from "bun:test";
import { encodePackageName, npmLink, packageName } from "./npm";

/**
 * `packageName` joins the params matched by {@link PKG} (after the router expands
 * its optional scope) back into one name; `encodePackageName`/`npmLink` are the
 * client side. The end-to-end routing of `PKG` is covered in `router.test.ts`.
 */

describe("packageName", () => {
  test("joins a scoped name and passes an unscoped one through", () => {
    expect(packageName({ scope: "@brika", pkg: "clay" })).toBe("@brika/clay");
    expect(packageName({ pkg: "react" })).toBe("react");
    // The `%2f` form arrives as one already-decoded segment.
    expect(packageName({ pkg: "@brika/clay" })).toBe("@brika/clay");
  });
});

describe("encodePackageName + npmLink", () => {
  test("encodes only the scope separator", () => {
    expect(encodePackageName("@brika/clay")).toBe("@brika%2Fclay");
    expect(encodePackageName("react")).toBe("react");
  });

  test("npmLink builds registry paths with the name encoded as one segment", () => {
    expect(npmLink("/-/v1/downloads/:name", { name: "@brika/clay" })).toBe(
      "/-/v1/downloads/@brika%2Fclay",
    );
    expect(
      npmLink("/-/package/:name/:version/deprecate", { name: "@brika/clay", version: "1.2.3" }),
    ).toBe("/-/package/@brika%2Fclay/1.2.3/deprecate");
  });
});
