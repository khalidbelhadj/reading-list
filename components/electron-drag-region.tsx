// Pages with no top bar of their own (session summary, 404, error, login)
// still need a way to drag the Electron window. This renders an invisible
// fixed strip across the top of the window; globals.css hides it on web.
export const ElectronDragRegion = () => (
  <div aria-hidden className="electron-drag-strip electron-top-bar-inset" />
);
