import { Link } from "@tanstack/react-router";
import React from "react";

import { Button } from "@/components/ui/button";
import { useIsSecondaryWindow } from "@/lib/use-is-secondary-window";

// Reviews usually run in their own window (see use-start-review.ts). When
// that's the case the way back to the list is closing this window — the list
// window is still sitting behind it. Standalone (direct URL, blocked popup),
// fall back to a normal home link.
export const BackToListButton = () => {
  const isSecondaryWindow = useIsSecondaryWindow();

  const handleClose = React.useCallback(() => {
    const opener = window.opener as Window | null;
    if (opener && !opener.closed) {
      try {
        opener.focus();
      } catch {}
    }
    window.close();
  }, []);

  if (isSecondaryWindow) {
    return (
      <Button variant="ghost" size="lg" className="w-fit" onClick={handleClose}>
        Close window
      </Button>
    );
  }
  return (
    <Button
      variant="ghost"
      size="lg"
      className="w-fit"
      nativeButton={false}
      render={<Link to="/" />}
    >
      Back to list
    </Button>
  );
};
