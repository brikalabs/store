import { expect, test } from "bun:test";
import { type CommandSpec, runCli } from "./command";
import { CliError } from "./errors";

function stub(name: string, calls: string[][]): CommandSpec {
  return {
    name,
    summary: "",
    run: async (argv) => {
      calls.push([...argv]);
    },
  };
}

test("dispatches to the named command with the remaining argv", async () => {
  const calls: string[][] = [];
  await runCli([stub("go", calls)], ["go", "x", "--flag"]);
  expect(calls).toEqual([["x", "--flag"]]);
});

test("throws CliError on an unknown command", async () => {
  await expect(runCli([stub("go", [])], ["nope"])).rejects.toBeInstanceOf(CliError);
});

test("treats no args as help without dispatching", async () => {
  const calls: string[][] = [];
  await runCli([stub("go", calls)], []);
  expect(calls).toEqual([]);
});
