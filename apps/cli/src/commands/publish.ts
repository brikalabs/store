import { CliError, defineCommand } from "@brika/cli-kit";
import * as p from "@brika/cli-kit/prompts";
import { attestPackage } from "../lib/attest";
import { loadConfig } from "../lib/config";
import { REGISTRY_OIDC_AUDIENCE, requestGithubOidcToken } from "../lib/oidc";
import { RegistryClient } from "../lib/registry";
import { prepare } from "./prepare";

export const publish = defineCommand({
  name: "publish",
  description: "Pack, validate, and publish a plugin",
  args: {
    dir: { description: "Plugin directory (defaults to the current directory)", default: "." },
  },
  options: {
    "dry-run": {
      type: "boolean",
      short: "n",
      default: false,
      description: "Validate and pack without publishing",
    },
  },
  examples: ["brika publish ./my-plugin", "brika publish --dry-run"],
  async handler({ values, args }) {
    const packed = await prepare(args.dir);
    if (values.dryRun) {
      p.log.info("Dry run: validated and packed, not published.");
      return;
    }

    const { token, registry } = await loadConfig();
    // Auth precedence (PUB-016 trusted publishing):
    //   1. BRIKA_TOKEN - a human/CI token (works on any system).
    //   2. BRIKA_OIDC_TOKEN - a CI OIDC token the workflow already minted (GitLab `id_tokens`,
    //      or any provider): the portable tokenless path.
    //   3. GitHub Actions - mint the OIDC token on the fly from the runtime.
    // The registry verifies an OIDC token (GitHub/GitLab) against a trusted-publisher binding.
    let auth = token ?? process.env.BRIKA_OIDC_TOKEN;
    if (auth !== undefined && token === undefined) {
      p.log.info("Authenticating with CI OIDC (trusted publishing)");
    }
    if (auth === undefined) {
      const oidc = await requestGithubOidcToken(REGISTRY_OIDC_AUDIENCE);
      if (oidc !== null) {
        auth = oidc;
        p.log.info("Authenticating with GitHub OIDC (trusted publishing)");
      }
    }
    if (auth === undefined) {
      throw new CliError(
        "not authenticated - run `brika login` (or set BRIKA_TOKEN), set BRIKA_OIDC_TOKEN from your CI's OIDC id-token, or publish from GitHub Actions with `permissions: id-token: write`",
      );
    }

    // Sign + record the tarball in a public transparency log (sigstore) when
    // running in CI. Best-effort: an unattested release still publishes.
    const transparencyLog =
      (await attestPackage({
        integrity: packed.integrity,
        subject: `${packed.name}@${packed.version}`,
      })) ?? undefined;
    if (transparencyLog !== undefined) {
      p.log.success(`Attested via ${transparencyLog.provider}: ${transparencyLog.logUrl}`);
    }

    const spin = p.spinner();
    spin.start(`Publishing to ${registry}`);
    const { integrity } = await new RegistryClient(registry)
      .publish(auth, {
        name: packed.name,
        version: packed.version,
        manifest: packed.manifest,
        tarball: Buffer.from(packed.tarball).toString("base64"),
        transparencyLog,
      })
      .catch((error: unknown) => {
        spin.stop("Publish rejected");
        throw error;
      });

    // The registry recomputes integrity from the bytes it received; confirm it
    // matches what we packed so a corrupted upload is never accepted silently.
    if (integrity !== packed.integrity) {
      spin.stop("Integrity mismatch");
      throw new CliError(
        `integrity mismatch: packed ${packed.integrity}, registry stored ${integrity}`,
      );
    }
    spin.stop(`Published ${packed.name}@${packed.version}`);
    p.log.success(`integrity verified: ${integrity}`);
  },
});
