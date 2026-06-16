import { deprecate } from "./deprecate";
import { login } from "./login";
import { logout } from "./logout";
import { pack } from "./pack";
import { publish } from "./publish";
import { whoami } from "./whoami";
import { yank } from "./yank";

/**
 * The registry/publish command group. Exported so the hub CLI can merge it. The
 * literal command names are preserved (no `Command[]` annotation) so a consuming
 * `createCli` can type-check its `defaultCommand` against them.
 */
export const registryCommands = [login, pack, publish, deprecate, yank, whoami, logout];
