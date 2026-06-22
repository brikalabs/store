/**
 * A tiny ArchUnit-style architecture-rule engine: declare rules fluently by package/folder glob to
 * check imports, filenames, or class names. `assert()` throws on violation, `check()` returns the
 * violation lines. Comments are stripped, so an `import` inside a JSDoc example is not counted.
 *
 *   // layering: the domain core imports no database
 *   rule().filesMatching("packages/*-core/src").mayNotImport(modules("drizzle-orm")).assert();
 *
 *   // filename convention: adapter files are kebab-case
 *   rule().filesMatching("apps/registry/src/adapters").mustBeNamed(/^[a-z0-9-]+\.ts$/).assert();
 *
 *   // class-name convention: D1-backed adapters are prefixed "D1"
 *   rule().filesMatching("apps/registry/src/adapters/d1-*.ts").classesMustBePrefixed("D1").assert();
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
