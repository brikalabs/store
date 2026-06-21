import { TabsContent } from "@brika/clay/components/tabs";
import type { PluginDetail } from "@brika/registry-contract";
import { FilesSection } from "@/components/plugin/file-browser";
import { DependenciesSection } from "./dependencies-section";
import { IntegrityProvenanceSection } from "./provenance-section";

/** The Supply chain tab: integrity &amp; provenance, dependencies, and files together. */
export function SupplyChainPanel({ detail }: Readonly<{ detail: PluginDetail }>) {
  const tarballName = `${detail.name.split("/").pop() ?? detail.name}-${detail.version}.tgz`;
  return (
    <TabsContent value="supply-chain" className="mt-0 flex flex-col gap-7">
      {detail.integrity ? (
        <IntegrityProvenanceSection
          integrity={detail.integrity}
          provenance={detail.provenance}
          size={detail.size}
          unpackedSize={detail.unpackedSize}
          fileCount={detail.fileCount}
        />
      ) : null}

      <DependenciesSection
        dependencies={detail.dependencies}
        peerDependencies={detail.peerDependencies}
        devDependencies={detail.devDependencies}
        brikaEngine={detail.brikaEngine}
      />

      {/* The file browser reads our own tarballs; it fetches the file list lazily on mount. */}
      <FilesSection
        name={detail.name}
        version={detail.version}
        tarballName={tarballName}
        tarballUrl={detail.tarballUrl}
        fileCount={detail.fileCount}
        unpackedSize={detail.unpackedSize}
      />
    </TabsContent>
  );
}
