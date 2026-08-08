import type React from "react";

import { useIsElectron } from "@/lib/platform";

// Renders its children only in the desktop app; `fallback` (nothing by
// default) takes their place on the web. For a whole subtree — a page body, a
// panel, a run of menu items. A single conditional label or attribute reads
// better with `useIsElectron()` inline.
//
// Gating a full page: pass the standard desktop-only non-ideal state as the
// fallback, e.g.
//   <ElectronOnly fallback={<NonIdealState fullPage title="Desktop only" … />}>
export const ElectronOnly = ({
  children,
  fallback = null,
}: {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) => {
  const isElectron = useIsElectron();
  return <>{isElectron ? children : fallback}</>;
};
