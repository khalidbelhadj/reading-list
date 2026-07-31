import { PageNav } from "./page-nav";

// Outer chrome for the standalone nav pages (Review, Settings). Mirrors the
// home page's container + toolbar inset so the nav sits in the same spot.
// `current` is the tab this page owns — the nav derives its active state from
// it rather than from the router, so the pill animation can't be started by a
// nav that is on its way out (see PageNav).
export const SecondaryPage = ({
  current,
  children,
}: {
  current: "/review" | "/settings";
  children?: React.ReactNode;
}) => (
  <div className="h-dvh overflow-hidden">
    <div className="h-full p-2">
      <div className="electron-toolbar-container relative mx-auto flex h-full w-full max-w-175 flex-col">
        <div className="electron-top-bar-inset pt-1">
          {/* hasTags is unused off the home page — the reading-list slot is a
              plain link there, not the settings dropdown. */}
          <PageNav current={current} hasTags={false} />
        </div>
        <div className="min-h-0 flex-1">{children}</div>
      </div>
    </div>
  </div>
);
