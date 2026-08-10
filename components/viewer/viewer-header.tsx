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
        // Controls are anchored to the top of the bar rather than centred in
        // it. The reader starts at the layout's 8px padding, so pt-1 puts them
        // 12px down the window — exactly where the list toolbar's buttons sit,
        // and, because the macOS traffic lights are inset by 18px with a 6px
        // radius, on the dots' own centre line too.
        //
        // The height comes from the padding rather than a fixed h-*, so the
        // top anchor can't drift: border-b sits inside a fixed height and
        // would steal a pixel from the bottom gap.
        "flex shrink-0 items-start gap-0.5 border-b border-border/60 px-2 pt-1 pb-3 transition-[padding] duration-220 ease-[cubic-bezier(0.32,0.72,0,1)]",
        // The reader is docked to the left edge in every state, so it always
        // covers the window's top-left and always needs the macOS
        // traffic-light clearance (and the drag region that comes with it).
        // No-op outside Electron.
        "electron-top-bar-inset panel-toolbar",
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
