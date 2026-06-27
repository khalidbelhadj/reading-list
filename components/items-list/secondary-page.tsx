import { PageNav } from "./page-nav";

// Outer chrome for the standalone nav pages (Review, Settings). Mirrors the
// home page's container + toolbar inset so the nav sits in the same spot.
export const SecondaryPage = ({ children }: { children?: React.ReactNode }) => (
  <div className="h-dvh overflow-hidden">
    <div className="h-full p-2">
      <div className="electron-toolbar-container relative mx-auto flex h-full w-full max-w-175 flex-col">
        <div className="electron-top-bar-inset pt-1">
          {/* hasTags is unused off the home page — the reading-list slot is a
              plain link there, not the settings dropdown. */}
          <PageNav hasTags={false} />
        </div>
        <div className="min-h-0 flex-1">{children}</div>
      </div>
    </div>
  </div>
);
