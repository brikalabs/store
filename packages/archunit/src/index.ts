/**
 * A tiny ArchUnit-style architecture-rule engine. Declare rules fluently, by package/folder
 * glob, so they scale as packages/controllers/adapters are added. Rules check imports,
 * filenames, or class names:
 *
 *   // layering: the domain core imports no database
 *   rule().filesMatching("packages/*-core/src").mayNotImport(modules("drizzle-orm")).assert();
 *
 *   // filename convention: adapter files are kebab-case
 *   rule().filesMatching("apps/registry/src/adapters").mustBeNamed(/^[a-z0-9-]+\.ts$/).assert();
 *
 *   // class-name convention: D1-backed adapters are prefixed "D1"
 *   rule().filesMatching("apps/registry/src/adapters/d1-*.ts").classesMustBePrefixed("D1").assert();
 *
 * Class-name checks come as `classesMustBePrefixed` / `classesMustBeSuffixed` and the general
 * `classesMustBeNamed(regexp)` / `classesMustNotBeNamed(regexp)` (e.g. forbid an infra prefix
 * leaking into the domain core).
 *
 * `assert()` throws on violation (call it inside your own `test()` - any runner); `check()`
 * returns the violation lines for other uses. Import-aware: comments are stripped, so an
 * `import` inside a JSDoc example is not counted. Bun runtime (uses `Bun.Glob`).
 */

export { type Category, category, modules } from "./categories";
export { camelCase, kebabCase, kebabFilename, pascalCase } from "./naming";
export {
  ArchRules,
  type ArchRulesOptions,
  archRules,
  type FileCheck,
  type FileInfo,
  type RuleBuilder,
  type RuleResult,
  rule,
} from "./rules";
export { classNames, specifiers, stripComments } from "./source";
