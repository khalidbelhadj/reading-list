import { IconCheck, IconCopy } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import React from "react";

import { getVersionInfo } from "@/app/actions";
import { Button } from "@/components/system/button";
import { EmptyState } from "@/components/system/empty-state";
import { TextLink } from "@/components/system/link";
import { Skeleton } from "@/components/system/skeleton";
import type { VersionInfo } from "@/lib/version";

const ROW_COUNT = 9;

const Row = ({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) => (
  <div className="flex items-baseline justify-between gap-4 py-1">
    <span className="shrink-0 text-body text-muted-foreground select-none">
      {label}
    </span>
    <span className="text-right font-mono text-small text-foreground">
      {children}
    </span>
  </div>
);

const notSet = <span className="text-muted-foreground">Not set</span>;

const CopyButton = ({ value }: { value: string }) => {
  const [copied, setCopied] = React.useState(false);
  const handleCopy = React.useCallback(() => {
    void navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    });
  }, [value]);
  return (
    <Button variant="secondary" size="sm" onClick={handleCopy}>
      {copied ? <IconCheck /> : <IconCopy />}
      {copied ? "Copied" : "Copy"}
    </Button>
  );
};

const VersionRows = ({ info }: { info: VersionInfo }) => {
  const commit = info.commit.shortSha ? (
    info.commit.url ? (
      <TextLink
        variant="accent"
        href={info.commit.url}
        target="_blank"
        rel="noreferrer"
      >
        {info.commit.shortSha}
      </TextLink>
    ) : (
      info.commit.shortSha
    )
  ) : (
    notSet
  );
  return (
    <>
      <div className="flex w-full flex-col">
        <Row label="Version">{info.version}</Row>
        <Row label="Environment">{info.environment}</Row>
        <Row label="Build time">{info.buildTime ?? notSet}</Row>
        <Row label="Commit">{commit}</Row>
        <Row label="Branch">{info.commit.branch ?? notSet}</Row>
        <Row label="Message">{info.commit.message ?? notSet}</Row>
        <Row label="Deployment">{info.deployment.id ?? notSet}</Row>
        <Row label="Region">{info.deployment.region ?? notSet}</Row>
        <Row label="Node">{info.runtime.node}</Row>
      </div>
      <div className="flex w-full items-center justify-between gap-4">
        <TextLink
          variant="quiet"
          href="/version.json"
          target="_blank"
          rel="noreferrer"
          className="font-mono text-small"
        >
          /version.json
        </TextLink>
        <CopyButton value={JSON.stringify(info, null, 2)} />
      </div>
    </>
  );
};

// Build and deploy info in the pane, where the sidebar and history stay put
// (it used to be a standalone /version page with no way back). The values
// only exist server-side; the public-safe subset is /version.json.
export const VersionPane = () => {
  const { data: info, error } = useQuery({
    queryKey: ["version"],
    queryFn: getVersionInfo,
    staleTime: Infinity,
  });

  const content = info ? (
    <VersionRows info={info} />
  ) : error ? (
    <EmptyState
      tone="error"
      title="Version info unavailable"
      description={error.message}
    />
  ) : (
    <div className="flex flex-col gap-2 py-1">
      {Array.from({ length: ROW_COUNT }, (_, index) => (
        <Skeleton key={index} className="h-5 w-full" />
      ))}
    </div>
  );

  return (
    <div className="flex min-h-full items-center justify-center px-8 py-12">
      <div className="flex w-full max-w-md flex-col gap-4">{content}</div>
    </div>
  );
};
