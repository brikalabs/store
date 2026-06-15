import { defineCommand } from "@brika/cli-kit";
import * as p from "@brika/cli-kit/prompts";
import { prepare } from "./prepare";

export const pack = defineCommand({
  name: "pack",
  description: "Pack the plugin and write/inspect the tarball",
  args: {
    dir: { description: "Plugin directory (defaults to the current directory)", default: "." },
  },
  examples: ["brika pack ./my-plugin"],
  async handler({ args }) {
    const packed = await prepare(args.dir);
    await Bun.write(packed.filename, packed.tarball);
    p.log.success(`Wrote ${packed.filename}`);
  },
});
