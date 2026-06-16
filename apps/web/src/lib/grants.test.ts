import { expect, test } from "bun:test";
import { type GrantFamily, groupGrants, parseGrantId } from "./grants";

test("parseGrantId splits a reverse-DNS grant into family + verb", () => {
  expect(parseGrantId("dev.brika.net.fetch")).toEqual({ family: "net", verb: "fetch" });
  expect(parseGrantId("dev.brika.secrets.get")).toEqual({ family: "secrets", verb: "get" });
  expect(parseGrantId("dev.brika.netLocal.fetch")).toEqual({ family: "netLocal", verb: "fetch" });
  // A family with no verb, and an id without the dev.brika prefix.
  expect(parseGrantId("dev.brika.fs")).toEqual({ family: "fs", verb: "" });
  expect(parseGrantId("custom.grant.x")).toEqual({ family: "custom", verb: "grant.x" });
});

function byId(families: GrantFamily[], id: string): GrantFamily {
  const found = families.find((f) => f.id === id);
  if (!found) throw new Error(`family ${id} not found`);
  return found;
}

test("groupGrants groups net hosts and flags wildcards", () => {
  const families = groupGrants({
    "dev.brika.net.fetch": { allow: ["*.stripe.com", "api.stripe.com"] },
  });
  const net = byId(families, "net");
  expect(net.label).toBe("Network");
  expect(net.risk).toBe("standard");
  expect(net.verbs).toEqual(["fetch"]);
  expect(net.scope).toEqual({
    kind: "hosts",
    hosts: [
      { value: "*.stripe.com", wildcard: true },
      { value: "api.stripe.com", wildcard: false },
    ],
  });
});

test("groupGrants marks secrets sensitive and maps verbs to operations", () => {
  const families = groupGrants({
    "dev.brika.secrets.get": { keys: ["apiKey"] },
    "dev.brika.secrets.set": { keys: ["apiKey"] },
    "dev.brika.secrets.delete": { keys: ["apiKey"] },
  });
  const secrets = byId(families, "secrets");
  expect(secrets.risk).toBe("sensitive");
  expect(secrets.grantIds).toEqual([
    "dev.brika.secrets.delete",
    "dev.brika.secrets.get",
    "dev.brika.secrets.set",
  ]);
  expect(secrets.scope).toEqual({ kind: "ops", ops: ["read", "write", "delete"] });
});

test("groupGrants splits fs paths into read and write by verb", () => {
  const families = groupGrants({
    "dev.brika.fs.read": { paths: ["/bundle", "/data/**"] },
    "dev.brika.fs.write": { paths: ["/data/**", "/data/cache/**"] },
  });
  const fs = byId(families, "fs");
  expect(fs.scope).toEqual({
    kind: "paths",
    read: ["/bundle", "/data/**"],
    write: ["/data/**", "/data/cache/**"],
  });
});

test("groupGrants reads netLocal loopback ports", () => {
  const families = groupGrants({ "dev.brika.netLocal.fetch": { ports: [11434] } });
  const local = byId(families, "netLocal");
  expect(local.label).toBe("Local network");
  expect(local.scope).toEqual({ kind: "ports", ports: ["11434"] });
});

test("groupGrants orders families: net, fs, then sensitive secrets, unknown last", () => {
  const families = groupGrants({
    "dev.brika.secrets.get": {},
    "acme.telemetry.report": {},
    "dev.brika.net.fetch": { allow: ["x.com"] },
    "dev.brika.fs.read": { paths: ["/bundle"] },
  });
  expect(families.map((f) => f.id)).toEqual(["net", "fs", "secrets", "acme"]);
  // Unknown family gets a title-cased label and a "none" scope.
  expect(byId(families, "acme").label).toBe("Acme");
  expect(byId(families, "acme").scope).toEqual({ kind: "none" });
});

test("groupGrants returns an empty list for a plugin with no grants", () => {
  expect(groupGrants({})).toEqual([]);
});
