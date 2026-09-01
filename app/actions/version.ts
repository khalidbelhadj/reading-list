// Server-only implementations — see ./index.ts for the RPC layer.
import { getCurrentUserId } from "@/lib/auth";
import { safeAction } from "@/lib/safe-action";
import {
  getVersionInfo as readVersionInfo,
  type VersionInfo,
} from "@/lib/version";

// Full build/deploy info for the shell's Version view. Server functions skip
// the request guard, so this checks for a session itself: the commit message
// can carry internal notes. The public-safe subset is /version.json.
export const getVersionInfo = safeAction(
  async function getVersionInfo(): Promise<VersionInfo> {
    await getCurrentUserId();
    return readVersionInfo();
  },
  "Could not load version info.",
);
