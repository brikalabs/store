import { Button, Card, Tabs, TabsContent, TabsList, TabsTrigger } from "@brika/clay";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Check, Cloud, Copy, type LucideIcon, Rocket, Terminal } from "lucide-react";
import { type ReactNode, useState } from "react";
import { GithubIcon, GitlabIcon } from "@/components/clay/icons";

type IconType = LucideIcon | typeof GithubIcon;

type Provider = {
  key: string;
  label: string;
  icon: IconType;
  steps: ReactNode;
  code: string;
};

const PROVIDERS: Provider[] = [
  {
    key: "github",
    label: "GitHub",
    icon: GithubIcon,
    steps: (
      <>
        <li>Push your plugin to a GitHub repository.</li>
        <li>
          On your plugin, add a <Strong>trusted publisher</Strong> linked to that repo and workflow
          (tokenless OIDC).
        </li>
        <li>
          Add the workflow as <Path>.github/workflows/publish.yml</Path>, then cut a release.
        </li>
      </>
    ),
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
    steps: (
      <>
        <li>Push your plugin to a GitLab project.</li>
        <li>
          Add a <Strong>trusted publisher</Strong> for that project, using a GitLab ID token (OIDC).
        </li>
        <li>
          Add the job as <Path>.gitlab-ci.yml</Path>, then push a tag.
        </li>
      </>
    ),
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
    steps: (
      <>
        <li>Push your plugin to an Azure Repos repository.</li>
        <li>
          Add a <Strong>trusted publisher</Strong> bound to your workload identity federation
          service connection.
        </li>
        <li>
          Add the pipeline as <Path>azure-pipelines.yml</Path>, then run it on a tag.
        </li>
      </>
    ),
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
    steps: (
      <>
        <li>
          Create an API token in{" "}
          <Link to="/dashboard/account/tokens" className="font-semibold text-brand-ink">
            API tokens
          </Link>
          .
        </li>
        <li>
          Set it as a <Path>BRIKA_TOKEN</Path> secret (or env var) on any machine or CI.
        </li>
        <li>Run publish. Works anywhere, no OIDC required.</li>
      </>
    ),
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

/** A dark code block with a copy-to-clipboard button. */
function CodeSnippet({ code }: Readonly<{ code: string }>) {
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
        aria-label="Copy"
        className="absolute top-2.5 right-2.5 border border-white/15 bg-white/10 text-zinc-100 hover:bg-white/20 hover:text-white"
      >
        {copied ? <Check className="size-4 text-success" /> : <Copy className="size-4" />}
      </Button>
    </div>
  );
}

/** The overview's "Publish your plugin" guide: pick a CI provider, copy its recipe. */
export function PublishCard() {
  return (
    <Card className="flex min-w-0 flex-col gap-4 rounded-[20px] p-6 shadow-sm">
      <h2 className="flex items-center gap-2.5 font-bold font-heading text-[19px] text-foreground tracking-tight">
        <Rocket className="size-5 text-brand-ink" />
        Publish your plugin
      </h2>

      <Tabs defaultValue="github">
        <TabsList className="w-full">
          {PROVIDERS.map(({ key, label, icon: Icon }) => (
            <TabsTrigger key={key} value={key} className="flex-1">
              <Icon className="size-4" />
              {label}
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
              {provider.steps}
            </ol>
            <CodeSnippet code={provider.code} />
          </TabsContent>
        ))}
      </Tabs>

      <Button asChild variant="link" className="h-auto w-fit gap-1 p-0 text-brand-ink">
        <Link to="/dashboard/plugins">
          Manage trusted publishers
          <ArrowRight className="size-3.5" />
        </Link>
      </Button>
    </Card>
  );
}
