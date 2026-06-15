/**
 * Option values reach handlers under camelCase keys, so a `--no-boot` flag is
 * read as `values.noBoot` rather than the bracket-only `values['no-boot']`. The
 * flag name itself stays hyphenated.
 */

import { describe, expect, test } from "bun:test";
import { createCli } from "./cli";
import { defineCommand } from "./command";
import { editDistance, suggestCommand } from "./suggest";

/** Run `probe` with the given argv and return the values its handler saw. */
async function captureValues(
  options: Parameters<typeof defineCommand>[0]["options"],
  argv: string[],
): Promise<Record<string, unknown>> {
  let captured: Record<string, unknown> = {};
  const cli = createCli({ name: "test" }).addCommand(
    defineCommand({
      name: "probe",
      description: "capture parsed option values",
      options,
      handler(args) {
        captured = args.values;
      },
    }),
  );
  await cli.run(["probe", ...argv]);
  return captured;
}

describe("createCli option values", () => {
  test("exposes kebab-case flags under camelCase keys", async () => {
    const values = await captureValues(
      {
        "no-boot": { type: "boolean", default: false },
        "no-exit-code": { type: "boolean", default: false },
        force: { type: "boolean", default: false },
      },
      ["--no-boot", "--no-exit-code", "--force"],
    );

    expect(values.noBoot).toBe(true);
    expect(values.noExitCode).toBe(true);
    expect(values.force).toBe(true);
    // The original hyphenated keys are re-keyed away, not duplicated.
    expect(values["no-boot"]).toBeUndefined();
    expect(values["no-exit-code"]).toBeUndefined();
  });

  test("applies the default under the camelCase key when the flag is absent", async () => {
    const values = await captureValues({ "no-boot": { type: "boolean", default: false } }, []);
    expect(values.noBoot).toBe(false);
  });

  test("passes a string flag value through under its camelCase key", async () => {
    const values = await captureValues({ "config-path": { type: "string" } }, [
      "--config-path",
      "/tmp/x.yml",
    ]);
    expect(values.configPath).toBe("/tmp/x.yml");
  });
});

describe("positional args", () => {
  test("are parsed by declared name, with defaults", async () => {
    // The `seen` annotation also asserts the static types: `args.dir` is a
    // non-optional string (it has a default) and `args.name` is optional.
    let seen: { dir: string; name: string | undefined } | undefined;
    const build = defineCommand({
      name: "build",
      description: "build",
      args: { dir: { default: "." }, name: {} },
      handler({ args }) {
        seen = { dir: args.dir, name: args.name };
      },
    });
    const cli = createCli({ name: "t", commands: [build] });

    await cli.run(["build", "src"]);
    expect(seen).toEqual({ dir: "src", name: undefined });

    await cli.run(["build"]);
    expect(seen).toEqual({ dir: ".", name: undefined });
  });
});

describe("command suggestions", () => {
  test("editDistance counts single-character edits", () => {
    expect(editDistance("whoami", "whoami")).toBe(0);
    expect(editDistance("whomai", "whoami")).toBe(2); // transposed m/a
    expect(editDistance("logout", "login")).toBe(3);
    expect(editDistance("", "publish")).toBe(7);
  });

  test("suggestCommand returns the nearest command for a typo", () => {
    const commands = ["login", "logout", "publish", "whoami", "pack"];
    expect(suggestCommand("whomai", commands)).toBe("whoami");
    expect(suggestCommand("logn", commands)).toBe("login");
    expect(suggestCommand("publsh", commands)).toBe("publish");
  });

  test("suggestCommand returns undefined when nothing is close enough", () => {
    const commands = ["login", "publish", "whoami"];
    expect(suggestCommand("xyz", commands)).toBeUndefined();
    expect(suggestCommand("", commands)).toBeUndefined();
  });
});

describe("merging command groups", () => {
  const cmd = (name: string) => defineCommand({ name, description: name, handler() {} });

  test("addCommands flat-merges a group", () => {
    const cli = createCli({ name: "t" }).addCommands([cmd("a"), cmd("b")]);
    expect(cli.get("a")).toBeDefined();
    expect(cli.get("b")).toBeDefined();
  });

  test("config.commands registers a group up front, with built-in help", () => {
    const cli = createCli({ name: "t", commands: [cmd("a"), cmd("b")] });
    expect(cli.get("a")).toBeDefined();
    expect(cli.get("b")).toBeDefined();
    expect(cli.get("help")).toBeDefined();
  });

  test("a duplicate command name is a build error", () => {
    expect(() => createCli({ name: "t", commands: [cmd("publish"), cmd("publish")] })).toThrow(
      /build error/i,
    );
  });

  test("defaultCommand is typed against the registered command names", () => {
    const group = [defineCommand({ name: "go", description: "go", handler() {} })];
    createCli({ name: "t", commands: group, defaultCommand: "go" });
    createCli({ name: "t", commands: group, defaultCommand: "help" });
    // @ts-expect-error "nope" is not one of the registered command names
    createCli({ name: "t", commands: group, defaultCommand: "nope" });
    expect(true).toBe(true);
  });

  test("addCommands with a spec mounts a namespace", async () => {
    let ran = "";
    const group = [
      defineCommand({
        name: "publish",
        description: "publish",
        handler() {
          ran = "publish";
        },
      }),
    ];
    const hub = createCli({ name: "brika", defaultCommand: "help" }).addCommands({
      name: "registry",
      description: "registry",
      commands: group,
    });
    expect(hub.get("registry")).toBeDefined();
    await hub.run(["registry", "publish"]);
    expect(ran).toBe("publish");
  });
});
