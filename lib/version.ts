import pkg from "@/package.json";

// Fallback for local/dev where Vercel's git env vars are absent.
const REPO_FALLBACK = "khalidbelhadj/reading-list";

export type VersionInfo = {
  name: string;
  version: string;
  environment: string;
  buildTime: string | null;
  commit: {
    sha: string | null;
    shortSha: string | null;
    branch: string | null;
    message: string | null;
    url: string | null;
  };
  deployment: {
    id: string | null;
    region: string | null;
    url: string | null;
  };
  runtime: {
    node: string;
  };
};

// Build/deploy metadata for debugging and bug reports. On Vercel the
// VERCEL_GIT_* / VERCEL_* values are injected as system env vars (readable at
// runtime in server code); BUILD_TIME is stamped at build time via `define`
// in vite.config.ts. Everything is null when running outside a Vercel deploy.
export const getVersionInfo = (): VersionInfo => {
  const env = process.env;
  const sha = env.VERCEL_GIT_COMMIT_SHA ?? null;
  const repo =
    env.VERCEL_GIT_REPO_OWNER && env.VERCEL_GIT_REPO_SLUG
      ? `${env.VERCEL_GIT_REPO_OWNER}/${env.VERCEL_GIT_REPO_SLUG}`
      : REPO_FALLBACK;

  return {
    name: pkg.productName ?? pkg.name,
    version: pkg.version,
    environment: env.VERCEL_ENV ?? env.NODE_ENV ?? "development",
    buildTime: env.BUILD_TIME ?? null,
    commit: {
      sha,
      shortSha: sha ? sha.slice(0, 7) : null,
      branch: env.VERCEL_GIT_COMMIT_REF ?? null,
      message: env.VERCEL_GIT_COMMIT_MESSAGE ?? null,
      url: sha ? `https://github.com/${repo}/commit/${sha}` : null,
    },
    deployment: {
      id: env.VERCEL_DEPLOYMENT_ID ?? null,
      region: env.VERCEL_REGION ?? null,
      url: env.VERCEL_URL ? `https://${env.VERCEL_URL}` : null,
    },
    runtime: {
      node: process.version,
    },
  };
};
