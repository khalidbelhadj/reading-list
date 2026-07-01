import { notFound } from "next/navigation";
import Link from "next/link";

import { getVersionInfo } from "@/lib/version";

import { CopyButton } from "./copy-button";

const Row = ({
  label,
  mono = true,
  children,
}: {
  label: string;
  mono?: boolean;
  children: React.ReactNode;
}) => (
  <div className="flex items-baseline justify-between gap-4 py-1">
    <span className="shrink-0 text-sm text-muted-foreground">{label}</span>
    <span
      className={
        mono
          ? "text-right font-mono text-xs text-foreground"
          : "text-right text-sm text-foreground"
      }
    >
      {children}
    </span>
  </div>
);

const empty = <span className="text-muted-foreground">—</span>;

const VersionPage = () => {
  if (process.env.NODE_ENV !== "development") {
    notFound();
  }
  const info = getVersionInfo();

  return (
    <div className="flex min-h-dvh items-center justify-center px-5">
      <div className="flex w-full max-w-md flex-col items-start gap-4">
        <div className="flex w-full flex-col">
          <Row label="Version">{info.version}</Row>
          <Row label="Environment">{info.environment}</Row>
          <Row label="Build time">{info.buildTime ?? empty}</Row>
          <Row label="Commit">
            {info.commit.shortSha ? (
              info.commit.url ? (
                <Link
                  href={info.commit.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary hover:underline"
                >
                  {info.commit.shortSha}
                </Link>
              ) : (
                info.commit.shortSha
              )
            ) : (
              empty
            )}
          </Row>
          <Row label="Branch">{info.commit.branch ?? empty}</Row>
          <Row label="Message">{info.commit.message ?? empty}</Row>
          <Row label="Deployment">{info.deployment.id ?? empty}</Row>
          <Row label="Region">{info.deployment.region ?? empty}</Row>
          <Row label="Node">{info.runtime.node}</Row>
          <Row label="Next">{info.runtime.next}</Row>
        </div>

        <div className="flex w-full items-center justify-between gap-4">
          <Link
            href="/debug/version.json"
            target="_blank"
            rel="noreferrer"
            className="font-mono text-xs text-muted-foreground hover:text-foreground"
          >
            /debug/version.json
          </Link>
          <CopyButton value={JSON.stringify(info, null, 2)} />
        </div>
      </div>
    </div>
  );
};

export default VersionPage;
