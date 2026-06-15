import type { Command } from "@brika/cli-kit";
import { login } from "./login";
import { logout } from "./logout";
import { pack } from "./pack";
import { publish } from "./publish";
import { whoami } from "./whoami";

/** The registry/publish command group. Exported so the hub CLI can merge it. */
export const registryCommands: readonly Command[] = [login, pack, publish, whoami, logout];
