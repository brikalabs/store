import { describe, expect, test } from "bun:test";
import { defineCommand } from "./command";
import { generateCommandHelp, generateHelp } from "./help";

const publish = defineCommand({
  name: "publish",
  description: "Publish a plugin",
  details: "Long details about publishing.",
  args: {
    dir: { description: "Plugin directory", default: "." },
    version: { description: "Version to publish" },
  },
  options: {
    "dry-run": { type: "boolean", short: "n", default: false, description: "Validate only" },
  },
  examples: ["cli publish ./my-plugin"],
  handler: () => {},
});

const hidden = defineCommand({
  name: "secret",
  description: "Hidden command",
  hidden: true,
  handler: () => {},
});

describe("generateHelp (global)", () => {
  test("lists visible commands and the usage line", () => {
    const help = generateHelp([publish, hidden], undefined, "brika");
    expect(help).toContain("brika");
    expect(help).toContain("Usage:");
    expect(help).toContain("publish");
    expect(help).toContain("Publish a plugin");
    // Hidden commands are omitted from the global listing.
    expect(help).not.toContain("secret");
  });
});

describe("generateCommandHelp", () => {
  test("renders description, details, args, flags, and examples", () => {
    const help = generateCommandHelp(publish, "brika");
    expect(help).toContain("brika publish");
    expect(help).toContain("Long details about publishing.");
    expect(help).toContain("Arguments:");
    expect(help).toContain("dir");
    expect(help).toContain("(default: .)");
    expect(help).toContain("Flags:");
    expect(help).toContain("--dry-run");
    expect(help).toContain("-n, --dry-run");
    expect(help).toContain("Examples:");
    expect(help).toContain("cli publish ./my-plugin");
  });

  test("omits sections a command does not declare", () => {
    const bare = defineCommand({ name: "ping", description: "Ping", handler: () => {} });
    const help = generateCommandHelp(bare, "brika");
    expect(help).toContain("brika ping");
    expect(help).not.toContain("Flags:");
    expect(help).not.toContain("Arguments:");
    expect(help).not.toContain("Examples:");
  });

  test("generateHelp dispatches to the command view when given a command", () => {
    expect(generateHelp([publish], publish, "brika")).toContain("brika publish");
  });
});
