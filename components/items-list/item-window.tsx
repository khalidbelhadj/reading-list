import React from "react";

import { PanelInner } from "./sliding-item-panel";

// A dedicated single-item window (opened via openItemInNewWindow → ?window=1).
// Unlike the sliding side panel, there's no list behind it and no close or
// collapse chrome — the whole window *is* the item, edge-to-edge. It reuses
// PanelInner in its "window" variant with the "full" (edge-to-edge) phase.
export const ItemWindow = ({ itemId }: { itemId: string }) => {
  // Deleting the item from the ⋯ menu leaves nothing to show, so close the
  // window. Also the target of the (hidden) close path inside PanelInner.
  const handleClose = React.useCallback(() => {
    window.close();
  }, []);

  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden bg-surface">
      <PanelInner
        itemId={itemId}
        phase="full"
        variant="window"
        onClose={handleClose}
      />
    </div>
  );
};
