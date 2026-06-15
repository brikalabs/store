import { defineCommand } from "@brika/cli-kit";
import * as p from "@brika/cli-kit/prompts";
import { packDirectory } from "../lib/tarball";
import { printSummary } from "./summary";
import { assertPublishable } from "./validate";

export const pack = defineCommand({
  name: "pack",
  description: "Pack the plugin and write/inspect the tarball",
  args: {
    dir: { description: "Plugin directory (defaults to the current directory)", default: "." },
  },
  examples: ["brika pack ./my-plugin"],
  async handler({ args }) {
    const packed = await packDirectory(args.dir);
    assertPublishable(packed);
    printSummary(packed);
    await Bun.write(packed.filename, packed.tarball);
    p.log.success(`Wrote ${packed.filename}`);
  },
});
