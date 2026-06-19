/**
 * Architecture rules as a lint CLI (run by `bun run lint` + CI). The rules live in
 * `architecture-rules.ts` and also run as `bun test` cases (`architecture.test.ts`) -
 * this is the standalone runner that prints violations and fails the build.
 */
import { architecture } from "./architecture-rules";

const violations = architecture.check();
if (violations.length > 0) {
  console.error(`check-architecture: ${violations.length} rule violation(s):\n${violations.join("\n")}`);
  process.exit(1);
}
console.log("check-architecture: all architecture rules hold.");
