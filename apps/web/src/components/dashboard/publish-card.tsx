import { Button, Card, Tabs, TabsContent, TabsList, TabsTrigger } from "@brika/clay";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Check, Cloud, Copy, type LucideIcon, Rocket, Terminal } from "lucide-react";
import { type ReactNode, useState } from "react";
import { GithubIcon, GitlabIcon } from "@/components/clay/icons";
import { useT } from "@/i18n";

type IconType = LucideIcon | typeof GithubIcon;

type ProviderKey = "github" | "gitlab" | "azure" | "manual";

// Tab metadata only: labels are brand names except "manual" (resolved with t() in the component).
// Steps mix prose with markup so they live in `ProviderSteps`; codes are literal CI recipes.
type Provider = {
  key: ProviderKey;
  label: string;
  icon: IconType;
  code: string;
};

const PROVIDERS: Provider[] = [
  {
    key: "github",
    label: "GitHub",
    icon: GithubIcon,
    code: `on:
  release: { types: [published] }
permissions: { id-token: write }
jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - run: bunx @brika/cli publish`,
  },
  {
    key: "gitlab",
    label: "GitLab",
    icon: GitlabIcon,
    code: `publish:
  image: oven/bun
  id_tokens:
    BRIKA_OIDC: { aud: https://brika.dev }
  rules: [{ if: $CI_COMMIT_TAG }]
  script:
    - bunx @brika/cli publish`,
  },
  {
    key: "azure",
    label: "Azure",
    icon: Cloud,
    code: `trigger: { tags: { include: ['v*'] } }
steps:
  - task: AzureCLI@2
    inputs:
      addSpnToEnvironment: true
  - script: bunx @brika/cli publish`,
  },
  {
    key: "manual",
    label: "Manual",
    icon: Terminal,
    code: `$ export BRIKA_TOKEN=brk_••••••••3f8a
$ bunx @brika/cli publish
→ @brika/plugin-i18n@0.1.0 published`,
  },
];

function Strong({ children }: Readonly<{ children: ReactNode }>) {
  return <span className="font-semibold text-foreground">{children}</span>;
}

function Path({ children }: Readonly<{ children: ReactNode }>) {
  return <span className="font-mono text-[12.5px] text-foreground">{children}</span>;
}

/** The publish steps for one CI provider, rendered with translated prose around literal markup. */
function ProviderSteps({ provider }: Readonly<{ provider: ProviderKey }>) {
  const t = useT();
  if (provider === "github") {
    return (
      <>
        <li>{t("dashboard:githubStep1")}</li>
        <li>
          {t("dashboard:githubStep2a")} <Strong>{t("dashboard:trustedPublisher")}</Strong>{" "}
          {t("dashboard:githubStep2b")}
        </li>
        <li>
          {t("dashboard:githubStep3a")} <Path>.github/workflows/publish.yml</Path>
          {t("dashboard:githubStep3b")}
        </li>
      </>
    );
  }
  if (provider === "gitlab") {
    return (
      <>
        <li>{t("dashboard:gitlabStep1")}</li>
        <li>
          {t("dashboard:gitlabStep2a")} <Strong>{t("dashboard:trustedPublisher")}</Strong>{" "}
          {t("dashboard:gitlabStep2b")}
        </li>
        <li>
          {t("dashboard:gitlabStep3a")} <Path>.gitlab-ci.yml</Path>
          {t("dashboard:gitlabStep3b")}
        </li>
      </>
    );
  }
  if (provider === "azure") {
    return (
      <>
        <li>{t("dashboard:azureStep1")}</li>
        <li>
          {t("dashboard:azureStep2a")} <Strong>{t("dashboard:trustedPublisher")}</Strong>{" "}
          {t("dashboard:azureStep2b")}
        </li>
        <li>
          {t("dashboard:azureStep3a")} <Path>azure-pipelines.yml</Path>
          {t("dashboard:azureStep3b")}
        </li>
      </>
    );
  }
  return (
    <>
      <li>
        {t("dashboard:manualStep1a")}{" "}
        <Link to="/dashboard/account/tokens" className="font-semibold text-brand-ink">
          {t("dashboard:apiTokensLink")}
        </Link>
        {t("dashboard:manualStep1b")}
      </li>
      <li>
        {t("dashboard:manualStep2a")} <Path>BRIKA_TOKEN</Path> {t("dashboard:manualStep2b")}
      </li>
      <li>{t("dashboard:manualStep3")}</li>
    </>
  );
}

/** A dark code block with a copy-to-clipboard button. */
function CodeSnippet({ code }: Readonly<{ code: string }>) {
  const t = useT();
  const [copied, setCopied] = useState(false);
  async function copy() {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  return (
    <div className="relative">
      <pre className="overflow-auto rounded-xl bg-zinc-900 p-4 font-mono text-[11.5px] text-zinc-100 leading-relaxed dark:bg-black">
        {code}
      </pre>
      <Button
        type="button"
        size="icon-sm"
        variant="ghost"
        onClick={copy}
        aria-label={t("dashboard:copy")}
        className="absolute top-2.5 right-2.5 border border-white/15 bg-white/10 text-zinc-100 hover:bg-white/20 hover:text-white"
      >
        {copied ? <Check className="size-4 text-success" /> : <Copy className="size-4" />}
      </Button>
    </div>
  );
}

/** The overview's "Publish your plugin" guide: pick a CI provider, copy its recipe. */
export function PublishCard() {
  const t = useT();
  return (
    <Card className="flex min-w-0 flex-col gap-4 rounded-[20px] p-6 shadow-sm">
      <h2 className="flex items-center gap-2.5 font-bold font-heading text-[19px] text-foreground tracking-tight">
        <Rocket className="size-5 text-brand-ink" />
        {t("dashboard:publishTitle")}
      </h2>

      <Tabs defaultValue="github">
        <TabsList className="w-full">
          {PROVIDERS.map(({ key, label, icon: Icon }) => (
            <TabsTrigger key={key} value={key} className="flex-1">
              <Icon className="size-4" />
              {key === "manual" ? t("dashboard:tabManual") : label}
            </TabsTrigger>
          ))}
        </TabsList>
        {PROVIDERS.map((provider) => (
          <TabsContent
            key={provider.key}
            value={provider.key}
            className="mt-4 flex min-w-0 flex-col gap-4"
          >
            <ol className="flex list-decimal flex-col gap-2 pl-5 text-[13.5px] text-muted-foreground leading-relaxed">
              <ProviderSteps provider={provider.key} />
            </ol>
            <CodeSnippet code={provider.code} />
          </TabsContent>
        ))}
      </Tabs>

      <Button asChild variant="link" className="h-auto w-fit gap-1 p-0 text-brand-ink">
        <Link to="/dashboard/plugins">
          {t("dashboard:manageTrustedPublishers")}
          <ArrowRight className="size-3.5" />
        </Link>
      </Button>
    </Card>
  );
}
