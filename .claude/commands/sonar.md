---
description: Run the local Sonar (Biome) check and fix what it reports
argument-hint: [optional path or rule to focus on]
allowed-tools: Bash(bun run sonar), Bash(bun run sonar:fix), Bash(bun test:*), Read, Edit, Write
---
Run the project's local Sonar quality check and resolve the findings.

Context:
- `bun run sonar` reports Sonar-style issues via Biome's real-rule subset, including
  Cognitive Complexity at threshold 15 (the same metric SonarCloud uses). Config lives
  in `biome.sonar.jsonc`.
- For machine-readable output use:
  `bunx --bun biome lint --config-path biome.sonar.jsonc --reporter=json --max-diagnostics=none .`

Steps:
1. Run `bun run sonar` to list the current findings.
2. Apply the mechanical fixes with `bun run sonar:fix`.
3. For findings with no auto-fix (Cognitive Complexity especially), refactor minimally:
   extract helpers / flatten control flow until each function scores <= 15, preserving behavior.
4. After each change, re-run `bun run sonar` and `bun test` to confirm the issue is gone
   and nothing regressed.
5. Finish when `bun run sonar` is clean, or report precisely what can't be resolved and why.

Focus area (optional): $ARGUMENTS
