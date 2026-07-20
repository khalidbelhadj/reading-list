// Reading-panel toolbar, styled like the item panel's: small muted ghost
// icons. Exactly four things: close, back/forward/reload (when the engine can
// navigate), a URL bar filling the middle, open-in-browser. Engine-specific
// controls (PDF zoom) live inside their engines, not here.
import {
  IconArrowLeft,
  IconArrowRight,
  IconArrowsDiagonal,
  IconArrowsDiagonalMinimize2,
  IconExternalLink,
  IconRefresh,
  IconX,
} from "@tabler/icons-react";
import React from "react";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useActiveViewerSession } from "@/lib/viewer/session";

const ToolbarButton = ({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) => (
  <Tooltip>
    <TooltipTrigger
      render={
        <Button
          variant="ghost"
          size="icon-sm"
          className="text-muted-foreground"
          onClick={onClick}
          disabled={disabled}
          aria-label={label}
        />
      }
    >
      {children}
    </TooltipTrigger>
    <TooltipContent>{label}</TooltipContent>
  </Tooltip>
);

export const ViewerHeader = ({
  fallbackUrl,
  onClose,
  onOpenExternal,
  expanded,
  onToggleExpanded,
}: {
  fallbackUrl: string;
  onClose: () => void;
  onOpenExternal: () => void;
  expanded: boolean;
  onToggleExpanded: () => void;
}) => {
  const session = useActiveViewerSession();

  // Re-render on navigation so the URL bar and back/forward state stay
  // current while browsing inside the pane.
  const [, bump] = React.useReducer((x: number) => x + 1, 0);
  React.useEffect(() => {
    if (!session) return;
    return session.on((event) => {
      if (event.type === "navigate") bump();
    });
  }, [session]);

  const nav = session?.nav;
  const displayUrl = (nav?.currentUrl() ?? fallbackUrl).replace(
    /^https?:\/\//,
    "",
  );

  return (
    <header
      className={cn(
        "flex h-10 shrink-0 items-center gap-0.5 px-2 transition-[padding] duration-220 ease-[cubic-bezier(0.32,0.72,0,1)]",
        // Only an expanded reader covers the window's top-left, so that's the
        // only state needing the macOS traffic-light clearance (and the drag
        // region that comes with it). No-op outside Electron.
        expanded && "electron-top-bar-inset panel-toolbar",
      )}
    >
      <ToolbarButton label="Close" onClick={onClose}>
        <IconX />
      </ToolbarButton>

      <ToolbarButton
        label={expanded ? "Restore" : "Expand"}
        onClick={onToggleExpanded}
      >
        {expanded ? <IconArrowsDiagonalMinimize2 /> : <IconArrowsDiagonal />}
      </ToolbarButton>

      {nav?.goBack && (
        <ToolbarButton
          label="Back"
          onClick={() => nav.goBack?.()}
          disabled={!nav.canGoBack()}
        >
          <IconArrowLeft />
        </ToolbarButton>
      )}
      {nav?.goForward && (
        <ToolbarButton
          label="Forward"
          onClick={() => nav.goForward?.()}
          disabled={!nav.canGoForward()}
        >
          <IconArrowRight />
        </ToolbarButton>
      )}
      {nav && (
        <ToolbarButton label="Reload" onClick={() => nav.reload()}>
          <IconRefresh />
        </ToolbarButton>
      )}

      {/* URL bar — fills the middle. */}
      <div className="mx-1 min-w-0 flex-1">
        <div className="w-full truncate rounded-md bg-muted/60 px-2.5 py-1 font-mono text-xs text-muted-foreground">
          {displayUrl}
        </div>
      </div>

      <ToolbarButton label="Open in browser" onClick={onOpenExternal}>
        <IconExternalLink />
      </ToolbarButton>
    </header>
  );
};
